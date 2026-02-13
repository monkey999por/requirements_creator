#!/usr/bin/env bash
set -euo pipefail

# scheduler-ctl.sh - パイプラインスケジューラの有効化/無効化
# Usage: bash scripts/scheduler-ctl.sh [enable|disable|status]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"
UNIT_DIR="$PROJECT_ROOT/systemd"

install_units() {
  mkdir -p "$SYSTEMD_DIR"
  ln -sf "$UNIT_DIR/pipeline.service" "$SYSTEMD_DIR/pipeline.service"
  ln -sf "$UNIT_DIR/pipeline.timer" "$SYSTEMD_DIR/pipeline.timer"
  systemctl --user daemon-reload
}

case "${1:-}" in
  enable)
    echo "スケジューラを有効化します..."
    install_units
    systemctl --user enable --now pipeline.timer
    echo "有効化完了。次回実行予定:"
    systemctl --user list-timers pipeline.timer --no-pager
    ;;
  disable)
    echo "スケジューラを無効化します..."
    systemctl --user disable --now pipeline.timer
    echo "無効化完了。"
    ;;
  status)
    echo "=== タイマー状態 ==="
    systemctl --user status pipeline.timer --no-pager 2>/dev/null || echo "タイマー未インストール"
    echo ""
    echo "=== サービス状態 ==="
    systemctl --user status pipeline.service --no-pager 2>/dev/null || echo "サービス未インストール"
    echo ""
    echo "=== 次回実行予定 ==="
    systemctl --user list-timers pipeline.timer --no-pager 2>/dev/null || echo "タイマー未登録"
    ;;
  *)
    echo "Usage: bash scripts/scheduler-ctl.sh [enable|disable|status]"
    echo ""
    echo "Commands:"
    echo "  enable   スケジューラを有効化（systemdタイマー開始）"
    echo "  disable  スケジューラを無効化（systemdタイマー停止）"
    echo "  status   現在の状態を表示"
    exit 1
    ;;
esac
