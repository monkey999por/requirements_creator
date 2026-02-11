#!/usr/bin/env bash
# 共通: data_sourceディレクトリの対話選択（↑↓/j/k キー操作対応）
# tmux互換: ANSI escape sequence を使用し、escape-time の遅延を考慮

# select_data_source <DATA_SOURCE_DIR>
# 直近7件のdata_sourceをキー操作で選択させる。
# 選択結果は SELECTED_SOURCE 変数にセットされる。
# 戻り値: 0=成功, 1=データなしまたはキャンセル
select_data_source() {
  local data_source_dir="$1"
  local max_items=7

  # ディレクトリ一覧を新しい順で取得
  local dirs=()
  while IFS= read -r d; do
    dirs+=("$d")
  done < <(ls -1d "${data_source_dir}"/*/ 2>/dev/null | xargs -n1 basename | sort -r | head -n "$max_items")

  if [[ ${#dirs[@]} -eq 0 ]]; then
    echo "エラー: ${data_source_dir}/ にデータがありません。先に pnpm collect を実行してください。"
    return 1
  fi

  # 1件のみの場合は自動選択
  if [[ ${#dirs[@]} -eq 1 ]]; then
    SELECTED_SOURCE="${dirs[0]}"
    echo "データソース: ${SELECTED_SOURCE}"
    return 0
  fi

  # 非対話環境（パイプ・リダイレクト等）の場合は最新を自動選択
  if [[ ! -t 0 || ! -t 1 ]]; then
    SELECTED_SOURCE="${dirs[0]}"
    echo "データソース: ${SELECTED_SOURCE}（自動選択）"
    return 0
  fi

  local selected=0
  local count=${#dirs[@]}

  # メニュー描画関数
  _draw_menu() {
    local first_time="$1"
    local i

    # 再描画時はカーソルをメニュー先頭まで戻す
    if [[ "$first_time" != "1" ]]; then
      printf "\033[%dA" "$count"
    fi

    for ((i = 0; i < count; i++)); do
      printf "\033[2K"  # 行クリア
      local latest=""
      [[ $i -eq 0 ]] && latest="  <- 最新"
      if [[ $i -eq $selected ]]; then
        printf "  \033[7m> %s%s\033[0m\n" "${dirs[$i]}" "$latest"
      else
        printf "    %s%s\n" "${dirs[$i]}" "$latest"
      fi
    done
  }

  echo "データソースを選択してください（↑↓/j/k: 移動  Enter: 決定  q: キャンセル）:"

  # カーソル非表示
  printf "\033[?25l"

  _draw_menu 1

  while true; do
    IFS= read -rsn1 key

    case "$key" in
      $'\033')
        # エスケープシーケンス読み取り（tmux escape-time 考慮で 0.5s タイムアウト）
        IFS= read -rsn2 -t 0.5 seq
        case "$seq" in
          '[A') ((selected > 0)) && ((selected--)) ;;          # ↑
          '[B') ((selected < count - 1)) && ((selected++)) ;;  # ↓
        esac
        ;;
      k) ((selected > 0)) && ((selected--)) ;;
      j) ((selected < count - 1)) && ((selected++)) ;;
      '')  # Enter
        break
        ;;
      q)
        printf "\033[?25h"  # カーソル復帰
        echo ""
        echo "キャンセルしました。"
        return 1
        ;;
    esac

    _draw_menu 0
  done

  # カーソル復帰
  printf "\033[?25h"

  SELECTED_SOURCE="${dirs[$selected]}"
  echo ""
  echo "選択: ${SELECTED_SOURCE}"
  return 0
}
