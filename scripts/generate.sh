#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SKILL_FILE=".claude/skills/generate-requirements/SKILL.md"
TEMPLATES_FILE=".claude/skills/generate-requirements/templates.md"

# --- 引数処理 ---
TARGET_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--target <data_source_subdir>]"
      echo ""
      echo "keyword.jsonを元にアプリ要件を生成します。"
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
if [[ -z "$TARGET_DIR" ]]; then
  TARGET_DIR=$(ls -1d data_source/*/ 2>/dev/null | xargs -n1 basename | sort | tail -1)
  if [[ -z "$TARGET_DIR" ]]; then
    echo "エラー: data_source/ にデータがありません。先に pnpm collect を実行してください。"
    exit 1
  fi
fi

KEYWORD_FILE="data_source/${TARGET_DIR}/keyword.json"
if [[ ! -f "$KEYWORD_FILE" ]]; then
  echo "エラー: ${KEYWORD_FILE} が見つかりません。先に /extract-keywords を実行してください。"
  exit 1
fi

echo "=== 要件生成 ==="
echo "対象: ${KEYWORD_FILE}"
echo ""

# --- スキル内容とテンプレートを結合してシステムプロンプトファイルを作成 ---
PROMPT_FILE=$(mktemp)
trap 'rm -f "$PROMPT_FILE"' EXIT

# フロントマターを除去してスキル本文を抽出
awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$SKILL_FILE" > "$PROMPT_FILE"

# テンプレート内容を追加
echo "" >> "$PROMPT_FILE"
echo "---" >> "$PROMPT_FILE"
echo "" >> "$PROMPT_FILE"
cat "$TEMPLATES_FILE" >> "$PROMPT_FILE"

# --- Claude Code CLI で実行 ---
PROMPT="以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${TARGET_DIR}
keyword.jsonパス: ${KEYWORD_FILE}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"
