#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SKILL_FILE=".claude/skills/extract-keywords/SKILL.md"

# --- 出力先ベースディレクトリの読み込み ---
OUTPUT_BASE=$(grep '^output_base_dir:' app.config.yaml 2>/dev/null | sed 's/^output_base_dir:[[:space:]]*//' | tr -d ' "'"'" || true)
if [[ -z "$OUTPUT_BASE" ]]; then OUTPUT_BASE="gen"; fi
DATA_SOURCE_DIR="${OUTPUT_BASE}/data_source"

# --- 共通関数の読み込み ---
source "$(cd "$(dirname "$0")" && pwd)/lib/select-source.sh"

# --- 引数処理 ---
TARGET_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--target <data_source_subdir>]"
      echo ""
      echo "収集データからキーワードを抽出し keyword.json を生成します。"
      echo ""
      echo "Options:"
      echo "  --target  data_source配下のサブディレクトリ名（省略時は最新）"
      exit 0
      ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- 対象ディレクトリの決定 ---
# 1. --target オプション → 2. app.config.yaml の pipeline.default_source → 3. 対話選択（直近7件）
if [[ -z "$TARGET_DIR" ]]; then
  CONFIG_SOURCE=$(grep '^  default_source:' app.config.yaml 2>/dev/null | sed 's/^  default_source:[[:space:]]*//' | tr -d ' "'"'" || true)
  if [[ -n "$CONFIG_SOURCE" ]]; then
    TARGET_DIR="$CONFIG_SOURCE"
  else
    if ! select_data_source "$DATA_SOURCE_DIR"; then
      exit 1
    fi
    TARGET_DIR="$SELECTED_SOURCE"
  fi
fi

DATA_DIR="${DATA_SOURCE_DIR}/${TARGET_DIR}"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "エラー: ${DATA_DIR} が存在しません。"
  exit 1
fi

# データファイルが1つ以上存在するか（*.json（keyword.json除く）/ *.md / *.txt）
JSON_COUNT=$(find "$DATA_DIR" -maxdepth 1 -name "*.json" ! -name "keyword.json" | wc -l | tr -d ' ')
TEXT_COUNT=$(find "$DATA_DIR" -maxdepth 1 \( -name "*.md" -o -name "*.txt" \) | wc -l | tr -d ' ')

if [[ "$JSON_COUNT" -eq 0 ]] && [[ "$TEXT_COUNT" -eq 0 ]]; then
  echo "エラー: ${DATA_DIR} にデータファイル（*.json / *.md / *.txt）がありません。"
  exit 1
fi

FILE_DESC="${JSON_COUNT} JSONファイル"
if [[ "$TEXT_COUNT" -gt 0 ]]; then
  FILE_DESC="${FILE_DESC} + ${TEXT_COUNT} テキストファイル"
fi

# --- 連想モード設定の読み込み ---
ASSOCIATION_ENABLED=$(awk '/^extract:/{found=1} found && /association:/{in_assoc=1} in_assoc && /enabled:/{print $2; exit}' app.config.yaml 2>/dev/null || true)
ASSOCIATION_DEPTH=$(awk '/^extract:/{found=1} found && /association:/{in_assoc=1} in_assoc && /depth:/{print $2; exit}' app.config.yaml 2>/dev/null || true)

# デフォルト値
if [[ -z "$ASSOCIATION_ENABLED" ]]; then ASSOCIATION_ENABLED="true"; fi
if [[ -z "$ASSOCIATION_DEPTH" ]]; then ASSOCIATION_DEPTH="moderate"; fi

echo "=== キーワード抽出 ==="
echo "対象: ${DATA_DIR} (${FILE_DESC})"
echo "連想モード: ${ASSOCIATION_ENABLED} (深さ: ${ASSOCIATION_DEPTH})"
echo ""

# --- スキル内容からシステムプロンプトファイルを作成 ---
PROMPT_FILE=$(mktemp)
CHILD_PID=""

cleanup() {
  echo "" >&2
  echo "中断シグナルを受信しました。スクリプトを終了しています..." >&2
  if [[ -n "$CHILD_PID" ]]; then
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  rm -f "$PROMPT_FILE"
  exit 130
}

trap cleanup SIGINT SIGTERM
trap 'rm -f "$PROMPT_FILE"' EXIT

# フロントマターを除去してスキル本文を抽出
awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$SKILL_FILE" > "$PROMPT_FILE"

# --- Claude Code CLI で実行 ---
ASSOCIATION_INSTRUCTION=""
if [[ "$ASSOCIATION_ENABLED" == "true" ]]; then
  ASSOCIATION_INSTRUCTION="
連想モード: 有効（深さ: ${ASSOCIATION_DEPTH}）
連想ゲーム方式でキーワードを抽出してください。直接抽出に加え、${ASSOCIATION_DEPTH}レベルの連想キーワードも含めてください。"
else
  ASSOCIATION_INSTRUCTION="
連想モード: 無効
収集データに直接記載されているキーワードのみを抽出してください。連想・推測による追加は行わないでください。"
fi

PROMPT="${DATA_SOURCE_DIR}/${TARGET_DIR}/ 配下の収集データを読み込み、上記のキーワード抽出スキルの手順に従ってキーワードとトレンドを抽出してください。
対象ディレクトリ: ${TARGET_DIR}
出力先: ${DATA_SOURCE_DIR}/${TARGET_DIR}/keyword.json
${ASSOCIATION_INSTRUCTION}"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(ls:*)" "Bash(find:*)"  \
  --dangerously-skip-permissions &
CHILD_PID=$!
wait $CHILD_PID
CHILD_PID=""
