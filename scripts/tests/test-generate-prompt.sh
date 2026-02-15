#!/usr/bin/env bash
# =============================================================================
# test-generate-prompt.sh — generate.sh のプロンプト組み立てテスト
#
# generate.shが構築する最終プロンプトに、data_sourceのパス情報と
# app.config.yamlの設定値が正しく含まれているかを検証する。
#
# generate.shを直接実行するのではなく、同じロジックを再現して
# プロンプト文字列の内容をチェックする。
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures"

# テスト結果カウンター
PASS=0
FAIL=0
ERRORS=()

green() { printf "\033[32m%s\033[0m" "$1"; }
red() { printf "\033[31m%s\033[0m" "$1"; }

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    echo "    期待: 「${needle}」を含む"
    echo "    実際の先頭300文字: ${haystack:0:300}"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

assert_not_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    echo "    期待: 「${needle}」を含まない"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

# =============================================================================
# generate-helpers.sh の読み込み
# =============================================================================
SKIP_AGENTS=true
TMPDIR_AGENTS=$(mktemp -d)
REQUIREMENTS_DIR="${PROJECT_ROOT}/gen/requirements"
RESEARCH_CONTEXT="${TMPDIR_AGENTS}/research_context.md"
DESIGN_CONTEXT="${TMPDIR_AGENTS}/design_context.md"
REVIEW_RESULT="${TMPDIR_AGENTS}/review_result.md"

trap 'rm -rf "$TMPDIR_AGENTS"' EXIT

source "${PROJECT_ROOT}/scripts/lib/generate-helpers.sh"

echo "======================================"
echo " generate.sh プロンプト組み立てテスト"
echo "======================================"
echo ""

# =============================================================================
# generate.sh のプロンプト構築ロジックを再現する関数
# =============================================================================

# 通常モード（keyword.jsonベース）のプロンプト構築
build_normal_prompt() {
  local target_dir="$1"
  local keyword_file="$2"
  local extra_context="${3:-}"
  local constraints_prompt="${4:-}"
  local perspectives_prompt="${5:-}"

  local constraints_context=""
  if [[ -n "$constraints_prompt" ]]; then
    constraints_context="

## 制約条件
以下の制約条件が設定されています。アプリ案の構想・技術スタック選定・機能スコープに反映してください。
${constraints_prompt}"
  fi

  local perspectives_context=""
  if [[ -n "$perspectives_prompt" ]]; then
    perspectives_context="

## 生成観点
以下の生成観点が設定されています。アプリの体験設計・機能設計・マネタイズ戦略に深く反映してください。
また、_source_info.json の perspectives フィールドに適用した観点を記録してください。
${perspectives_prompt}"
  fi

  echo "以下のkeyword.jsonを読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${target_dir}
keyword.jsonパス: ${keyword_file}
${extra_context}
${constraints_context}
${perspectives_context}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"
}

# ダイレクトモードのプロンプト構築
build_direct_prompt() {
  local data_dir="$1"
  local target_dir="$2"
  local constraints_prompt="${3:-}"
  local perspectives_prompt="${4:-}"

  local constraints_context=""
  if [[ -n "$constraints_prompt" ]]; then
    constraints_context="
## 制約条件
以下の制約条件が設定されています。アプリ案の構想・技術スタック選定・機能スコープに反映してください。
${constraints_prompt}"
  fi

  local perspectives_context=""
  if [[ -n "$perspectives_prompt" ]]; then
    perspectives_context="
## 生成観点
以下の生成観点が設定されています。アプリの体験設計・機能設計・マネタイズ戦略に深く反映してください。
また、_source_info.json の perspectives フィールドに適用した観点を記録してください。
${perspectives_prompt}"
  fi

  echo "以下のディレクトリ内のテキストデータを全て読み込み、上記の要件生成スキルの手順に従ってアプリの要件を生成してください。
対象ディレクトリ: ${data_dir}

これはダイレクトモードです。keyword.jsonは使用しません。
テキストデータの内容を直接読み込み、そこからアプリのアイデアを構想してください。
ユーザーが書いた提案やメモがそのまま含まれている可能性があります。
内容の意図を尊重し、キーワード抽出を介さずに直接要件を詳細化してください。

_source_info.json の source.directory には「${target_dir}」を、
keywords 配列は空配列 [] としてください。
description にはテキストデータからどのようにアプリ案を導いたかの経緯を記載してください。
${constraints_context}
${perspectives_context}

生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"
}

# データセットモードのプロンプト構築
build_dataset_prompt() {
  local dataset_source="$1"
  local dataset_name="$2"

  echo "以下のデータセットソースファイルを読み込んでください: ${dataset_source}

このファイルには、複数のアプリ要件から選択されたOverviewとFeatureが含まれています。
これらの要件を組み合わせ・融合・発展させて、新しいユニークなアプリ案を構想し、
上記の要件生成スキルの手順に従って新しいアプリの要件を生成してください。

データセット名: ${dataset_name}

重要：
- 既存の要件をそのままコピーするのではなく、選択された機能やコンセプトを融合・再解釈して新しいアプリを考案してください
- _source_info.json の source.directory は「dataset://${dataset_name}」形式にしてください
- _source_info.json に dataset フィールドを追加し、dataset.name にデータセット名、dataset.sourceApps にデータセットに含まれる全アイテム（appName, type, featureId, title）を列挙してください
- 詳細はテンプレートの「データセットモード用」セクションに従ってください
- 生成完了後、以下のバリデーションスクリプトを実行して構造を検証してください:
tsx scripts/validate-requirements.ts <生成したapp_name>"
}

# =============================================================================
# テスト1: 通常モード — data_sourceとkeyword.jsonのパスが含まれる
# =============================================================================

echo "--- 1. 通常モード: data_sourceパスの反映 ---"
TARGET_DIR="2026_02_10_02_42_56"
KEYWORD_FILE="gen/data_source/${TARGET_DIR}/keyword.json"

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE")

assert_contains "対象ディレクトリがプロンプトに含まれる" "$PROMPT" "対象ディレクトリ: ${TARGET_DIR}"
assert_contains "keyword.jsonパスがプロンプトに含まれる" "$PROMPT" "keyword.jsonパス: ${KEYWORD_FILE}"
assert_contains "バリデーション指示が含まれる" "$PROMPT" "tsx scripts/validate-requirements.ts"
echo ""

# =============================================================================
# テスト2: 通常モード — 制約条件がプロンプトに含まれる
# =============================================================================

echo "--- 2. 通常モード: 制約条件の反映 ---"
CONFIG_FILE="${FIXTURES_DIR}/config-full-constraints.yaml"
read_constraints
CP=$(format_constraints_prompt)

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE" "" "$CP")

assert_contains "制約条件セクションが含まれる" "$PROMPT" "## 制約条件"
assert_contains "Platform制約がプロンプトに反映" "$PROMPT" "Platform: mobile-android"
assert_contains "Budget制約がプロンプトに反映" "$PROMPT" "Budget: free"
assert_contains "Difficulty制約がプロンプトに反映" "$PROMPT" "Difficulty: medium"
assert_contains "tech_stackがプロンプトに反映" "$PROMPT" "Frontend: React Native"
echo ""

# =============================================================================
# テスト3: 通常モード — 制約条件なしの場合
# =============================================================================

echo "--- 3. 通常モード: 制約条件なし ---"
CONFIG_FILE="${FIXTURES_DIR}/config-no-constraints.yaml"
read_constraints
CP=$(format_constraints_prompt)

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE" "" "$CP")

assert_not_contains "制約条件セクション含まない" "$PROMPT" "## 制約条件"
assert_not_contains "CONSTRAINTS含まない" "$PROMPT" "CONSTRAINTS"
echo ""

# =============================================================================
# テスト4: 通常モード — 生成観点がプロンプトに含まれる
# =============================================================================

echo "--- 4. 通常モード: 生成観点の反映（combineモード） ---"
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-combine.yaml"
read_perspectives
PP=$(format_perspectives_prompt)

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE" "" "" "$PP")

assert_contains "生成観点セクションが含まれる" "$PROMPT" "## 生成観点"
assert_contains "DESIGN PERSPECTIVESが含まれる" "$PROMPT" "DESIGN PERSPECTIVES"
assert_contains "kindness観点がプロンプトに反映" "$PROMPT" "**kindness**"
assert_contains "target-focus観点がプロンプトに反映" "$PROMPT" "**target-focus**"
assert_contains "perspectives記録指示が含まれる" "$PROMPT" "_source_info.json の perspectives フィールドに適用した観点を記録"
echo ""

# =============================================================================
# テスト5: 通常モード — 制約条件+生成観点の複合
# =============================================================================

echo "--- 5. 通常モード: 制約条件+生成観点の複合反映 ---"
CONFIG_FILE="${FIXTURES_DIR}/config-full-constraints.yaml"
read_constraints
CP=$(format_constraints_prompt)
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-combine.yaml"
read_perspectives
PP=$(format_perspectives_prompt)

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE" "" "$CP" "$PP")

assert_contains "keyword.jsonパス含む" "$PROMPT" "keyword.jsonパス:"
assert_contains "制約条件セクション含む" "$PROMPT" "## 制約条件"
assert_contains "生成観点セクション含む" "$PROMPT" "## 生成観点"
assert_contains "Platform制約含む" "$PROMPT" "Platform: mobile-android"
assert_contains "kindness観点含む" "$PROMPT" "**kindness**"
echo ""

# =============================================================================
# テスト6: 通常モード — 外部エージェントコンテキスト
# =============================================================================

echo "--- 6. 通常モード: 外部エージェントコンテキストの反映 ---"
EXTRA="

## 外部リサーチ結果（参考情報）
以下は外部エージェントによるトレンド・市場調査の結果です。

- AI市場は拡大傾向

## 外部エージェントによる設計提案（参考情報）
以下は外部エージェントによるアプリコンセプト提案です。

- モバイルヘルスケアアプリ"

PROMPT=$(build_normal_prompt "$TARGET_DIR" "$KEYWORD_FILE" "$EXTRA")

assert_contains "リサーチ結果が含まれる" "$PROMPT" "外部リサーチ結果"
assert_contains "リサーチ内容が含まれる" "$PROMPT" "AI市場は拡大傾向"
assert_contains "設計提案が含まれる" "$PROMPT" "外部エージェントによる設計提案"
assert_contains "設計内容が含まれる" "$PROMPT" "モバイルヘルスケアアプリ"
echo ""

# =============================================================================
# テスト7: ダイレクトモード — data_sourceパスの反映
# =============================================================================

echo "--- 7. ダイレクトモード: data_sourceパスの反映 ---"
DATA_DIR="gen/data_source/2026_02_10_02_42_56"
TARGET="2026_02_10_02_42_56"

PROMPT=$(build_direct_prompt "$DATA_DIR" "$TARGET")

assert_contains "対象ディレクトリがプロンプトに含まれる" "$PROMPT" "対象ディレクトリ: ${DATA_DIR}"
assert_contains "ダイレクトモード表記" "$PROMPT" "これはダイレクトモードです"
assert_contains "keyword.json不使用の指示" "$PROMPT" "keyword.jsonは使用しません"
assert_contains "source.directory指示" "$PROMPT" "source.directory には「${TARGET}」"
assert_contains "keywords空配列指示" "$PROMPT" "keywords 配列は空配列 []"
echo ""

# =============================================================================
# テスト8: ダイレクトモード — 制約条件+生成観点
# =============================================================================

echo "--- 8. ダイレクトモード: 制約条件+生成観点の反映 ---"
CONFIG_FILE="${FIXTURES_DIR}/config-partial-constraints.yaml"
read_constraints
CP=$(format_constraints_prompt)
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-single.yaml"
read_perspectives
PP=$(format_perspectives_prompt)

PROMPT=$(build_direct_prompt "$DATA_DIR" "$TARGET" "$CP" "$PP")

assert_contains "制約条件含む" "$PROMPT" "## 制約条件"
assert_contains "Platform制約" "$PROMPT" "Platform: frontend-only"
assert_contains "生成観点含む" "$PROMPT" "## 生成観点"
assert_contains "dopamine観点" "$PROMPT" "**dopamine**"
echo ""

# =============================================================================
# テスト9: データセットモード — ソースファイルとデータセット名
# =============================================================================

echo "--- 9. データセットモード: ソースとデータセット名の反映 ---"
DATASET_SRC="/tmp/dataset_source_test.json"
DATASET_NAME="my-test-dataset"

PROMPT=$(build_dataset_prompt "$DATASET_SRC" "$DATASET_NAME")

assert_contains "ソースファイルパス含む" "$PROMPT" "読み込んでください: ${DATASET_SRC}"
assert_contains "データセット名含む" "$PROMPT" "データセット名: ${DATASET_NAME}"
assert_contains "dataset://形式の指示" "$PROMPT" "dataset://${DATASET_NAME}"
assert_contains "datasetフィールド指示" "$PROMPT" "dataset フィールドを追加"
assert_contains "sourceApps指示" "$PROMPT" "dataset.sourceApps"
echo ""

# =============================================================================
# 結果サマリー
# =============================================================================

echo "======================================"
echo " 結果: $(green "${PASS} passed"), $(red "${FAIL} failed")"
echo "======================================"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo "失敗テスト:"
  for e in "${ERRORS[@]}"; do
    echo "  - $e"
  done
  exit 1
fi

exit 0
