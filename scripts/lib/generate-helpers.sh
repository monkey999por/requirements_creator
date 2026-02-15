#!/usr/bin/env bash
# =============================================================================
# generate-helpers.sh — generate.sh / regenerate.sh 共通関数
# =============================================================================
#
# 呼び出し元で以下の変数が設定済みであること:
#   CONFIG_FILE        — app.config.yaml のパス
#   REQUIREMENTS_DIR   — gen/requirements のパス
#   SKIP_AGENTS        — true/false
#   TMPDIR_AGENTS      — 一時ファイルディレクトリ
#   RESEARCH_CONTEXT   — リサーチ結果ファイルパス
#   DESIGN_CONTEXT     — 設計提案ファイルパス
#   REVIEW_RESULT      — レビュー結果ファイルパス
# =============================================================================

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

  # tech_stack の読み込み
  CONSTRAINT_TS_FRONTEND=$(echo "$block" | awk '/tech_stack:/{c=1} c && /frontend:/{gsub(/^[^:]+:[[:space:]]*/, ""); print; exit}' | tr -d '"'"'" || true)
  CONSTRAINT_TS_BACKEND=$(echo "$block" | awk '/tech_stack:/{c=1} c && /backend:/{gsub(/^[^:]+:[[:space:]]*/, ""); print; exit}' | tr -d '"'"'" || true)
  CONSTRAINT_TS_DATABASE=$(echo "$block" | awk '/tech_stack:/{c=1} c && /database:/{gsub(/^[^:]+:[[:space:]]*/, ""); print; exit}' | tr -d '"'"'" || true)
  CONSTRAINT_TS_HOSTING=$(echo "$block" | awk '/tech_stack:/{c=1} c && /hosting:/{gsub(/^[^:]+:[[:space:]]*/, ""); print; exit}' | tr -d '"'"'" || true)
  CONSTRAINT_TS_AUTH=$(echo "$block" | awk '/tech_stack:/{c=1} c && /auth:/{gsub(/^[^:]+:[[:space:]]*/, ""); print; exit}' | tr -d '"'"'" || true)
  # other: リスト（"- value" 形式）を読み取り
  CONSTRAINT_TS_OTHER=$(echo "$block" | awk '/tech_stack:/{ts=1} ts && /other:/{o=1; next} o && /^[[:space:]]*- /{gsub(/^[[:space:]]*- */, ""); items=items sep $0; sep=", "; next} o && !/^[[:space:]]*-/{o=0} END{print items}' | tr -d '"'"'" || true)
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

  # tech_stack の組み立て
  local ts_parts=()
  [[ -n "$CONSTRAINT_TS_FRONTEND" ]] && ts_parts+=("Frontend: ${CONSTRAINT_TS_FRONTEND}")
  [[ -n "$CONSTRAINT_TS_BACKEND" ]] && ts_parts+=("Backend: ${CONSTRAINT_TS_BACKEND}")
  [[ -n "$CONSTRAINT_TS_DATABASE" ]] && ts_parts+=("Database: ${CONSTRAINT_TS_DATABASE}")
  [[ -n "$CONSTRAINT_TS_HOSTING" ]] && ts_parts+=("Hosting: ${CONSTRAINT_TS_HOSTING}")
  [[ -n "$CONSTRAINT_TS_AUTH" ]] && ts_parts+=("Auth: ${CONSTRAINT_TS_AUTH}")
  [[ -n "$CONSTRAINT_TS_OTHER" ]] && ts_parts+=("Other services/libraries: ${CONSTRAINT_TS_OTHER}")

  if [[ ${#parts[@]} -eq 0 && ${#ts_parts[@]} -eq 0 ]]; then
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

  if [[ ${#ts_parts[@]} -gt 0 ]]; then
    result="${result}
REQUIRED TECHNOLOGY STACK (these technologies MUST be used as the base. You may add supplementary tools/libraries but MUST NOT replace these):
"
    for tp in "${ts_parts[@]}"; do
      result="${result}- ${tp}
"
    done
  fi

  result="${result}
Design the app so that it can realistically be built and operated within these constraints. Choose appropriate technology stack and scope accordingly."
  echo "$result"
}

# =============================================================================
# 生成観点（perspectives）の読み込み
# =============================================================================

VALID_PERSPECTIVES="kindness cunning frustration dopamine target-focus"

# 観点の説明マップ（プロンプト生成用）
perspective_description() {
  case "$1" in
    kindness)     echo "User-friendly & empathetic UX design: prioritize accessibility, gentle onboarding, forgiving error handling, and inclusive design. The app should feel warm, supportive, and easy to use for everyone." ;;
    cunning)      echo "Clever monetization & behavioral design: smart business model, strategic feature gating, viral loops, and network effects. Not dark patterns, but ingeniously designed value capture." ;;
    frustration)  echo "Frustration-driven design: use free-tier limitations, wait times, and restricted features to drive upgrades. Create moments of friction that make the premium experience feel essential." ;;
    dopamine)     echo "Addictive experience design: gamification, reward loops, streaks, progress bars, social validation, surprise rewards, and variable-ratio reinforcement. Maximize engagement and retention." ;;
    target-focus) echo "Hyper-targeted niche optimization: deeply understand a specific user segment's workflows, pain points, and language. Build features that feel tailor-made for this audience." ;;
    *)            echo "Unknown perspective: $1" ;;
  esac
}

read_perspectives() {
  local block
  block=$(awk '/^generate:/{found=1} found && /^[^ ]/ && !/^generate:/{found=0} found{print}' "$CONFIG_FILE" 2>/dev/null || true)

  PERSPECTIVE_MODE=$(echo "$block" | awk '/perspectives:/{p=1} p && /mode:/{print $2; exit}' | tr -d ' "'"'" || true)
  PERSPECTIVE_ITEMS=""
  if [[ -n "$PERSPECTIVE_MODE" ]]; then
    PERSPECTIVE_ITEMS=$(echo "$block" | awk '
      /perspectives:/{p=1; next}
      p && /items:/{i=1; next}
      i && /^[[:space:]]*- /{gsub(/^[[:space:]]*- */, ""); items=items sep $0; sep=" "; next}
      i && !/^[[:space:]]*-/{i=0}
      p && /^[[:space:]]{4}[a-z]/ && !/items:/ && !/mode:/{p=0}
    ' | tr -d '"'"'" || true)
  fi
}

# 観点をプロンプト用テキストに変換
# randomモードの場合、ここでランダム選択を行う
format_perspectives_prompt() {
  if [[ -z "$PERSPECTIVE_MODE" ]]; then
    echo ""
    return
  fi

  local selected_items=""

  case "$PERSPECTIVE_MODE" in
    single)
      # items の先頭1つだけ
      selected_items=$(echo "$PERSPECTIVE_ITEMS" | awk '{print $1}')
      ;;
    combine)
      # items をそのまま使用
      selected_items="$PERSPECTIVE_ITEMS"
      ;;
    random)
      # 定義済み観点からランダムに1〜3個選択
      local count=$(( (RANDOM % 3) + 1 ))
      local all_perspectives=($VALID_PERSPECTIVES)
      local shuffled=()
      # Fisher-Yates シャッフル
      local n=${#all_perspectives[@]}
      for (( i = n - 1; i > 0; i-- )); do
        local j=$(( RANDOM % (i + 1) ))
        local tmp="${all_perspectives[$i]}"
        all_perspectives[$i]="${all_perspectives[$j]}"
        all_perspectives[$j]="$tmp"
      done
      for (( i = 0; i < count; i++ )); do
        shuffled+=("${all_perspectives[$i]}")
      done
      selected_items="${shuffled[*]}"
      ;;
    *)
      echo ""
      return
      ;;
  esac

  if [[ -z "$selected_items" ]]; then
    echo ""
    return
  fi

  # グローバル変数にセット（_source_info.json 記録用）
  RESOLVED_PERSPECTIVES="$selected_items"
  RESOLVED_PERSPECTIVE_MODE="$PERSPECTIVE_MODE"

  local result="

DESIGN PERSPECTIVES (these perspectives MUST shape the app's UX, features, and monetization strategy):
Mode: ${PERSPECTIVE_MODE}
Applied perspectives:
"
  for item in $selected_items; do
    local desc
    desc=$(perspective_description "$item")
    result="${result}
- **${item}**: ${desc}
"
  done

  result="${result}
Integrate these perspectives deeply into the app concept, feature design, user flows, and monetization model. They should be reflected in the overview, feature specs, and diagrams."

  echo "$result"
}

# =============================================================================
# エージェント設定読み込み
# =============================================================================

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
        in_roles=false
        in_agent=false
      fi
    fi
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
# 一時ファイル初期化（generate.sh / regenerate.sh 共通）
# =============================================================================
init_agent_tmpdir() {
  TMPDIR_AGENTS=$(mktemp -d)
  RESEARCH_CONTEXT="${TMPDIR_AGENTS}/research_context.md"
  DESIGN_CONTEXT="${TMPDIR_AGENTS}/design_context.md"
  REVIEW_RESULT="${TMPDIR_AGENTS}/review_result.md"
}

# =============================================================================
# 新規生成アプリへの設定ファイルコピー（generate.sh 用）
# 呼び出し元で APPS_BEFORE が設定済みであること
# =============================================================================
copy_config_to_new_apps() {
  local apps_after
  apps_after=$(ls -1 "${REQUIREMENTS_DIR}" 2>/dev/null || true)
  local new_apps
  new_apps=$(comm -13 <(echo "$APPS_BEFORE" | sort) <(echo "$apps_after" | sort) 2>/dev/null || true)

  if [[ -n "$new_apps" ]]; then
    for app_name in $new_apps; do
      cp "$CONFIG_FILE" "${REQUIREMENTS_DIR}/${app_name}/_config.yaml"
      echo "  設定ファイルをコピー: ${app_name}/_config.yaml"
    done
  fi
}

# =============================================================================
# エージェント設定の表示（generate.sh / regenerate.sh 共通）
# =============================================================================
print_agent_settings() {
  if $SKIP_AGENTS; then return; fi
  echo "--- エージェント設定 ---"
  for agent in codex gemini; do
    if get_agent_enabled "$agent"; then
      local local_model
      local_model=$(get_agent_model "$agent")
      echo "  ${agent}: enabled (model: ${local_model:-default})"
    else
      echo "  ${agent}: disabled"
    fi
  done
  echo ""
}

# =============================================================================
# 制約条件の表示（generate.sh のダイレクト・通常モード共通）
# =============================================================================
print_constraints() {
  local has_constraints=false
  [[ -n "$CONSTRAINT_PLATFORM" || -n "$CONSTRAINT_BUDGET" || -n "$CONSTRAINT_DIFFICULTY" || -n "$CONSTRAINT_TEAM_SIZE" ]] && has_constraints=true
  [[ -n "$CONSTRAINT_TS_FRONTEND" || -n "$CONSTRAINT_TS_BACKEND" || -n "$CONSTRAINT_TS_DATABASE" || -n "$CONSTRAINT_TS_HOSTING" || -n "$CONSTRAINT_TS_AUTH" || -n "$CONSTRAINT_TS_OTHER" ]] && has_constraints=true

  if $has_constraints; then
    echo "--- 制約条件 ---"
    [[ -n "$CONSTRAINT_PLATFORM" ]] && echo "  platform: ${CONSTRAINT_PLATFORM}"
    [[ -n "$CONSTRAINT_BUDGET" ]] && echo "  budget: ${CONSTRAINT_BUDGET}"
    [[ -n "$CONSTRAINT_DIFFICULTY" ]] && echo "  difficulty: ${CONSTRAINT_DIFFICULTY}"
    [[ -n "$CONSTRAINT_TEAM_SIZE" ]] && echo "  team_size: ${CONSTRAINT_TEAM_SIZE}"
    if [[ -n "$CONSTRAINT_TS_FRONTEND" || -n "$CONSTRAINT_TS_BACKEND" || -n "$CONSTRAINT_TS_DATABASE" || -n "$CONSTRAINT_TS_HOSTING" || -n "$CONSTRAINT_TS_AUTH" || -n "$CONSTRAINT_TS_OTHER" ]]; then
      echo "  tech_stack:"
      [[ -n "$CONSTRAINT_TS_FRONTEND" ]] && echo "    frontend: ${CONSTRAINT_TS_FRONTEND}"
      [[ -n "$CONSTRAINT_TS_BACKEND" ]] && echo "    backend: ${CONSTRAINT_TS_BACKEND}"
      [[ -n "$CONSTRAINT_TS_DATABASE" ]] && echo "    database: ${CONSTRAINT_TS_DATABASE}"
      [[ -n "$CONSTRAINT_TS_HOSTING" ]] && echo "    hosting: ${CONSTRAINT_TS_HOSTING}"
      [[ -n "$CONSTRAINT_TS_AUTH" ]] && echo "    auth: ${CONSTRAINT_TS_AUTH}"
      [[ -n "$CONSTRAINT_TS_OTHER" ]] && echo "    other: ${CONSTRAINT_TS_OTHER}"
    fi
    echo ""
  fi
}

# =============================================================================
# 生成観点の表示
# =============================================================================
print_perspectives() {
  if [[ -n "$PERSPECTIVE_MODE" ]]; then
    echo "--- 生成観点 ---"
    echo "  mode: ${PERSPECTIVE_MODE}"
    if [[ -n "${RESOLVED_PERSPECTIVES:-}" ]]; then
      echo "  items: ${RESOLVED_PERSPECTIVES}"
    elif [[ -n "$PERSPECTIVE_ITEMS" ]]; then
      echo "  items: ${PERSPECTIVE_ITEMS}"
    fi
    echo ""
  fi
}

# =============================================================================
# 制約/観点のプロンプトコンテキスト生成（generate.sh 共通）
# =============================================================================
build_constraints_context() {
  if [[ -n "$CONSTRAINTS_PROMPT" ]]; then
    echo "
## 制約条件
以下の制約条件が設定されています。アプリ案の構想・技術スタック選定・機能スコープに反映してください。
${CONSTRAINTS_PROMPT}"
  fi
}

build_perspectives_context() {
  if [[ -n "$PERSPECTIVES_PROMPT" ]]; then
    echo "
## 生成観点
以下の生成観点が設定されています。アプリの体験設計・機能設計・マネタイズ戦略に深く反映してください。
また、_source_info.json の perspectives フィールドに適用した観点を記録してください。
${PERSPECTIVES_PROMPT}"
  fi
}

# =============================================================================
# 外部エージェントコンテキスト統合（generate.sh / regenerate.sh 共通）
# =============================================================================
build_agent_extra_context() {
  local extra=""
  if [[ -f "$RESEARCH_CONTEXT" ]]; then
    extra="${extra}

## 外部リサーチ結果（参考情報）
以下は外部エージェントによるトレンド・市場調査の結果です。アプリ案の構想に活用してください。

$(cat "$RESEARCH_CONTEXT")"
  fi

  if [[ -f "$DESIGN_CONTEXT" ]]; then
    extra="${extra}

## 外部エージェントによる設計提案（参考情報）
以下は外部エージェントによるアプリコンセプト提案です。参考にしつつ、独自の視点で要件を生成してください。
そのまま採用する必要はありません。より良いアイデアがあれば自由に変更してください。

$(cat "$DESIGN_CONTEXT")"
  fi

  echo "$extra"
}

# =============================================================================
# エージェント実行共通関数
# =============================================================================

# 指定エージェント（codex/gemini）でプロンプトを実行し、結果をファイルに保存
# 引数: agent prompt output_file
run_agent() {
  local agent="$1"
  local prompt="$2"
  local output_file="$3"

  if [[ "$agent" == "gemini" ]]; then
    gemini -p "$prompt" 2>/dev/null > "$output_file" || true
  elif [[ "$agent" == "codex" ]]; then
    local model
    model=$(get_agent_model "$agent")
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "$prompt" 2>/dev/null > "$output_file" || true
  fi
}

# エージェント実行結果の表示
# 引数: label output_file
print_agent_result() {
  local label="$1"
  local output_file="$2"

  if [[ -s "$output_file" ]]; then
    echo "  ${label}: $(wc -l < "$output_file") 行"
  else
    echo "  ${label}: なし（スキップ）"
    rm -f "$output_file"
  fi
}

# =============================================================================
# フェーズ実行関数
# =============================================================================

run_research_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "researcher") || return 0

  echo "--- Phase 1: Research ($agent) ---"

  local keywords
  keywords=$(cat "$keyword_file")

  run_agent "$agent" "
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
" "$RESEARCH_CONTEXT"

  print_agent_result "リサーチ結果" "$RESEARCH_CONTEXT"
}

run_design_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "designer") || return 0

  echo "--- Phase 2: Design ($agent) ---"

  local keywords
  keywords=$(cat "$keyword_file")

  local research_input=""
  if [[ -f "$RESEARCH_CONTEXT" ]]; then
    research_input="

Additional research context:
$(cat "$RESEARCH_CONTEXT")"
  fi

  run_agent "$agent" "
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
" "$DESIGN_CONTEXT"

  print_agent_result "設計提案" "$DESIGN_CONTEXT"
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

  run_agent "$agent" "
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
" "$REVIEW_RESULT"

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
# プロンプトファイル作成
# =============================================================================
# SKILL.md のフロントマターを除去し、templates.md を結合したプロンプトファイルを作成
# 引数: 出力先ファイルパス
# 呼び出し元で PROJECT_ROOT が設定済みであること
create_prompt_file() {
  local output_path="$1"
  local skill_file="${PROJECT_ROOT}/.claude/skills/generate-requirements/SKILL.md"
  local templates_file="${PROJECT_ROOT}/.claude/skills/generate-requirements/templates.md"

  awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$skill_file" > "$output_path"
  echo "" >> "$output_path"
  echo "---" >> "$output_path"
  echo "" >> "$output_path"
  cat "$templates_file" >> "$output_path"
}
