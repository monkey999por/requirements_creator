#!/usr/bin/env bash
set -euo pipefail

# self-healing-run.sh - systemdタイマーから呼び出される自己修復実行ラッパー

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ログディレクトリ
LOG_DIR="$PROJECT_ROOT/logs/scheduler"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/self-healing_$(date +%Y_%m_%d_%H_%M_%S).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== 自己修復実行開始 ==="
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

# ログファイルが存在するかチェック
if [[ ! -d "$PROJECT_ROOT/logs" ]] || [[ -z "$(find "$PROJECT_ROOT/logs" -maxdepth 1 -name '*.jsonl' -print -quit 2>/dev/null)" ]]; then
  log "パイプラインログがありません。自己修復をスキップします。"
  log "=== 自己修復完了（スキップ） ==="
  exit 0
fi

if pnpm self-healing >> "$LOG_FILE" 2>&1; then
  log "=== 自己修復完了（成功） ==="
else
  EXIT_CODE=$?
  log "=== 自己修復完了（失敗: exit $EXIT_CODE） ==="
  exit $EXIT_CODE
fi
