#!/usr/bin/env bash
set -euo pipefail

# scheduler-ctl.sh - パイプライン・自己修復スケジューラの有効化/無効化
# Usage: bash scripts/scheduler-ctl.sh [enable|disable|status] [--target pipeline|self-healing|all]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"
UNIT_DIR="$PROJECT_ROOT/systemd"

# --- ターゲット判定 ---
TARGET="all"
COMMAND="${1:-}"
shift || true

while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET="$2"; shift 2 ;;
    *) shift ;;
  esac
done

install_units() {
  local target="$1"
  mkdir -p "$SYSTEMD_DIR"

  if [[ "$target" == "pipeline" ]] || [[ "$target" == "all" ]]; then
    ln -sf "$UNIT_DIR/pipeline.service" "$SYSTEMD_DIR/pipeline.service"
    ln -sf "$UNIT_DIR/pipeline.timer" "$SYSTEMD_DIR/pipeline.timer"
  fi

  if [[ "$target" == "self-healing" ]] || [[ "$target" == "all" ]]; then
    ln -sf "$UNIT_DIR/self-healing.service" "$SYSTEMD_DIR/self-healing.service"
    ln -sf "$UNIT_DIR/self-healing.timer" "$SYSTEMD_DIR/self-healing.timer"
  fi

  systemctl --user daemon-reload
}

show_timer_status() {
  local name="$1"
  local label="$2"
  local timer_file="$UNIT_DIR/${name}.timer"

  echo "--- ${label} ---"

  TIMER_STATE=$(systemctl --user is-active "${name}.timer" 2>/dev/null || true)
  if [[ "$TIMER_STATE" == "active" ]]; then
    echo "状態: 有効"
  else
    echo "状態: 無効"
  fi

  # 次回実行
  NEXT=$(systemctl --user list-timers "${name}.timer" --no-pager 2>/dev/null | grep "$name" || true)
  if [[ -n "$NEXT" ]]; then
    NEXT_TIME=$(echo "$NEXT" | awk '{print $1, $2, $3}')
    echo "次回実行: $NEXT_TIME"
  fi

  # スケジュール
  if [[ -f "$timer_file" ]]; then
    FIRST=true
    while IFS= read -r cal; do
      if $FIRST; then
        echo "スケジュール: $cal"
        FIRST=false
      else
        echo "              $cal"
      fi
    done < <(grep -E '^OnCalendar=' "$timer_file" | sed 's/^OnCalendar=//')
  fi

  echo ""
  systemctl --user status "${name}.timer" --no-pager 2>/dev/null || echo "タイマー未インストール"
  echo ""
}

case "$COMMAND" in
  enable)
    echo "スケジューラを有効化します..."
    install_units "$TARGET"

    if [[ "$TARGET" == "pipeline" ]] || [[ "$TARGET" == "all" ]]; then
      systemctl --user enable --now pipeline.timer
      echo "パイプラインタイマー: 有効化完了"
    fi

    if [[ "$TARGET" == "self-healing" ]] || [[ "$TARGET" == "all" ]]; then
      systemctl --user enable --now self-healing.timer
      echo "自己修復タイマー: 有効化完了"
    fi

    echo ""
    systemctl --user list-timers --no-pager | head -10
    ;;
  disable)
    echo "スケジューラを無効化します..."

    if [[ "$TARGET" == "pipeline" ]] || [[ "$TARGET" == "all" ]]; then
      systemctl --user disable --now pipeline.timer 2>/dev/null || true
      echo "パイプラインタイマー: 無効化完了"
    fi

    if [[ "$TARGET" == "self-healing" ]] || [[ "$TARGET" == "all" ]]; then
      systemctl --user disable --now self-healing.timer 2>/dev/null || true
      echo "自己修復タイマー: 無効化完了"
    fi
    ;;
  status)
    if [[ "$TARGET" == "pipeline" ]] || [[ "$TARGET" == "all" ]]; then
      show_timer_status "pipeline" "パイプラインスケジューラ"
    fi

    if [[ "$TARGET" == "self-healing" ]] || [[ "$TARGET" == "all" ]]; then
      show_timer_status "self-healing" "自己修復スケジューラ"
    fi

    # 今後の実行予定
    echo "=== 今後の実行予定 ==="
    CALENDAR_ARGS=()
    TIMER_TZ=""

    for timer_name in pipeline self-healing; do
      if [[ "$TARGET" != "all" ]] && [[ "$TARGET" != "$timer_name" ]]; then
        continue
      fi
      TIMER_FILE="$UNIT_DIR/${timer_name}.timer"
      if [[ -f "$TIMER_FILE" ]]; then
        while IFS= read -r line; do
          CALENDAR_ARGS+=("$line")
        done < <(grep -E '^OnCalendar=' "$TIMER_FILE" | sed 's/^OnCalendar=//')
        if [[ -z "$TIMER_TZ" ]]; then
          TIMER_TZ=$(grep -E '^TimezoneOfTimer=' "$TIMER_FILE" | sed 's/^TimezoneOfTimer=//' || true)
        fi
      fi
    done

    if [[ ${#CALENDAR_ARGS[@]} -gt 0 ]]; then
      export TZ="${TIMER_TZ:-}"
      systemd-analyze calendar --iterations=10 "${CALENDAR_ARGS[@]}" 2>/dev/null || echo "解析できませんでした"
    else
      echo "タイマーファイルが見つかりません"
    fi
    ;;
  *)
    echo "Usage: bash scripts/scheduler-ctl.sh [enable|disable|status] [--target pipeline|self-healing|all]"
    echo ""
    echo "Commands:"
    echo "  enable   スケジューラを有効化（systemdタイマー開始）"
    echo "  disable  スケジューラを無効化（systemdタイマー停止）"
    echo "  status   現在の状態を表示"
    echo ""
    echo "Options:"
    echo "  --target  対象タイマー（pipeline / self-healing / all、デフォルト: all）"
    exit 1
    ;;
esac
