#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# --- 一時ファイル管理 ---
SKIP_AGENTS=false

# --- 引数処理 ---
TARGET_DIR=""
DATASET_SOURCE=""
DATASET_NAME=""
DIRECT_MODE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    --dataset-source) DATASET_SOURCE="$2"; shift 2 ;;
    --dataset-name) DATASET_NAME="$2"; shift 2 ;;
    --skip-agents) SKIP_AGENTS=true; shift ;;
    --direct) DIRECT_MODE=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--target <data_source_subdir>] [--dataset-source <file> --dataset-name <name>] [--skip-agents] [--direct]"
      echo ""
      echo "keyword.json、テキストデータ、またはデータセットソースを元にアプリ要件を生成します。"
      echo ""
      echo "Options:"
      echo "  --target          data_source配下のサブディレクトリ名（省略時は最新）"
      echo "  --dataset-source  データセットソースファイルパス"
      echo "  --dataset-name    データセット名"
      echo "  --skip-agents     外部エージェント（codex/gemini）をスキップ"
      echo "  --direct          キーワード抽出をスキップし、テキストデータから直接要件生成"
      exit 0
      ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# =============================================================================
# ログ出力ヘルパー
# =============================================================================
pipeline_log() {
  local level="$1" step="$2" message="$3"
  if [[ -n "${PIPELINE_LOG_FILE:-}" ]]; then
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    echo "{\"timestamp\":\"${timestamp}\",\"level\":\"${level}\",\"step\":\"${step}\",\"message\":\"${message}\"}" >> "$PIPELINE_LOG_FILE"
  fi
}

# =============================================================================
# 共通関数の読み込み
# =============================================================================
source "${SCRIPT_DIR}/lib/generate-helpers.sh"

init_agent_tmpdir

read_constraints
CONSTRAINTS_PROMPT=$(format_constraints_prompt)

read_perspectives
PERSPECTIVES_PROMPT=$(format_perspectives_prompt)

# =============================================================================
# スキル内容とテンプレートを結合してシステムプロンプトファイルを作成
# =============================================================================
PROMPT_FILE=$(mktemp)
setup_cleanup_trap "rm -rf \"$TMPDIR_AGENTS\" \"$PROMPT_FILE\""

create_prompt_file "$PROMPT_FILE"

# --- 生成前のアプリ一覧を記録（新規アプリ検出用、全モード共通） ---
APPS_BEFORE=$(ls -1 "${REQUIREMENTS_DIR}" 2>/dev/null || true)

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

  run_claude_stream claude -p "$PROMPT" \
    --append-system-prompt-file "$PROMPT_FILE" \
    --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

  copy_config_to_new_apps
  exit 0
fi

# =============================================================================
# ダイレクトモード・通常モード共通: 対象ディレクトリ決定
# =============================================================================
resolve_target_dir "$TARGET_DIR"

# =============================================================================
# ダイレクトモード（テキストデータから直接要件生成、keyword.json不要）
# =============================================================================
if $DIRECT_MODE; then
  DATA_DIR="${DATA_SOURCE_DIR}/${TARGET_DIR}"
  if [[ ! -d "$DATA_DIR" ]]; then
    echo "エラー: ${DATA_DIR} が存在しません。"
    exit 1
  fi

  # テキストファイルの存在確認（*.json（keyword.json除く）/ *.md / *.txt）
  TEXT_FILES=$(find "$DATA_DIR" -maxdepth 1 \( -name "*.md" -o -name "*.txt" -o \( -name "*.json" ! -name "keyword.json" \) \) | sort)
  if [[ -z "$TEXT_FILES" ]]; then
    echo "エラー: ${DATA_DIR} にデータファイルがありません。"
    exit 1
  fi

  FILE_LIST=$(echo "$TEXT_FILES" | while read -r f; do basename "$f"; done | paste -sd ", " -)
  echo "=== 要件生成（ダイレクトモード） ==="
  echo "対象: ${DATA_DIR}"
  echo "ファイル: ${FILE_LIST}"
  echo ""

  print_constraints

  CONSTRAINTS_CONTEXT=$(build_constraints_context)
  PERSPECTIVES_CONTEXT=$(build_perspectives_context)

  PROMPT="以下のディレクトリ内のテキストデータを全て読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${DATA_DIR}

これはダイレクトモードです。keyword.jsonは使用しません。
テキストデータの内容を直接読み込み、そこからアプリのアイデアを構想してください。
ユーザーが書いた提案やメモがそのまま含まれている可能性があります。
内容の意図を尊重し、キーワード抽出を介さずに直接要件を詳細化してください。

_source_info.json の source.directory には「${TARGET_DIR}」を、
keywords 配列は空配列 [] としてください。
description にはテキストデータからどのようにアプリ案を導いたかの経緯を記載してください。
${CONSTRAINTS_CONTEXT}
${PERSPECTIVES_CONTEXT}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

  run_claude_stream claude -p "$PROMPT" \
    --append-system-prompt-file "$PROMPT_FILE" \
    --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

  copy_config_to_new_apps
  exit 0
fi

# =============================================================================
# 通常モード（keyword.jsonベース）
# =============================================================================
KEYWORD_FILE="${DATA_SOURCE_DIR}/${TARGET_DIR}/keyword.json"
if [[ ! -f "$KEYWORD_FILE" ]]; then
  echo "エラー: ${KEYWORD_FILE} が見つかりません。先に /extract-keywords を実行するか、--direct オプションを使用してください。"
  exit 1
fi

echo "=== 要件生成 ==="
echo "対象: ${KEYWORD_FILE}"
echo ""

pipeline_log "info" "generate" "要件生成開始: ${KEYWORD_FILE}"

print_agent_settings
print_constraints
print_perspectives

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

EXTRA_CONTEXT=$(build_agent_extra_context)
CONSTRAINTS_CONTEXT=$(build_constraints_context)
PERSPECTIVES_CONTEXT=$(build_perspectives_context)

PROMPT="以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${TARGET_DIR}
keyword.jsonパス: ${KEYWORD_FILE}
${EXTRA_CONTEXT}
${CONSTRAINTS_CONTEXT}
${PERSPECTIVES_CONTEXT}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

run_claude_stream claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"

copy_config_to_new_apps
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
pipeline_log "info" "generate" "要件生成完了"

# --- Slack通知 ---
# pipeline.ts 経由の場合はそちらで通知するため、ここでは generate 単体実行時のみ通知
if [[ -z "${PIPELINE_MODE:-}" ]]; then
  # 新規アプリを検出（reviewer実行済みの場合は再利用、未実行の場合は検出）
  if [[ -z "${NEW_APPS:-}" ]]; then
    APPS_AFTER_NOTIFY=$(ls -1 "${REQUIREMENTS_DIR}" 2>/dev/null || true)
    NEW_APPS=$(comm -13 <(echo "$APPS_BEFORE" | sort) <(echo "$APPS_AFTER_NOTIFY" | sort) 2>/dev/null || true)
  fi
  tsx scripts/lib/slack.ts generate $NEW_APPS 2>/dev/null || true
fi
