#!/usr/bin/env bash
set -euo pipefail

# ========================================
# プロジェクト初期セットアップスクリプト
# ========================================
# 実行方法: bash setup.sh
#
# 以下を一括で実行します:
#   1. Node.js バージョンチェック
#   2. pnpm install（依存パッケージのインストール）
#   3. gen/ ディレクトリの初期化
#   4. .env ファイルの作成（未作成の場合）

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
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

# --- 3. gen/ ディレクトリの初期化（requirements_pool リポジトリのクローン） ---
step "gen/ ディレクトリの初期化"

# app.config.yaml から output_base_dir を読み取る（デフォルト: gen）
OUTPUT_BASE_DIR="gen"
if [ -f "app.config.yaml" ]; then
  PARSED=$(grep '^output_base_dir:' app.config.yaml | sed 's/^output_base_dir:[[:space:]]*//' || true)
  if [ -n "$PARSED" ]; then
    OUTPUT_BASE_DIR="$PARSED"
  fi
fi

GEN_REPO="git@github.com:monkey999por/requirements_pool.git"

if [ -d "$OUTPUT_BASE_DIR/.git" ]; then
  info "$OUTPUT_BASE_DIR/ は既にgitリポジトリです（pull で最新化）"
  git -C "$OUTPUT_BASE_DIR" pull --ff-only || warn "pull に失敗しました。手動で確認してください"
elif [ -d "$OUTPUT_BASE_DIR" ] && [ "$(ls -A "$OUTPUT_BASE_DIR" 2>/dev/null)" ]; then
  warn "$OUTPUT_BASE_DIR/ が既に存在し、空ではありません（クローンをスキップ）"
  warn "requirements_pool を使用するには、$OUTPUT_BASE_DIR/ を削除してから再実行してください"
else
  rm -rf "$OUTPUT_BASE_DIR"
  git clone "$GEN_REPO" "$OUTPUT_BASE_DIR"
  info "$OUTPUT_BASE_DIR/ に requirements_pool をクローンしました"
fi

# 必要なサブディレクトリが存在しない場合は作成
for dir in "$OUTPUT_BASE_DIR/data_source" "$OUTPUT_BASE_DIR/requirements"; do
  mkdir -p "$dir"
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
