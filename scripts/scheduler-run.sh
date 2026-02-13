#!/usr/bin/env bash
set -euo pipefail

# scheduler-run.sh - systemdタイマーから呼び出されるパイプライン実行ラッパー
# ログ出力付きで pnpm pipeline を実行する

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ログディレクトリ
LOG_DIR="$PROJECT_ROOT/logs/scheduler"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/$(date +%Y_%m_%d_%H_%M_%S).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== スケジューラ実行開始 ==="
log "プロジェクト: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# NVMが利用可能な場合はロード
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

log "Node: $(node --version 2>/dev/null || echo 'not found')"
log "pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"

# キューがあればキュー処理、なければ通常パイプライン
QUEUE_DIR="$PROJECT_ROOT/gen/pipeline_queue"

has_queue_items() {
  [[ -d "$QUEUE_DIR" ]] && [[ -n "$(find "$QUEUE_DIR" -maxdepth 1 -name '*.json' -print -quit 2>/dev/null)" ]]
}

if has_queue_items; then
  log "キューにアイテムがあります。キュー処理を実行..."
  if pnpm queue:process >> "$LOG_FILE" 2>&1; then
    log "=== キュー処理完了（成功） ==="
  else
    EXIT_CODE=$?
    log "=== キュー処理完了（失敗: exit $EXIT_CODE） ==="
    exit $EXIT_CODE
  fi
else
  log "キューは空です。通常パイプラインを実行..."
  if pnpm pipeline >> "$LOG_FILE" 2>&1; then
    log "=== パイプライン完了（成功） ==="
  else
    EXIT_CODE=$?
    log "=== パイプライン完了（失敗: exit $EXIT_CODE） ==="
    exit $EXIT_CODE
  fi
fi
