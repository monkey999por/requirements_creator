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
trap 'rm -rf "$TMPDIR_AGENTS"' EXIT
RESEARCH_CONTEXT="${TMPDIR_AGENTS}/research_context.md"
DESIGN_CONTEXT="${TMPDIR_AGENTS}/design_context.md"
REVIEW_RESULT="${TMPDIR_AGENTS}/review_result.md"

# --- 引数処理 ---
APP_NAME=""
MEMO_TEXT=""
SKIP_AGENTS=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --memo) MEMO_TEXT="$2"; shift 2 ;;
    --skip-agents) SKIP_AGENTS=true; shift ;;
    -h|--help)
      echo "Usage: $0 <app_name> [--memo \"text\"] [--skip-agents]"
      echo ""
      echo "既存アプリ要件をmemo.mdの内容を最優先指示として再生成します。"
      echo ""
      echo "Arguments:"
      echo "  app_name          再生成対象のアプリ名（gen/requirements/配下のディレクトリ名）"
      echo ""
      echo "Options:"
      echo "  --memo \"text\"      memo.mdに書き込むテキスト（上書き）"
      echo "  --skip-agents     外部エージェント（codex/gemini）をスキップ"
      exit 0
      ;;
    --) shift ;;
    -*)
      echo "Unknown option: $1"; exit 1 ;;
    *)
      if [[ -z "$APP_NAME" ]]; then
        APP_NAME="$1"; shift
      else
        echo "Unknown argument: $1"; exit 1
      fi
      ;;
  esac
done

if [[ -z "$APP_NAME" ]]; then
  echo "エラー: アプリ名を指定してください。"
  echo "Usage: $0 <app_name> [--memo \"text\"] [--skip-agents]"
  exit 1
fi

APP_DIR="${REQUIREMENTS_DIR}/${APP_NAME}"
if [[ ! -d "$APP_DIR" ]]; then
  echo "エラー: ${APP_DIR} が見つかりません。"
  exit 1
fi

# =============================================================================
# 共通関数の読み込み
# =============================================================================
source "${SCRIPT_DIR}/lib/generate-helpers.sh"

read_constraints
CONSTRAINTS_PROMPT=$(format_constraints_prompt)

read_perspectives
PERSPECTIVES_PROMPT=$(format_perspectives_prompt)

# =============================================================================
# memo.md の書き込み（--memo 指定時）
# =============================================================================
if [[ -n "$MEMO_TEXT" ]]; then
  echo "$MEMO_TEXT" > "${APP_DIR}/memo.md"
  echo "memo.md を更新しました。"
fi

# =============================================================================
# 既存データの読み込み
# =============================================================================
echo "=== 要件再生成 ==="
echo "対象: ${APP_NAME}"
echo ""

# memo.md
MEMO_CONTENT=""
if [[ -f "${APP_DIR}/memo.md" ]]; then
  MEMO_CONTENT=$(cat "${APP_DIR}/memo.md")
fi

if [[ -z "$MEMO_CONTENT" ]]; then
  echo "警告: memo.md が空または存在しません。フィードバックなしで再生成します。"
  echo ""
fi

# _source_info.json
SOURCE_INFO=""
if [[ -f "${APP_DIR}/_source_info.json" ]]; then
  SOURCE_INFO=$(cat "${APP_DIR}/_source_info.json")
fi

# overview.md
EXISTING_OVERVIEW=""
if [[ -f "${APP_DIR}/overview.md" ]]; then
  EXISTING_OVERVIEW=$(cat "${APP_DIR}/overview.md")
fi

# features/
EXISTING_FEATURES=""
for f in "${APP_DIR}"/features/*.md; do
  if [[ -f "$f" ]]; then
    EXISTING_FEATURES="${EXISTING_FEATURES}

--- $(basename "$f") ---
$(cat "$f")"
  fi
done

# diagrams/
EXISTING_DIAGRAMS=""
for f in "${APP_DIR}"/diagrams/*.md; do
  if [[ -f "$f" ]]; then
    EXISTING_DIAGRAMS="${EXISTING_DIAGRAMS}

--- $(basename "$f") ---
$(cat "$f")"
  fi
done

# 元の keyword.json を復元（_source_info.json の source.directory から）
KEYWORD_FILE=""
if [[ -n "$SOURCE_INFO" ]]; then
  SOURCE_DIR=$(echo "$SOURCE_INFO" | grep -o '"directory"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"directory"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
  # dataset:// プレフィックスでなければ通常のdata_sourceパス
  if [[ -n "$SOURCE_DIR" && ! "$SOURCE_DIR" =~ ^dataset:// ]]; then
    # "gen/data_source/xxx/" 形式からサブディレクトリ名を抽出
    SUB_DIR=$(basename "$SOURCE_DIR")
    CANDIDATE="${DATA_SOURCE_DIR}/${SUB_DIR}/keyword.json"
    if [[ -f "$CANDIDATE" ]]; then
      KEYWORD_FILE="$CANDIDATE"
      echo "元のkeyword.json: ${KEYWORD_FILE}"
    fi
  fi
fi

# =============================================================================
# プロンプトファイル作成
# =============================================================================
PROMPT_FILE=$(mktemp)
trap 'rm -rf "$TMPDIR_AGENTS" "$PROMPT_FILE"' EXIT

create_prompt_file "$PROMPT_FILE"

# =============================================================================
# エージェント設定の表示
# =============================================================================
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

# =============================================================================
# Phase 1-2: 外部エージェント（keyword.jsonがある場合のみ）
# =============================================================================
if [[ -n "$KEYWORD_FILE" ]]; then
  if can_run_role "researcher"; then
    run_research_phase "$KEYWORD_FILE"
    echo ""
  fi

  if can_run_role "designer"; then
    run_design_phase "$KEYWORD_FILE"
    echo ""
  fi
fi

# =============================================================================
# Phase 3: Claude Code CLIで再生成（memo最優先）
# =============================================================================
echo "--- Phase 3: Regenerate (Claude Code) ---"

# 外部エージェントのコンテキストをプロンプトに統合
EXTRA_CONTEXT=""
if [[ -f "$RESEARCH_CONTEXT" ]]; then
  EXTRA_CONTEXT="${EXTRA_CONTEXT}

## 外部リサーチ結果（参考情報）
$(cat "$RESEARCH_CONTEXT")"
fi

if [[ -f "$DESIGN_CONTEXT" ]]; then
  EXTRA_CONTEXT="${EXTRA_CONTEXT}

## 外部エージェントによる設計提案（参考情報）
$(cat "$DESIGN_CONTEXT")"
fi

# keyword.json コンテキスト
KEYWORD_CONTEXT=""
if [[ -n "$KEYWORD_FILE" ]]; then
  KEYWORD_CONTEXT="
## 元のキーワード情報（参考）
keyword.jsonパス: ${KEYWORD_FILE}
以下のファイルを読み込んで参考にしてください。"
fi

PROMPT="あなたは既存のアプリ要件を改善・再生成するタスクを行います。

## 最優先指示: ユーザーからのフィードバック（memo.md）

以下のフィードバックを **最優先の改善指示** として、既存の要件を再生成してください。
フィードバックの内容は必ず反映してください。

\`\`\`
${MEMO_CONTENT}
\`\`\`

## 再生成対象

アプリ名: ${APP_NAME}
ディレクトリ: ${APP_DIR}

## 既存の要件（現在の状態）

### _source_info.json
\`\`\`json
${SOURCE_INFO}
\`\`\`

### overview.md
${EXISTING_OVERVIEW}

### features/
${EXISTING_FEATURES}

### diagrams/
${EXISTING_DIAGRAMS}
${KEYWORD_CONTEXT}
${EXTRA_CONTEXT}
$(if [[ -n "$CONSTRAINTS_PROMPT" ]]; then echo "
## 制約条件
${CONSTRAINTS_PROMPT}"; fi)
$(if [[ -n "$PERSPECTIVES_PROMPT" ]]; then echo "
## 生成観点
以下の生成観点が設定されています。再生成時も体験設計・機能設計・マネタイズ戦略に反映してください。
また、_source_info.json の perspectives フィールドを更新してください。
${PERSPECTIVES_PROMPT}"; fi)

## 再生成の手順

1. 上記のフィードバック（memo.md）の内容を最優先に、既存の要件を改善してください
2. 上記の要件生成スキルのテンプレートに従い、以下のファイルを **既存ディレクトリに上書き** してください:
   - _source_info.json（tagsやdescriptionを必要に応じて更新）
   - overview.md
   - features/ 配下の全機能ファイル（機能の追加・削除・変更を含む）
   - diagrams/ 配下の図解ファイル
3. **memo.md は変更しないでください**（ユーザーのフィードバックを保持するため）
4. 既存ディレクトリの features/ と diagrams/ の古いファイルは、再生成前に削除してから新しいファイルを書き出してください

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts ${APP_NAME}"

claude -p "$PROMPT" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --allowedTools "Read" "Write" "Glob" "Bash(mkdir:*)" "Bash(find:*)" "Bash(tsx:*)" "Bash(rm:*)"

echo ""

# =============================================================================
# Phase 4: Review（reviewer ロール）
# =============================================================================
if can_run_role "reviewer"; then
  run_review_phase "$APP_NAME"
  echo ""
fi

echo "=== 要件再生成完了: ${APP_NAME} ==="
