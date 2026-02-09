#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SKILL_FILE=".claude/skills/generate-requirements/SKILL.md"
TEMPLATES_FILE=".claude/skills/generate-requirements/templates.md"

# --- 出力先ベースディレクトリの読み込み ---
OUTPUT_BASE=$(grep '^output_base_dir:' app.config.yaml 2>/dev/null | sed 's/^output_base_dir:[[:space:]]*//' | tr -d ' "'"'" || true)
if [[ -z "$OUTPUT_BASE" ]]; then OUTPUT_BASE="gen"; fi
DATA_SOURCE_DIR="${OUTPUT_BASE}/data_source"

# --- 引数処理 ---
TARGET_DIR=""
DATASET_SOURCE=""
DATASET_NAME=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    --dataset-source) DATASET_SOURCE="$2"; shift 2 ;;
    --dataset-name) DATASET_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--target <data_source_subdir>] [--dataset-source <file> --dataset-name <name>]"
      echo ""
      echo "keyword.jsonまたはデータセットソースを元にアプリ要件を生成します。"
      echo ""
      echo "Options:"
      echo "  --target          data_source配下のサブディレクトリ名（省略時は最新）"
      echo "  --dataset-source  データセットソースファイルパス"
      echo "  --dataset-name    データセット名"
      exit 0
      ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

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

# --- データセットモード ---
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

# --- 通常モード（keyword.jsonベース） ---
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

# --- Claude Code CLI で実行 ---
PROMPT="以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${TARGET_DIR}
keyword.jsonパス: ${KEYWORD_FILE}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)"
