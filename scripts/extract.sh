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
# 1. --target オプション → 2. app.config.yaml の pipeline.default_source → 3. 最新ディレクトリ自動検出
if [[ -z "$TARGET_DIR" ]]; then
  CONFIG_SOURCE=$(grep '^  default_source:' app.config.yaml 2>/dev/null | sed 's/^  default_source:[[:space:]]*//' | tr -d ' "'"'" || true)
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

DATA_DIR="${DATA_SOURCE_DIR}/${TARGET_DIR}"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "エラー: ${DATA_DIR} が存在しません。"
  exit 1
fi

# データファイルが1つ以上存在するか（*.json（keyword.json除く）または user_proposal.md）
JSON_COUNT=$(find "$DATA_DIR" -maxdepth 1 -name "*.json" ! -name "keyword.json" | wc -l | tr -d ' ')
HAS_PROPOSAL=false
if [[ -f "${DATA_DIR}/user_proposal.md" ]]; then
  HAS_PROPOSAL=true
fi

if [[ "$JSON_COUNT" -eq 0 ]] && ! $HAS_PROPOSAL; then
  echo "エラー: ${DATA_DIR} にデータファイル（*.json / user_proposal.md）がありません。"
  exit 1
fi

FILE_DESC="${JSON_COUNT} JSONファイル"
if $HAS_PROPOSAL; then
  FILE_DESC="${FILE_DESC} + user_proposal.md"
fi

echo "=== キーワード抽出 ==="
echo "対象: ${DATA_DIR} (${FILE_DESC})"
echo ""

# --- スキル内容からシステムプロンプトファイルを作成 ---
PROMPT_FILE=$(mktemp)
trap 'rm -f "$PROMPT_FILE"' EXIT

# フロントマターを除去してスキル本文を抽出
awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$SKILL_FILE" > "$PROMPT_FILE"

# --- Claude Code CLI で実行 ---
PROMPT="${DATA_SOURCE_DIR}/${TARGET_DIR}/ 配下の収集データを読み込み、上記のキーワード抽出スキルの手順に従ってキーワードとトレンドを抽出してください。
対象ディレクトリ: ${TARGET_DIR}
出力先: ${DATA_SOURCE_DIR}/${TARGET_DIR}/keyword.json"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(ls:*)" "Bash(find:*)"  \
  --dangerously-skip-permissions
