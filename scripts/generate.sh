#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SKILL_FILE=".claude/skills/generate-requirements/SKILL.md"
TEMPLATES_FILE=".claude/skills/generate-requirements/templates.md"
CONFIG_FILE="app.config.yaml"

# --- 出力先ベースディレクトリの読み込み ---
OUTPUT_BASE=$(grep '^output_base_dir:' "$CONFIG_FILE" 2>/dev/null | sed 's/^output_base_dir:[[:space:]]*//' | tr -d ' "'"'" || true)
if [[ -z "$OUTPUT_BASE" ]]; then OUTPUT_BASE="gen"; fi
DATA_SOURCE_DIR="${OUTPUT_BASE}/data_source"
REQUIREMENTS_DIR="${OUTPUT_BASE}/requirements"

# --- 一時ファイル管理 ---
TMPDIR_AGENTS=$(mktemp -d)
trap 'rm -rf "$TMPDIR_AGENTS"' EXIT
RESEARCH_CONTEXT="${TMPDIR_AGENTS}/research_context.md"
DESIGN_CONTEXT="${TMPDIR_AGENTS}/design_context.md"
REVIEW_RESULT="${TMPDIR_AGENTS}/review_result.md"

# --- 引数処理 ---
TARGET_DIR=""
DATASET_SOURCE=""
DATASET_NAME=""
SKIP_AGENTS=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    --dataset-source) DATASET_SOURCE="$2"; shift 2 ;;
    --dataset-name) DATASET_NAME="$2"; shift 2 ;;
    --skip-agents) SKIP_AGENTS=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--target <data_source_subdir>] [--dataset-source <file> --dataset-name <name>] [--skip-agents]"
      echo ""
      echo "keyword.jsonまたはデータセットソースを元にアプリ要件を生成します。"
      echo ""
      echo "Options:"
      echo "  --target          data_source配下のサブディレクトリ名（省略時は最新）"
      echo "  --dataset-source  データセットソースファイルパス"
      echo "  --dataset-name    データセット名"
      echo "  --skip-agents     外部エージェント（codex/gemini）をスキップ"
      exit 0
      ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# =============================================================================
# 制約条件の読み込み
# =============================================================================

read_constraints() {
  local block
  block=$(awk '/^generate:/{found=1} found && /^[^ ]/ && !/^generate:/{found=0} found{print}' "$CONFIG_FILE" 2>/dev/null || true)

  CONSTRAINT_PLATFORM=$(echo "$block" | awk '/constraints:/{c=1} c && /platform:/{print $2; exit}' | tr -d ' "'"'" || true)
  CONSTRAINT_BUDGET=$(echo "$block" | awk '/constraints:/{c=1} c && /budget:/{print $2; exit}' | tr -d ' "'"'" || true)
  CONSTRAINT_DIFFICULTY=$(echo "$block" | awk '/constraints:/{c=1} c && /difficulty:/{print $2; exit}' | tr -d ' "'"'" || true)
  CONSTRAINT_TEAM_SIZE=$(echo "$block" | awk '/constraints:/{c=1} c && /team_size:/{print $2; exit}' | tr -d ' "'"'" || true)
}

# 制約条件をプロンプト用テキストに変換
format_constraints_prompt() {
  local parts=()
  if [[ -n "$CONSTRAINT_PLATFORM" ]]; then
    parts+=("Platform: ${CONSTRAINT_PLATFORM}")
  fi
  if [[ -n "$CONSTRAINT_BUDGET" ]]; then
    parts+=("Budget: ${CONSTRAINT_BUDGET} (free=\$0, low=~\$50/mo, moderate=~\$500/mo, high=unlimited)")
  fi
  if [[ -n "$CONSTRAINT_DIFFICULTY" ]]; then
    parts+=("Difficulty: ${CONSTRAINT_DIFFICULTY}")
  fi
  if [[ -n "$CONSTRAINT_TEAM_SIZE" ]]; then
    parts+=("Team size: ${CONSTRAINT_TEAM_SIZE} (solo=1, small=2-3, medium=4-8, large=9+)")
  fi

  if [[ ${#parts[@]} -eq 0 ]]; then
    echo ""
    return
  fi

  local result="

CONSTRAINTS (the app concept MUST fit within these constraints):
"
  for p in "${parts[@]}"; do
    result="${result}- ${p}
"
  done
  result="${result}
Design the app so that it can realistically be built and operated within these constraints. Choose appropriate technology stack and scope accordingly."
  echo "$result"
}

read_constraints
CONSTRAINTS_PROMPT=$(format_constraints_prompt)

# =============================================================================
# エージェント設定読み込み
# =============================================================================

# yq が使えない環境でも動作するよう、grep/sed ベースでYAMLからエージェント設定を読み取る
# 構造: generate.agents.<name>.{enabled,model,sandbox,roles}

get_agent_enabled() {
  local agent="$1"
  local val
  val=$(awk "/^  *${agent}:/{found=1} found && /enabled:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true)
  [[ "$val" == "true" ]]
}

get_agent_model() {
  local agent="$1"
  awk "/^  *${agent}:/{found=1} found && /model:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true
}

get_agent_sandbox() {
  local agent="$1"
  awk "/^  *${agent}:/{found=1} found && /sandbox:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true
}

has_agent_role() {
  local agent="$1"
  local role="$2"
  # roles配下の "- <role>" を検索
  local in_agent=false
  local in_roles=false
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*${agent}: ]]; then
      in_agent=true
      in_roles=false
      continue
    fi
    if $in_agent && [[ "$line" =~ ^[[:space:]]*roles: ]]; then
      in_roles=true
      continue
    fi
    if $in_agent && $in_roles; then
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+) ]]; then
        local r="${BASH_REMATCH[1]}"
        r=$(echo "$r" | tr -d ' ')
        if [[ "$r" == "$role" ]]; then
          return 0
        fi
      else
        # roles ブロック終了
        in_roles=false
        in_agent=false
      fi
    fi
    # 別のエージェント定義に入ったらリセット
    if $in_agent && [[ "$line" =~ ^[[:space:]]{4}[a-z] && ! "$line" =~ ^[[:space:]]*- ]]; then
      in_agent=false
      in_roles=false
    fi
  done < <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE" 2>/dev/null)
  return 1
}

# 指定ロールを実行可能なエージェントが存在するか
can_run_role() {
  local role="$1"
  if $SKIP_AGENTS; then return 1; fi
  for agent in codex gemini; do
    if get_agent_enabled "$agent" && has_agent_role "$agent" "$role"; then
      return 0
    fi
  done
  return 1
}

# 指定ロールを持つ最初のエージェント名を返す
get_role_agent() {
  local role="$1"
  for agent in codex gemini; do
    if get_agent_enabled "$agent" && has_agent_role "$agent" "$role"; then
      echo "$agent"
      return 0
    fi
  done
  return 1
}

# =============================================================================
# エージェント実行関数
# =============================================================================

run_research_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "researcher") || return 0

  echo "--- Phase 1: Research ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  local keywords
  keywords=$(cat "$keyword_file")

  if [[ "$agent" == "gemini" ]]; then
    gemini -p "
You are a trend research analyst. Analyze these extracted keywords for current technology trends and market opportunities.

Keywords data:
${keywords}

Research and provide:
1. Current market trends related to these keywords (2025-2026)
2. Existing apps/services in these spaces and their gaps
3. Emerging technology trends that could be leveraged
4. User pain points that current solutions don't address
5. Potential market opportunities

Output: Structured analysis in markdown format.
" 2>/dev/null > "$RESEARCH_CONTEXT" || true

  elif [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
You are a trend research analyst. Analyze these extracted keywords for current technology trends and market opportunities.

Keywords data:
${keywords}

Research and provide:
1. Current market trends related to these keywords
2. Existing apps/services in these spaces and their gaps
3. Technology trends that could be leveraged
4. User pain points that current solutions don't address
5. Potential market opportunities

Output: Structured analysis in markdown format.
" 2>/dev/null > "$RESEARCH_CONTEXT" || true
  fi

  if [[ -s "$RESEARCH_CONTEXT" ]]; then
    echo "  リサーチ結果: $(wc -l < "$RESEARCH_CONTEXT") 行"
  else
    echo "  リサーチ結果: なし（スキップ）"
    rm -f "$RESEARCH_CONTEXT"
  fi
}

run_design_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "designer") || return 0

  echo "--- Phase 2: Design ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  local keywords
  keywords=$(cat "$keyword_file")

  local research_input=""
  if [[ -f "$RESEARCH_CONTEXT" ]]; then
    research_input="

Additional research context:
$(cat "$RESEARCH_CONTEXT")"
  fi

  if [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
You are an innovative app designer. Given these keywords from trend analysis, brainstorm a creative and viable app concept.

Keywords data:
${keywords}
${research_input}
${CONSTRAINTS_PROMPT}

IMPORTANT: Don't suggest obvious apps. Use association thinking - jump 1-2 conceptual levels from the keywords to find innovative ideas.

Provide:
1. App name (English, kebab-case)
2. Core concept (1-2 sentences)
3. Target users and their pain points
4. 5-8 core features with descriptions and priorities (High/Medium/Low)
5. Suggested technology stack with rationale
6. Monetization strategy

Output: Structured markdown format.
" 2>/dev/null > "$DESIGN_CONTEXT" || true

  elif [[ "$agent" == "gemini" ]]; then
    gemini -p "
You are an innovative app designer. Given these keywords from trend analysis, brainstorm a creative and viable app concept.

Keywords data:
${keywords}
${research_input}
${CONSTRAINTS_PROMPT}

IMPORTANT: Don't suggest obvious apps. Use association thinking - jump 1-2 conceptual levels from the keywords to find innovative ideas.

Provide:
1. App name (English, kebab-case)
2. Core concept (1-2 sentences)
3. Target users and their pain points
4. 5-8 core features with descriptions and priorities
5. Suggested technology stack with rationale
6. Monetization strategy

Output: Structured markdown format.
" 2>/dev/null > "$DESIGN_CONTEXT" || true
  fi

  if [[ -s "$DESIGN_CONTEXT" ]]; then
    echo "  設計提案: $(wc -l < "$DESIGN_CONTEXT") 行"
  else
    echo "  設計提案: なし（スキップ）"
    rm -f "$DESIGN_CONTEXT"
  fi
}

run_review_phase() {
  local app_name="$1"
  local agent
  agent=$(get_role_agent "reviewer") || return 0

  local app_dir="${REQUIREMENTS_DIR}/${app_name}"
  if [[ ! -d "$app_dir" ]]; then
    echo "  レビュー対象ディレクトリが見つかりません: ${app_dir}"
    return 0
  fi

  echo "--- Phase 4: Review ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  # overview.mdとfeatureファイルを読み取り
  local overview=""
  if [[ -f "${app_dir}/overview.md" ]]; then
    overview=$(cat "${app_dir}/overview.md")
  fi

  local features=""
  for f in "${app_dir}"/features/*.md; do
    if [[ -f "$f" ]]; then
      features="${features}

--- $(basename "$f") ---
$(cat "$f")"
    fi
  done

  if [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
Review these app requirements for quality and completeness.

## overview.md
${overview}

## Feature Specs
${features}

Evaluate:
1. Is the concept clear and the scope realistic?
2. Do the features comprehensively cover user needs?
3. Is the technical stack feasible and well-chosen?
4. Are there consistency issues between overview and features?
5. Are non-functional requirements adequately addressed?

Output format:
## Review Summary
### Score: A/B/C
### Strengths
### Issues (table: #, Severity, File, Issue, Suggestion)
### Recommendations
" 2>/dev/null > "$REVIEW_RESULT" || true

  elif [[ "$agent" == "gemini" ]]; then
    gemini -p "
Review these app requirements for quality and completeness.

## overview.md
${overview}

## Feature Specs
${features}

Evaluate:
1. Is the concept clear and the scope realistic?
2. Do the features comprehensively cover user needs?
3. Is the technical stack feasible and well-chosen?
4. Are there consistency issues between overview and features?
5. Are non-functional requirements adequately addressed?

Output format:
## Review Summary
### Score: A/B/C
### Strengths
### Issues (table: #, Severity, File, Issue, Suggestion)
### Recommendations
" 2>/dev/null > "$REVIEW_RESULT" || true
  fi

  if [[ -s "$REVIEW_RESULT" ]]; then
    echo "  レビュー結果: $(wc -l < "$REVIEW_RESULT") 行"
    echo ""
    echo "--- レビューサマリー ---"
    head -30 "$REVIEW_RESULT"
    echo "..."
  else
    echo "  レビュー結果: なし（スキップ）"
    rm -f "$REVIEW_RESULT"
  fi
}

# =============================================================================
# スキル内容とテンプレートを結合してシステムプロンプトファイルを作成
# =============================================================================
PROMPT_FILE=$(mktemp)
# TMPDIR_AGENTS のtrapに追加
trap 'rm -rf "$TMPDIR_AGENTS" "$PROMPT_FILE"' EXIT

# フロントマターを除去してスキル本文を抽出
awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$SKILL_FILE" > "$PROMPT_FILE"

# テンプレート内容を追加
echo "" >> "$PROMPT_FILE"
echo "---" >> "$PROMPT_FILE"
echo "" >> "$PROMPT_FILE"
cat "$TEMPLATES_FILE" >> "$PROMPT_FILE"

# =============================================================================
# データセットモード
# =============================================================================
if [[ -n "$DATASET_SOURCE" ]]; then
  echo "=== 要件生成（データセットモード） ==="
  echo "ソース: ${DATASET_SOURCE}"
  echo "データセット: ${DATASET_NAME}"
  echo ""

  PROMPT="以下のデータセットソースファイルを読み込んでください: ${DATASET_SOURCE}

このファイルには、複数のアプリ要件から選択されたOverviewとFeatureが含まれています。
これらの要件を組み合わせ・融合・発展させて、新しいユニークなアプリ案を構想し、
上記の要件生成スキルの手順に従って新しいアプリの要件を生成してください。

データセット名: ${DATASET_NAME}

重要：
- 既存の要件をそのままコピーするのではなく、選択された機能やコンセプトを融合・再解釈して新しいアプリを考案してください
- _source_info.json の source.directory は「dataset://${DATASET_NAME}」形式にしてください
- _source_info.json に dataset フィールドを追加し、dataset.name にデータセット名、dataset.sourceApps にデータセットに含まれる全アイテム（appName, type, featureId, title）を列挙してください
- 詳細はテンプレートの「データセットモード用」セクションに従ってください
- 生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

  claude -p "$PROMPT" \
    --append-system-prompt-file "$PROMPT_FILE" \
    --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

  exit 0
fi

# =============================================================================
# 通常モード（keyword.jsonベース）
# =============================================================================
if [[ -z "$TARGET_DIR" ]]; then
  TARGET_DIR=$(ls -1d "${DATA_SOURCE_DIR}"/*/ 2>/dev/null | xargs -n1 basename | sort | tail -1)
  if [[ -z "$TARGET_DIR" ]]; then
    echo "エラー: ${DATA_SOURCE_DIR}/ にデータがありません。先に pnpm collect を実行してください。"
    exit 1
  fi
fi

KEYWORD_FILE="${DATA_SOURCE_DIR}/${TARGET_DIR}/keyword.json"
if [[ ! -f "$KEYWORD_FILE" ]]; then
  echo "エラー: ${KEYWORD_FILE} が見つかりません。先に /extract-keywords を実行してください。"
  exit 1
fi

echo "=== 要件生成 ==="
echo "対象: ${KEYWORD_FILE}"
echo ""

# --- エージェント設定の表示 ---
if ! $SKIP_AGENTS; then
  echo "--- エージェント設定 ---"
  for agent in codex gemini; do
    if get_agent_enabled "$agent"; then
      local_model=$(get_agent_model "$agent")
      echo "  ${agent}: enabled (model: ${local_model:-default})"
    else
      echo "  ${agent}: disabled"
    fi
  done
  echo ""
fi

# --- 制約条件の表示 ---
if [[ -n "$CONSTRAINT_PLATFORM" || -n "$CONSTRAINT_BUDGET" || -n "$CONSTRAINT_DIFFICULTY" || -n "$CONSTRAINT_TEAM_SIZE" ]]; then
  echo "--- 制約条件 ---"
  [[ -n "$CONSTRAINT_PLATFORM" ]] && echo "  platform: ${CONSTRAINT_PLATFORM}"
  [[ -n "$CONSTRAINT_BUDGET" ]] && echo "  budget: ${CONSTRAINT_BUDGET}"
  [[ -n "$CONSTRAINT_DIFFICULTY" ]] && echo "  difficulty: ${CONSTRAINT_DIFFICULTY}"
  [[ -n "$CONSTRAINT_TEAM_SIZE" ]] && echo "  team_size: ${CONSTRAINT_TEAM_SIZE}"
  echo ""
fi

# --- 生成前のアプリ一覧を記録（新規アプリ検出用） ---
APPS_BEFORE=$(ls -1 "${REQUIREMENTS_DIR}" 2>/dev/null || true)

# =============================================================================
# Phase 1: Research（researcher ロール）
# =============================================================================
if can_run_role "researcher"; then
  run_research_phase "$KEYWORD_FILE"
  echo ""
fi

# =============================================================================
# Phase 2: Design（designer ロール）
# =============================================================================
if can_run_role "designer"; then
  run_design_phase "$KEYWORD_FILE"
  echo ""
fi

# =============================================================================
# Phase 3: Generate（Claude Code メイン生成）
# =============================================================================
echo "--- Phase 3: Generate (Claude Code) ---"

# 外部エージェントのコンテキストをプロンプトに統合
EXTRA_CONTEXT=""
if [[ -f "$RESEARCH_CONTEXT" ]]; then
  EXTRA_CONTEXT="${EXTRA_CONTEXT}

## 外部リサーチ結果（参考情報）
以下は外部エージェントによるトレンド・市場調査の結果です。アプリ案の構想に活用してください。

$(cat "$RESEARCH_CONTEXT")"
fi

if [[ -f "$DESIGN_CONTEXT" ]]; then
  EXTRA_CONTEXT="${EXTRA_CONTEXT}

## 外部エージェントによる設計提案（参考情報）
以下は外部エージェントによるアプリコンセプト提案です。参考にしつつ、独自の視点で要件を生成してください。
そのまま採用する必要はありません。より良いアイデアがあれば自由に変更してください。

$(cat "$DESIGN_CONTEXT")"
fi

# 制約条件をプロンプトに追加
CONSTRAINTS_CONTEXT=""
if [[ -n "$CONSTRAINTS_PROMPT" ]]; then
  CONSTRAINTS_CONTEXT="

## 制約条件
以下の制約条件が設定されています。アプリ案の構想・技術スタック選定・機能スコープに反映してください。
${CONSTRAINTS_PROMPT}"
fi

PROMPT="以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${TARGET_DIR}
keyword.jsonパス: ${KEYWORD_FILE}
${EXTRA_CONTEXT}
${CONSTRAINTS_CONTEXT}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

echo ""

# =============================================================================
# Phase 4: Review（reviewer ロール）
# =============================================================================
if can_run_role "reviewer"; then
  # 新規生成されたアプリを検出
  APPS_AFTER=$(ls -1 "${REQUIREMENTS_DIR}" 2>/dev/null || true)
  NEW_APPS=$(comm -13 <(echo "$APPS_BEFORE" | sort) <(echo "$APPS_AFTER" | sort) 2>/dev/null || true)

  if [[ -n "$NEW_APPS" ]]; then
    for app_name in $NEW_APPS; do
      run_review_phase "$app_name"
    done
  else
    echo "--- Phase 4: Review ---"
    echo "  新規アプリが検出されませんでした。レビューをスキップします。"
  fi
  echo ""
fi

echo "=== 要件生成完了 ==="
