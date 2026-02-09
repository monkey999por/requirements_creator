#!/usr/bin/env bash
set -euo pipefail

# ========================================
# プロジェクト初期セットアップスクリプト
# ========================================
# 実行方法: bash scripts/setup.sh
#
# 以下を一括で実行します:
#   1. Node.js バージョンチェック
#   2. pnpm install（依存パッケージのインストール）
#   3. gen/ ディレクトリの初期化
#   4. .env ファイルの作成（未作成の場合）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# --- ユーティリティ ---
info()  { echo "✓ $*"; }
warn()  { echo "⚠ $*"; }
error() { echo "✗ $*" >&2; exit 1; }
step()  { echo ""; echo "--- $* ---"; }

# --- 1. Node.js チェック ---
step "Node.js チェック"
if ! command -v node &>/dev/null; then
  error "Node.js がインストールされていません。https://nodejs.org/ からインストールしてください"
fi
NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  error "Node.js v20 以上が必要です（現在: v$NODE_VERSION）"
fi
info "Node.js v$NODE_VERSION"

# --- 2. pnpm チェック & install ---
step "依存パッケージのインストール"
if ! command -v pnpm &>/dev/null; then
  warn "pnpm が見つかりません。corepack で有効化します..."
  corepack enable
  corepack prepare pnpm@10.28.0 --activate
fi
PNPM_VERSION=$(pnpm -v)
info "pnpm v$PNPM_VERSION"

pnpm install
info "依存パッケージのインストール完了"

# --- 3. gen/ ディレクトリの初期化 ---
step "gen/ ディレクトリの初期化"

# app.config.yaml から output_base_dir を読み取る（デフォルト: gen）
OUTPUT_BASE_DIR="gen"
if [ -f "app.config.yaml" ]; then
  PARSED=$(grep '^output_base_dir:' app.config.yaml | sed 's/^output_base_dir:[[:space:]]*//' || true)
  if [ -n "$PARSED" ]; then
    OUTPUT_BASE_DIR="$PARSED"
  fi
fi

DIRS=(
  "$OUTPUT_BASE_DIR/data_source"
  "$OUTPUT_BASE_DIR/requirements"
  "$OUTPUT_BASE_DIR/datasets"
)

for dir in "${DIRS[@]}"; do
  mkdir -p "$dir"
  info "$dir/"
done

# data_source の README を配置（テンプレートが存在する場合）
if [ ! -f "$OUTPUT_BASE_DIR/data_source/README.md" ]; then
  cat > "$OUTPUT_BASE_DIR/data_source/README.md" << 'HEREDOC'
# data_source

外部API（NewsAPI、YouTube Data API等）から取得したトレンド情報の生データを格納するディレクトリです。

## ディレクトリ構造

データ収集（`pnpm collect`）を実行するたびに、タイムスタンプ付きのサブディレクトリが作成されます。

```text
data_source/
└── yyyy_mm_dd_hh_mm_ss/
    ├── news.json         # NewsAPIから取得した記事データ
    ├── youtube.json      # YouTube Data APIから取得した動画データ（有効時のみ）
    └── keyword.json      # キーワード抽出（pnpm extract）で生成
```
HEREDOC
  info "data_source/README.md を作成"
fi

# .gitkeep を配置（空ディレクトリをgit管理する場合用）
for dir in "${DIRS[@]}"; do
  if [ "$(ls -A "$dir" 2>/dev/null | head -1)" = "" ]; then
    touch "$dir/.gitkeep"
  fi
done

info "gen/ ディレクトリの初期化完了"

# --- 4. .env ファイルの作成 ---
step ".env ファイルの作成"

if [ -f ".env" ]; then
  info ".env は既に存在します（スキップ）"
else
  cat > .env << 'HEREDOC'
# === Requirements Creator 環境変数 ===

# NewsAPI (https://newsapi.org/)
NEWS_API_KEY=

# YouTube Data API (https://developers.google.com/youtube/v3)
# app.config.yaml で enabled: true にした場合に必要
YOUTUBE_API_KEY=
HEREDOC
  info ".env を作成しました。APIキーを設定してください"
fi

# --- 完了 ---
step "セットアップ完了"
echo ""
echo "次のステップ:"
echo "  1. .env にAPIキーを設定"
echo "  2. pnpm collect でデータ収集を開始"
echo "  3. pnpm pipeline で一括実行"
echo ""
