#!/usr/bin/env bash
# =============================================================================
# test-generate-helpers.sh — generate-helpers.sh の関数単体テスト
#
# generate時にapp.config.yamlの設定値がClaudeに渡されるプロンプトに
# 適切に反映されているかを検証する。
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures"

# テスト結果カウンター
PASS=0
FAIL=0
ERRORS=()

# =============================================================================
# テストユーティリティ
# =============================================================================

# 色付き出力
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
    echo "    実際: ${haystack:0:200}..."
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

assert_empty() {
  local label="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    echo "    期待: 空文字列"
    echo "    実際: ${value:0:200}"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

assert_not_empty() {
  local label="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    echo "    期待: 非空文字列"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

assert_equals() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    echo "    期待: ${expected}"
    echo "    実際: ${actual}"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

assert_true() {
  local label="$1"
  shift
  if "$@"; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

assert_false() {
  local label="$1"
  shift
  if ! "$@"; then
    echo "  $(green "PASS") $label"
    PASS=$((PASS + 1))
  else
    echo "  $(red "FAIL") $label"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

# ヘルパー関数の変数をリセット
reset_vars() {
  CONSTRAINT_PLATFORM=""
  CONSTRAINT_BUDGET=""
  CONSTRAINT_DIFFICULTY=""
  CONSTRAINT_TEAM_SIZE=""
  CONSTRAINT_TS_FRONTEND=""
  CONSTRAINT_TS_BACKEND=""
  CONSTRAINT_TS_DATABASE=""
  CONSTRAINT_TS_HOSTING=""
  CONSTRAINT_TS_AUTH=""
  CONSTRAINT_TS_OTHER=""
  PERSPECTIVE_MODE=""
  PERSPECTIVE_ITEMS=""
  RESOLVED_PERSPECTIVES=""
  RESOLVED_PERSPECTIVE_MODE=""
}

# =============================================================================
# generate-helpers.sh の読み込み
# =============================================================================

# 依存変数の初期化（generate-helpers.sh が期待する変数）
SKIP_AGENTS=false
TMPDIR_AGENTS=$(mktemp -d)
REQUIREMENTS_DIR="${PROJECT_ROOT}/gen/requirements"
RESEARCH_CONTEXT="${TMPDIR_AGENTS}/research_context.md"
DESIGN_CONTEXT="${TMPDIR_AGENTS}/design_context.md"
REVIEW_RESULT="${TMPDIR_AGENTS}/review_result.md"

trap 'rm -rf "$TMPDIR_AGENTS"' EXIT

source "${PROJECT_ROOT}/scripts/lib/generate-helpers.sh"

echo "======================================"
echo " generate-helpers.sh テスト"
echo "======================================"
echo ""

# =============================================================================
# 1. read_constraints + format_constraints_prompt テスト
# =============================================================================

echo "--- 1. 制約条件: 全項目指定 ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-full-constraints.yaml"
read_constraints
RESULT=$(format_constraints_prompt)

assert_equals "platform読み取り" "mobile-android" "$CONSTRAINT_PLATFORM"
assert_equals "budget読み取り" "free" "$CONSTRAINT_BUDGET"
assert_equals "difficulty読み取り" "medium" "$CONSTRAINT_DIFFICULTY"
assert_equals "team_size読み取り" "solo" "$CONSTRAINT_TEAM_SIZE"
assert_equals "tech_stack.frontend読み取り" "React Native" "$CONSTRAINT_TS_FRONTEND"
assert_equals "tech_stack.backend読み取り" "Firebase" "$CONSTRAINT_TS_BACKEND"
assert_equals "tech_stack.database読み取り" "Firestore" "$CONSTRAINT_TS_DATABASE"
assert_equals "tech_stack.hosting読み取り" "Firebase Hosting" "$CONSTRAINT_TS_HOSTING"
assert_equals "tech_stack.auth読み取り" "Firebase Auth" "$CONSTRAINT_TS_AUTH"
assert_contains "tech_stack.other読み取り(Stripe)" "$CONSTRAINT_TS_OTHER" "Stripe"
assert_contains "tech_stack.other読み取り(SendGrid)" "$CONSTRAINT_TS_OTHER" "SendGrid"

assert_contains "プロンプトにCONSTRAINTS見出し" "$RESULT" "CONSTRAINTS"
assert_contains "プロンプトにplatform" "$RESULT" "Platform: mobile-android"
assert_contains "プロンプトにbudget" "$RESULT" "Budget: free"
assert_contains "プロンプトにdifficulty" "$RESULT" "Difficulty: medium"
assert_contains "プロンプトにteam_size" "$RESULT" "Team size: solo"
assert_contains "プロンプトにREQUIRED TECHNOLOGY STACK" "$RESULT" "REQUIRED TECHNOLOGY STACK"
assert_contains "プロンプトにfrontend" "$RESULT" "Frontend: React Native"
assert_contains "プロンプトにbackend" "$RESULT" "Backend: Firebase"
assert_contains "プロンプトにdatabase" "$RESULT" "Database: Firestore"
assert_contains "プロンプトにhosting" "$RESULT" "Hosting: Firebase Hosting"
assert_contains "プロンプトにauth" "$RESULT" "Auth: Firebase Auth"
assert_contains "プロンプトにother" "$RESULT" "Other services/libraries: Stripe, SendGrid"
echo ""

echo "--- 2. 制約条件: 一部のみ指定 ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-partial-constraints.yaml"
read_constraints
RESULT=$(format_constraints_prompt)

assert_equals "platform読み取り" "frontend-only" "$CONSTRAINT_PLATFORM"
assert_equals "budget読み取り" "low" "$CONSTRAINT_BUDGET"
assert_empty "difficulty未指定" "$CONSTRAINT_DIFFICULTY"
assert_empty "team_size未指定" "$CONSTRAINT_TEAM_SIZE"
assert_empty "tech_stack.frontend未指定" "$CONSTRAINT_TS_FRONTEND"

assert_contains "プロンプトにplatform" "$RESULT" "Platform: frontend-only"
assert_contains "プロンプトにbudget" "$RESULT" "Budget: low"
assert_not_contains "プロンプトにdifficulty含まない" "$RESULT" "Difficulty:"
assert_not_contains "プロンプトにteam_size含まない" "$RESULT" "Team size:"
assert_not_contains "プロンプトにTECHNOLOGY STACK含まない" "$RESULT" "REQUIRED TECHNOLOGY STACK"
echo ""

echo "--- 3. 制約条件: 未指定（generateセクションにconstraintsなし） ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-no-constraints.yaml"
read_constraints
RESULT=$(format_constraints_prompt)

assert_empty "platform空" "$CONSTRAINT_PLATFORM"
assert_empty "budget空" "$CONSTRAINT_BUDGET"
assert_empty "プロンプト空" "$RESULT"
echo ""

# =============================================================================
# 2. read_perspectives + format_perspectives_prompt テスト
# =============================================================================

echo "--- 4. 生成観点: singleモード ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-single.yaml"
read_perspectives
RESULT=$(format_perspectives_prompt)

assert_equals "mode読み取り" "single" "$PERSPECTIVE_MODE"
assert_contains "items読み取り(dopamine)" "$PERSPECTIVE_ITEMS" "dopamine"

assert_contains "プロンプトにDESIGN PERSPECTIVES" "$RESULT" "DESIGN PERSPECTIVES"
assert_contains "プロンプトにMode: single" "$RESULT" "Mode: single"
assert_contains "プロンプトにdopamine" "$RESULT" "**dopamine**"
# singleモードではitemsの先頭1つのみ
assert_not_contains "プロンプトにcunning含まない(single)" "$RESULT" "**cunning**"
echo ""

echo "--- 5. 生成観点: combineモード ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-combine.yaml"
read_perspectives
RESULT=$(format_perspectives_prompt)

assert_equals "mode読み取り" "combine" "$PERSPECTIVE_MODE"
assert_contains "items読み取り(kindness)" "$PERSPECTIVE_ITEMS" "kindness"
assert_contains "items読み取り(target-focus)" "$PERSPECTIVE_ITEMS" "target-focus"

assert_contains "プロンプトにMode: combine" "$RESULT" "Mode: combine"
assert_contains "プロンプトにkindness" "$RESULT" "**kindness**"
assert_contains "プロンプトにtarget-focus" "$RESULT" "**target-focus**"
assert_contains "プロンプトにkindness説明" "$RESULT" "User-friendly"
assert_contains "プロンプトにtarget-focus説明" "$RESULT" "Hyper-targeted"
echo ""

echo "--- 6. 生成観点: randomモード ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-perspectives-random.yaml"
read_perspectives
RESULT=$(format_perspectives_prompt)

assert_equals "mode読み取り" "random" "$PERSPECTIVE_MODE"
assert_contains "プロンプトにMode: random" "$RESULT" "Mode: random"
assert_contains "プロンプトにApplied perspectives" "$RESULT" "Applied perspectives"
# randomモードでは1〜3個の観点が選ばれる（定義済み5観点のいずれか）
assert_contains "プロンプトにIntegrate指示" "$RESULT" "Integrate these perspectives deeply"
echo ""

echo "--- 7. 生成観点: 未設定 ---"
reset_vars
CONFIG_FILE="${FIXTURES_DIR}/config-no-constraints.yaml"
read_perspectives
RESULT=$(format_perspectives_prompt)

assert_empty "mode空" "$PERSPECTIVE_MODE"
assert_empty "プロンプト空" "$RESULT"
echo ""

# =============================================================================
# 3. エージェント設定テスト
# =============================================================================

echo "--- 8. エージェント設定: 有効 ---"
CONFIG_FILE="${FIXTURES_DIR}/config-agents.yaml"

assert_true "codex有効" get_agent_enabled "codex"
assert_true "gemini有効" get_agent_enabled "gemini"

CODEX_MODEL=$(get_agent_model "codex")
GEMINI_MODEL=$(get_agent_model "gemini")
assert_equals "codexモデル" "o4-mini" "$CODEX_MODEL"
assert_equals "geminiモデル" "gemini-2.5-pro" "$GEMINI_MODEL"

assert_true "codex-designerロール" has_agent_role "codex" "designer"
assert_true "codex-reviewerロール" has_agent_role "codex" "reviewer"
assert_false "codex-researcherロールなし" has_agent_role "codex" "researcher"

assert_true "gemini-researcherロール" has_agent_role "gemini" "researcher"
assert_false "gemini-reviewerロールなし" has_agent_role "gemini" "reviewer"

SKIP_AGENTS=false
assert_true "researcherロール実行可能" can_run_role "researcher"
assert_true "designerロール実行可能" can_run_role "designer"
assert_true "reviewerロール実行可能" can_run_role "reviewer"
echo ""

echo "--- 9. エージェント設定: 無効 ---"
CONFIG_FILE="${FIXTURES_DIR}/config-agents-disabled.yaml"

assert_false "codex無効" get_agent_enabled "codex"
assert_false "gemini無効" get_agent_enabled "gemini"

SKIP_AGENTS=false
assert_false "researcherロール実行不可(disabled)" can_run_role "researcher"
assert_false "designerロール実行不可(disabled)" can_run_role "designer"
echo ""

echo "--- 10. エージェント設定: --skip-agents ---"
CONFIG_FILE="${FIXTURES_DIR}/config-agents.yaml"
SKIP_AGENTS=true

assert_false "researcherロール実行不可(skip)" can_run_role "researcher"
assert_false "designerロール実行不可(skip)" can_run_role "designer"
SKIP_AGENTS=false
echo ""

# =============================================================================
# 4. perspective_description テスト
# =============================================================================

echo "--- 11. 観点説明マップ ---"
for p in kindness cunning frustration dopamine target-focus; do
  DESC=$(perspective_description "$p")
  assert_not_empty "${p}の説明が存在" "$DESC"
  assert_not_contains "${p}の説明にUnknown含まない" "$DESC" "Unknown perspective"
done

UNKNOWN_DESC=$(perspective_description "invalid-perspective")
assert_contains "不明な観点にUnknown" "$UNKNOWN_DESC" "Unknown perspective"
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
