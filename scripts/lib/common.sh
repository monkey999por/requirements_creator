#!/usr/bin/env bash
# =============================================================================
# common.sh — シェルスクリプト共通関数
# =============================================================================
#
# 使い方:
#   source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
#
# 提供する変数:
#   SCRIPT_DIR, PROJECT_ROOT, CONFIG_FILE
#   OUTPUT_BASE, DATA_SOURCE_DIR, REQUIREMENTS_DIR
#
# 提供する関数:
#   setup_cleanup_trap [追加クリーンアップコマンド...]
#   run_interruptible <command> [args...]
#   run_claude_stream <command> [args...]
# =============================================================================

# --- プロジェクトルートの設定 ---
# 呼び出し元で SCRIPT_DIR が未設定の場合のみ設定
if [[ -z "${SCRIPT_DIR:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
if [[ -z "${PROJECT_ROOT:-}" ]]; then
  PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi
cd "$PROJECT_ROOT"

CONFIG_FILE="app.config.yaml"

# --- 出力先ベースディレクトリの読み込み ---
OUTPUT_BASE=$(grep '^output_base_dir:' "$CONFIG_FILE" 2>/dev/null | sed 's/^output_base_dir:[[:space:]]*//' | tr -d ' "'"'" || true)
if [[ -z "$OUTPUT_BASE" ]]; then OUTPUT_BASE="gen"; fi
DATA_SOURCE_DIR="${OUTPUT_BASE}/data_source"
REQUIREMENTS_DIR="${OUTPUT_BASE}/requirements"

# --- 子プロセス管理 ---
CHILD_PID=""

# cleanup trap のセットアップ
# 引数: 追加のクリーンアップコマンド（eval される文字列）
# 例: setup_cleanup_trap 'rm -f "$PROMPT_FILE"' 'rm -rf "$TMPDIR"'
_COMMON_CLEANUP_EXTRAS=()

setup_cleanup_trap() {
  _COMMON_CLEANUP_EXTRAS=("$@")

  _common_cleanup() {
    echo "" >&2
    echo "中断シグナルを受信しました。スクリプトを終了しています..." >&2
    if [[ -n "$CHILD_PID" ]]; then
      kill "$CHILD_PID" 2>/dev/null || true
      wait "$CHILD_PID" 2>/dev/null || true
    fi
    for cmd in "${_COMMON_CLEANUP_EXTRAS[@]}"; do
      eval "$cmd" 2>/dev/null || true
    done
    exit 130
  }

  _common_exit_cleanup() {
    for cmd in "${_COMMON_CLEANUP_EXTRAS[@]}"; do
      eval "$cmd" 2>/dev/null || true
    done
  }

  trap _common_cleanup SIGINT SIGTERM
  trap _common_exit_cleanup EXIT
}

# シグナル割り込み可能な外部コマンド実行ヘルパー
run_interruptible() {
  "$@" &
  CHILD_PID=$!
  wait $CHILD_PID
  local status=$?
  CHILD_PID=""
  return $status
}

# claude -p をストリーミングモードで実行するヘルパー
STREAM_FILTER="${SCRIPT_DIR}/lib/claude-stream-filter.ts"

run_claude_stream() {
  "$@" --output-format stream-json --verbose 2>/dev/null > >(tsx "$STREAM_FILTER") &
  CHILD_PID=$!
  wait $CHILD_PID
  local status=$?
  CHILD_PID=""
  return $status
}

# --- 対象ディレクトリの決定 ---
# 優先順位: 1. 第1引数(TARGET_DIR) → 2. app.config.yaml の pipeline.default_source → 3. 対話選択
# 結果は TARGET_DIR 変数に設定される
# 使用前に select-source.sh を source しておくこと
resolve_target_dir() {
  local target_dir="$1"
  if [[ -n "$target_dir" ]]; then
    TARGET_DIR="$target_dir"
    return 0
  fi

  local config_source
  config_source=$(grep '^  default_source:' "$CONFIG_FILE" 2>/dev/null | sed 's/^  default_source:[[:space:]]*//' | tr -d ' "'"'" || true)
  if [[ -n "$config_source" ]]; then
    TARGET_DIR="$config_source"
    return 0
  fi

  source "${SCRIPT_DIR}/lib/select-source.sh"
  if ! select_data_source "$DATA_SOURCE_DIR"; then
    return 1
  fi
  TARGET_DIR="$SELECTED_SOURCE"
  return 0
}
