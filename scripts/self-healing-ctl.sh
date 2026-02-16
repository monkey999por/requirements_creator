#!/usr/bin/env bash
set -euo pipefail

# self-healing-ctl.sh - 自己修復スケジューラの有効化/無効化
# Usage: bash scripts/self-healing-ctl.sh [enable|disable|status]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"
UNIT_DIR="$PROJECT_ROOT/systemd"

if ! command -v systemctl &>/dev/null; then
  echo "エラー: systemctl が見つかりません。この機能はsystemd環境（Linux）でのみ利用可能です。"
  exit 1
fi

install_units() {
  mkdir -p "$SYSTEMD_DIR"
  ln -sf "$UNIT_DIR/self-healing.service" "$SYSTEMD_DIR/self-healing.service"
  ln -sf "$UNIT_DIR/self-healing.timer" "$SYSTEMD_DIR/self-healing.timer"
  systemctl --user daemon-reload
}

case "${1:-}" in
  enable)
    echo "自己修復スケジューラを有効化します..."
    install_units
    systemctl --user enable --now self-healing.timer
    echo "有効化完了。"
    echo ""
    systemctl --user list-timers self-healing.timer --no-pager
    ;;
  disable)
    echo "自己修復スケジューラを無効化します..."
    systemctl --user disable --now self-healing.timer 2>/dev/null || true
    echo "無効化完了。"
    ;;
  status)
    # サマリー表示
    TIMER_STATE=$(systemctl --user is-active self-healing.timer 2>/dev/null || true)
    if [[ "$TIMER_STATE" == "active" ]]; then
      echo "自己修復スケジューラ: 有効"
    else
      echo "自己修復スケジューラ: 無効"
    fi

    # 次回実行
    NEXT=$(systemctl --user list-timers self-healing.timer --no-pager 2>/dev/null | grep self-healing || true)
    if [[ -n "$NEXT" ]]; then
      NEXT_TIME=$(echo "$NEXT" | awk '{print $1, $2, $3}')
      echo "次回実行: $NEXT_TIME"
    fi

    # スケジュール（OnCalendar）
    TIMER_FILE="$UNIT_DIR/self-healing.timer"
    if [[ -f "$TIMER_FILE" ]]; then
      FIRST=true
      while IFS= read -r cal; do
        if $FIRST; then
          echo "スケジュール: $cal"
          FIRST=false
        else
          echo "              $cal"
        fi
      done < <(grep -E '^OnCalendar=' "$TIMER_FILE" | sed 's/^OnCalendar=//')
    fi

    echo ""
    echo "=== タイマー状態 ==="
    systemctl --user status self-healing.timer --no-pager 2>/dev/null || echo "タイマー未インストール"
    echo ""
    echo "=== 今後の実行予定 ==="
    if [[ -f "$TIMER_FILE" ]]; then
      CALENDAR_ARGS=()
      while IFS= read -r line; do
        CALENDAR_ARGS+=("$line")
      done < <(grep -E '^OnCalendar=' "$TIMER_FILE" | sed 's/^OnCalendar=//')
      TIMER_TZ=$(grep -E '^TimezoneOfTimer=' "$TIMER_FILE" | sed 's/^TimezoneOfTimer=//' || true)
      if [[ ${#CALENDAR_ARGS[@]} -gt 0 ]]; then
        export TZ="${TIMER_TZ:-}"
        systemd-analyze calendar --iterations=10 "${CALENDAR_ARGS[@]}" 2>/dev/null || echo "解析できませんでした"
      fi
    else
      echo "タイマーファイルが見つかりません"
    fi
    ;;
  *)
    echo "Usage: bash scripts/self-healing-ctl.sh [enable|disable|status]"
    echo ""
    echo "Commands:"
    echo "  enable   自己修復スケジューラを有効化（systemdタイマー開始）"
    echo "  disable  自己修復スケジューラを無効化（systemdタイマー停止）"
    echo "  status   現在の状態を表示"
    exit 1
    ;;
esac
