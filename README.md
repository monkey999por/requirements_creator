# Requirements Creator

ニュースやトレンド情報を収集し、そこからアプリケーション設計アイデアを連想方式で生成するツールです。

外部API（NewsAPI、YouTube Data API等）から取得したデータをもとにキーワードを抽出し、要件定義（overview + 機能別仕様）をMarkdown形式で自動生成します。生成された要件はWebビューワーで閲覧できます。

## 動作の流れ

```
外部API (NewsAPI等)
  |
  v
[1. データ収集] pnpm collect
  |  data_source/yyyy_mm_dd_hh_mm_ss/news.json
  v
[2. キーワード抽出] pnpm extract
  |  data_source/yyyy_mm_dd_hh_mm_ss/keyword.json
  v
[3. 要件生成] pnpm generate
  |  requirements/{app_name}/overview.md, features/*.md
  v
[4. バリデーション] pnpm generate:validate
  |  構造・必須セクションの自動検証
  v
[5. 閲覧] pnpm viewer
     http://localhost:3001 でMarkdownビューワー表示
```

一括実行: `pnpm pipeline` で 1〜4 を連続実行できます。

## セットアップ

### 前提条件

- Node.js
- pnpm 10.28.0
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` コマンド) - キーワード抽出・要件生成で使用

### インストール

```bash
# 依存パッケージのインストール
pnpm install
```

### 環境変数

プロジェクトルートに `.env` ファイルを作成し、以下のAPIキーを設定してください。

```env
NEWS_API_KEY=your_newsapi_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here  # オプション（デフォルト無効）
```

- `NEWS_API_KEY` - [NewsAPI](https://newsapi.org/) のAPIキー（必須）
- `YOUTUBE_API_KEY` - [YouTube Data API](https://developers.google.com/youtube/v3) のAPIキー（`collect.config.yaml` で `enabled: false` がデフォルト）

## コマンド一覧

### パイプライン（データ収集 → 要件生成）

| コマンド | 説明 |
| --- | --- |
| `pnpm collect` | 外部APIからトレンドデータを収集し `data_source/` に保存 |
| `pnpm extract` | 収集データからキーワードを抽出し `keyword.json` を生成 |
| `pnpm generate` | キーワードから連想方式でアプリ要件を生成 |
| `pnpm generate:validate` | 生成された要件の構造・必須セクションを検証 |
| `pnpm pipeline` | 上記を一括実行 |

#### pnpm pipeline のオプション

```bash
# 全ステップ実行
pnpm pipeline

# データ収集をスキップ（既存データを使用）
pnpm pipeline --skip-collect

# キーワード抽出もスキップ（既存キーワードを使用）
pnpm pipeline --skip-collect --skip-extract

# 特定のdata_sourceディレクトリを指定
pnpm pipeline --source 2025_01_15_12_00_00
```

#### pnpm collect のオプション

```bash
# 通常実行
pnpm collect

# 特定のソースのみ
pnpm collect -- --only newsapi

# ドライラン（実際にはリクエストしない）
pnpm collect -- --dry-run
```

### Webビューワー

| コマンド | 説明 |
| --- | --- |
| `pnpm viewer` | 開発サーバ起動（http://localhost:3001、HMR対応） |
| `pnpm viewer:build` | 本番ビルド |
| `pnpm viewer:start` | 本番サーバ起動 |

ポート3001が使用中の場合、自動的に次のポート（3002, 3003, ...）にフォールバックします。

### コード品質

| コマンド | 説明 |
| --- | --- |
| `pnpm format` | Biomeでコードフォーマット |
| `pnpm lint` | Biomeでリント |
| `pnpm check` | フォーマット + リントの一括チェック・修正 |

## ディレクトリ構造

```text
.
├── scripts/                  # CLIツール群
│   ├── collect.ts            # データ収集スクリプト
│   ├── extract.sh            # キーワード抽出（Claude Code CLI呼び出し）
│   ├── extract.ts            # キーワード抽出のTypeScript版
│   ├── generate.sh           # 要件生成（Claude Code CLI呼び出し）
│   ├── generate.ts           # 要件生成のTypeScript版
│   ├── validate-requirements.ts  # 要件バリデーション
│   ├── pipeline.ts           # パイプライン一括実行
│   └── lib/                  # 共通ライブラリ
│       ├── cli.ts            # CLIオプションパーサー
│       ├── config.ts         # collect.config.yaml読み込み
│       ├── data-source.ts    # data_source操作ユーティリティ
│       ├── fetchers.ts       # API呼び出し（NewsAPI等）
│       └── storage.ts        # ファイル出力
├── data_source/              # 外部APIから取得した生データ
│   └── yyyy_mm_dd_hh_mm_ss/ # タイムスタンプ付きサブディレクトリ
│       ├── news.json         # NewsAPIから取得した記事データ
│       └── keyword.json      # 抽出されたキーワード
├── requirements/             # 生成されたアプリ要件
│   └── {app_name}/          # アプリ単位のサブディレクトリ（kebab-case）
│       ├── _source_info.md   # 使用データソース・キーワード・生成経緯
│       ├── overview.md       # アプリ概要（コンセプト、機能一覧、技術スタック等）
│       ├── memo.md           # メモ（ビューワーから編集可能）
│       └── features/         # 機能別仕様
│           └── {nn}_{feature_name}.md  # 各機能の詳細仕様
├── viewer/                   # Webビューワー（pnpmワークスペースパッケージ）
│   ├── server.ts             # Hono APIサーバ + Vite dev middleware
│   ├── vite.config.ts        # Vite設定
│   └── src/
│       ├── App.tsx           # メインアプリケーション
│       ├── api.ts            # APIクライアント
│       ├── main.tsx          # エントリポイント
│       ├── index.css         # スタイル（Tailwind CSS）
│       ├── hooks/
│       │   └── useIsMobile.ts
│       └── components/
│           ├── AppView.tsx    # メインビュー（overview + features表示）
│           ├── MarkdownPane.tsx  # Markdownレンダリング
│           ├── MemoTab.tsx    # メモ編集タブ
│           └── Sidebar.tsx    # アプリ選択サイドバー
├── .claude/                  # Claude Code設定
│   ├── settings.json         # 権限・フック設定
│   ├── agents/               # カスタムエージェント定義
│   └── skills/               # カスタムスキル定義
├── collect.config.yaml       # データ収集設定
├── biome.jsonc               # Biome設定（フォーマッター・リンター）
├── tsconfig.json             # TypeScript設定
├── pnpm-workspace.yaml       # pnpmワークスペース定義
└── package.json
```

## データ収集設定

`collect.config.yaml` でデータソースごとの有効/無効、APIエンドポイント、パラメータを管理します。

| データソース | 状態 | 説明 |
| --- | --- | --- |
| NewsAPI | 有効（デフォルト） | USビジネスニュースのトップヘッドライン取得 |
| YouTube Data API | 無効（デフォルト） | 人気動画ランキング取得 |
| TikTok | 未実装 | 設定テンプレートのみ |
| RSSフィード | 未実装 | 設定テンプレートのみ |

## 要件のフォーマット

### overview.md の必須セクション

- コンセプト
- ターゲットユーザー
- 機能一覧（テーブル形式：ID / 機能名 / 概要）
- マネタイズ
- 技術スタック
- 運用方針

### features/{nn}_{feature_name}.md の必須セクション

- 概要
- 画面構成
- ユーザーフロー
- データモデル
- API設計
- 非機能要件

### _source_info.md の必須セクション

- 使用データソース
- 使用キーワード
- 生成の経緯

## Viewer API

ビューワーサーバ（Hono）が提供するAPIエンドポイント:

| エンドポイント | メソッド | 説明 |
| --- | --- | --- |
| `/api/apps` | GET | アプリ一覧 |
| `/api/apps/:name/overview` | GET | overview.mdの内容 |
| `/api/apps/:name/features` | GET | 機能一覧（タイトル・概要付き） |
| `/api/apps/:name/features/:featureId` | GET | 機能詳細のMarkdown |
| `/api/apps/:name/source-info` | GET | _source_info.mdの内容 |
| `/api/apps/:name/memo` | GET | memo.mdの内容 |
| `/api/apps/:name/memo` | POST | memo.mdの更新（開発モードのみ） |
| `/api/mode` | GET | 現在の動作モード（dev/production） |

## 技術スタック

### ランタイム・言語

- Node.js + TypeScript 5.9
- tsx（TypeScript実行）

### データ収集・処理

- TypeScript（tsx）+ シェルスクリプト
- YAML設定（`yaml` パッケージ）
- 環境変数管理（`dotenv`）
- Claude Code CLI（キーワード抽出・要件生成で使用）

### Webビューワー

- サーバ: Hono + @hono/node-server
- フロントエンド: React 19 + Vite 6
- スタイリング: Tailwind CSS 4 + @tailwindcss/typography
- Markdownレンダリング: react-markdown + remark-gfm
- アニメーション: motion

### 開発ツール

- パッケージマネージャ: pnpm 10.28.0（ワークスペース構成）
- フォーマッター / リンター: Biome 2.3
