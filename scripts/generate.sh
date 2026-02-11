#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

CONFIG_FILE="app.config.yaml"

# --- 出力先ベースディレクトリの読み込み ---
OUTPUT_BASE=$(grep '^output_base_dir:' "$CONFIG_FILE" 2>/dev/null | sed 's/^output_base_dir:[[:space:]]*//' | tr -d ' "'"'" || true)
if [[ -z "$OUTPUT_BASE" ]]; then OUTPUT_BASE="gen"; fi
DATA_SOURCE_DIR="${OUTPUT_BASE}/data_source"
REQUIREMENTS_DIR="${OUTPUT_BASE}/requirements"

# --- 一時ファイル管理 ---
TMPDIR_AGENTS=$(mktemp -d)
CHILD_PID=""

cleanup() {
  echo "" >&2
  echo "中断シグナルを受信しました。スクリプトを終了しています..." >&2
  if [[ -n "$CHILD_PID" ]]; then
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  rm -rf "$TMPDIR_AGENTS" "${PROMPT_FILE:-}"
  exit 130
}

trap cleanup SIGINT SIGTERM
trap 'rm -rf "$TMPDIR_AGENTS"' EXIT

# シグナル割り込み可能な外部コマンド実行ヘルパー
# バックグラウンド実行 + wait により、trapがコマンド実行中でも発火可能になる
run_interruptible() {
  "$@" &
  CHILD_PID=$!
  wait $CHILD_PID
  local status=$?
  CHILD_PID=""
  return $status
}
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
# 共通関数の読み込み
# =============================================================================
source "${SCRIPT_DIR}/lib/generate-helpers.sh"

read_constraints
CONSTRAINTS_PROMPT=$(format_constraints_prompt)

read_perspectives
PERSPECTIVES_PROMPT=$(format_perspectives_prompt)

# =============================================================================
# スキル内容とテンプレートを結合してシステムプロンプトファイルを作成
# =============================================================================
PROMPT_FILE=$(mktemp)
trap 'rm -rf "$TMPDIR_AGENTS" "$PROMPT_FILE"' EXIT

create_prompt_file "$PROMPT_FILE"

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

  run_interruptible claude -p "$PROMPT" \
    --append-system-prompt-file "$PROMPT_FILE" \
    --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

  exit 0
fi

# =============================================================================
# 通常モード（keyword.jsonベース）
# =============================================================================
# 1. --target オプション → 2. app.config.yaml の pipeline.default_source → 3. 最新ディレクトリ自動検出
if [[ -z "$TARGET_DIR" ]]; then
  CONFIG_SOURCE=$(grep '^  default_source:' "$CONFIG_FILE" 2>/dev/null | sed 's/^  default_source:[[:space:]]*//' | tr -d ' "'"'" || true)
  if [[ -n "$CONFIG_SOURCE" ]]; then
    TARGET_DIR="$CONFIG_SOURCE"
  else
    TARGET_DIR=$(ls -1d "${DATA_SOURCE_DIR}"/*/ 2>/dev/null | xargs -n1 basename | sort | tail -1)
  fi
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
HAS_CONSTRAINTS=false
[[ -n "$CONSTRAINT_PLATFORM" || -n "$CONSTRAINT_BUDGET" || -n "$CONSTRAINT_DIFFICULTY" || -n "$CONSTRAINT_TEAM_SIZE" ]] && HAS_CONSTRAINTS=true
[[ -n "$CONSTRAINT_TS_FRONTEND" || -n "$CONSTRAINT_TS_BACKEND" || -n "$CONSTRAINT_TS_DATABASE" || -n "$CONSTRAINT_TS_HOSTING" || -n "$CONSTRAINT_TS_AUTH" || -n "$CONSTRAINT_TS_OTHER" ]] && HAS_CONSTRAINTS=true

if $HAS_CONSTRAINTS; then
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

# --- 生成観点の表示 ---
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

# 生成観点をプロンプトに追加
PERSPECTIVES_CONTEXT=""
if [[ -n "$PERSPECTIVES_PROMPT" ]]; then
  PERSPECTIVES_CONTEXT="

## 生成観点
以下の生成観点が設定されています。アプリの体験設計・機能設計・マネタイズ戦略に深く反映してください。
また、_source_info.json の perspectives フィールドに適用した観点を記録してください。
${PERSPECTIVES_PROMPT}"
fi

PROMPT="以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${TARGET_DIR}
keyword.jsonパス: ${KEYWORD_FILE}
${EXTRA_CONTEXT}
${CONSTRAINTS_CONTEXT}
${PERSPECTIVES_CONTEXT}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

run_interruptible claude -p "$PROMPT" \
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
