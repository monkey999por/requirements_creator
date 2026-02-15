#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

SKILL_FILE=".claude/skills/extract-keywords/SKILL.md"

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
source "${SCRIPT_DIR}/lib/select-source.sh"
resolve_target_dir "$TARGET_DIR"

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
setup_cleanup_trap "rm -f \"$PROMPT_FILE\""

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

run_claude_stream claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(ls:*)" "Bash(find:*)"  \
  --dangerously-skip-permissions
