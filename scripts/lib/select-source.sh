#!/usr/bin/env bash
# 共通: data_sourceディレクトリの対話選択

# select_data_source <DATA_SOURCE_DIR>
# 直近7件のdata_sourceを表示し、ユーザーに選択させる。
# 選択結果は SELECTED_SOURCE 変数にセットされる。
# 戻り値: 0=成功, 1=データなし
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

  echo "データソースを選択してください（直近${#dirs[@]}件）:"
  local i=1
  for d in "${dirs[@]}"; do
    local label=""
    if [[ $i -eq 1 ]]; then
      label="  $i) $d  <- 最新"
    else
      label="  $i) $d"
    fi
    echo "$label"
    ((i++))
  done

  local choice
  read -rp "番号を入力 [1]: " choice
  choice="${choice:-1}"

  # バリデーション
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#dirs[@]} ]]; then
    echo "エラー: 無効な選択です。1〜${#dirs[@]} の番号を入力してください。"
    return 1
  fi

  SELECTED_SOURCE="${dirs[$((choice - 1))]}"
  echo "選択: ${SELECTED_SOURCE}"
  return 0
}
