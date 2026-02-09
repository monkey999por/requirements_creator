# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<language>Japanese</language>
<character_code>UTF-8</character_code>

## プロジェクト概要

ニュースやトレンド情報を収集し、そこからアプリケーション設計アイデアを連想方式で生成するツール。収集したデータからキーワードを抽出し、要件定義（overview + 機能別仕様）を自動生成する。生成された要件はMarkdownベースのWebビューワーで閲覧可能。

## アーキテクチャ

### データパイプライン

1. **データ収集** (`pnpm collect`): NewsAPI・YouTube等の外部APIからトレンド情報を取得し `gen/data_source/yyyy_mm_dd_hh_mm_ss/` に保存
2. **キーワード抽出** (`pnpm extract`): 収集データからアプリ設計のヒントとなるキーワードを抽出（`keyword.json`）
3. **要件生成** (`pnpm generate`): キーワードからの連想でアプリ案を生成し `gen/requirements/{app_name}/` に配置
4. **バリデーション** (`pnpm generate:validate`): 生成された要件の構造・内容を自動検証
5. **閲覧** (`pnpm viewer`): Hono + React製のMarkdownビューワーで要件を表示

一括実行: `pnpm pipeline` で収集→抽出→生成→検証を連続実行可能（`--skip-collect`, `--skip-extract`, `--source <dir>` オプション対応）

### ディレクトリ構造

```text
.
├── .claude/                  # Claude Code設定
│   ├── settings.json         # 権限・フック設定
│   ├── agents/               # カスタムエージェント定義
│   │   ├── update-memory.md
│   │   ├── update-docs.md
│   │   └── tech-spec-validator.md
│   └── skills/               # カスタムスキル定義
│       ├── create-agent/
│       ├── create-skill/
│       ├── extract-keywords/
│       ├── fix-issue/
│       └── generate-requirements/
├── gen/                      # 生成データ出力先（.gitignore対象）
│   ├── data_source/          # 外部APIから取得した生データ（タイムスタンプ付きサブディレクトリ）
│   │   └── yyyy_mm_dd_hh_mm_ss/
│   │       ├── news.json
│   │       └── keyword.json
│   └── requirements/         # 生成されたアプリ要件（アプリ単位のサブディレクトリ）
│       └── {app_name}/
│           ├── _source_info.md
│           ├── overview.md
│           └── features/
│               └── {nn}_{feature_name}.md
├── scripts/                  # CLIツール群
│   ├── collect.ts            # データ収集
│   ├── extract.sh / extract.ts  # キーワード抽出
│   ├── generate.sh / generate.ts  # 要件生成
│   ├── validate-requirements.ts  # バリデーション
│   ├── pipeline.ts           # パイプライン一括実行
│   └── lib/                  # 共通ライブラリ
│       ├── cli.ts            # CLIオプションパーサー
│       ├── config.ts         # app.config.yaml読み込み
│       ├── data-source.ts    # data_source操作ユーティリティ
│       ├── fetchers.ts       # API呼び出し（NewsAPI等）
│       └── storage.ts        # ファイル出力
├── viewer/                   # Webビューワー（pnpmワークスペースパッケージ）
│   ├── server.ts             # Hono APIサーバ + Vite dev middleware
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── index.css
│       ├── main.tsx
│       └── components/
│           ├── AppView.tsx    # メインビュー（overview + features表示）
│           ├── MarkdownPane.tsx  # Markdownレンダリング
│           └── Sidebar.tsx    # アプリ選択サイドバー
├── todo/                     # 開発タスク管理（フェーズ別）
├── app.config.yaml           # アプリケーション設定（フェーズ別の設定を階層管理）
├── biome.jsonc               # Biome設定（フォーマッター・リンター）
├── tsconfig.json             # TypeScript設定（scripts用）
├── pnpm-workspace.yaml       # pnpmワークスペース定義（viewer）
└── package.json
```

### 技術スタック

**ランタイム・言語**:

- Node.js + TypeScript 5.9
- tsx（TypeScript実行）

**データ収集・処理**:

- スクリプト: TypeScript（tsx）+ シェルスクリプト
- 設定: YAML（`app.config.yaml`、`yaml`パッケージで読み込み）
- 環境変数: `dotenv`

**Webビューワー** (`viewer/`):

- サーバ: Hono + @hono/node-server
- フロントエンド: React 19 + Vite 6
- スタイリング: Tailwind CSS 4 + @tailwindcss/typography
- Markdownレンダリング: react-markdown + remark-gfm
- アニメーション: motion (framer-motion)
- 開発サーバ: Vite dev middleware統合（APIとフロントエンドを同一ポートで提供）

**開発ツール**:

- パッケージマネージャ: pnpm 10.28.0（ワークスペース構成）
- フォーマッター / リンター: Biome 2.3
- フォーマット自動実行: Claude Codeのファイル編集時にPostToolUseフックで `pnpm format` が自動実行

## 開発コマンド

### パイプライン（データ収集→要件生成）

| コマンド | 説明 |
| --------- | ------ |
| `pnpm collect` | 外部APIからデータ収集（`app.config.yaml`に基づく） |
| `pnpm extract` | 収集データからキーワード抽出 |
| `pnpm generate` | キーワードから要件生成 |
| `pnpm generate:validate` | 要件構造のバリデーション |
| `pnpm pipeline` | 上記を一括実行（`--skip-collect`, `--skip-extract`, `--source <dir>` オプション対応） |

### Webビューワー

| コマンド | 説明 |
| --------- | ------ |
| `pnpm viewer` | 開発サーバ起動（<http://localhost:3001>、HMR対応） |
| `pnpm viewer:build` | 本番ビルド |
| `pnpm viewer:start` | 本番サーバ起動 |

### コード品質

| コマンド | 説明 |
| --------- | ------ |
| `pnpm format` | Biomeでフォーマット（ファイル編集時にhookで自動実行） |
| `pnpm lint` | Biomeでリント |
| `pnpm check` | Biomeでフォーマット+リントの一括チェック・修正 |

## コーディング規約

### Biome設定（`biome.jsonc`）

- インデント: スペース2つ
- 行幅上限: 100文字
- クォート: ダブルクォート
- セミコロン: 常に付与
- 対象: `scripts/**`, `src/**`, `viewer/**`（CSS、node_modules、distは除外）

### その他

- ドキュメント・コミュニケーションは日本語（コード例は除く）
- 技術選定時は必ず公式ドキュメントを参照し、内部知識だけで判断しない（`tech-spec-validator`エージェントを活用）
- 調査結果は `docs/_research/{date}_{title}` 形式でドキュメント化
- コミットメッセージは `fix:`, `feat:`, `refactor:`, `docs:` 等のconventional commits形式

## 環境変数

`.env` に以下のAPIキーを設定:

- `NEWS_API_KEY` - NewsAPI用
- `YOUTUBE_API_KEY` - YouTube Data API用（`app.config.yaml`で`enabled: false`がデフォルト）

## アプリケーション設定（`app.config.yaml`）

フェーズごとの設定を階層管理する設定ファイル。`collect.sources` 配下にデータソースごとの有効/無効、APIエンドポイント、パラメータ、出力ファイル名を定義。対応ソース:

- **NewsAPI**: 有効（デフォルト）。USビジネスニュースのトップヘッドライン取得
- **YouTube Data API**: 無効（デフォルト）。人気動画ランキング取得
- TikTok、RSSフィード: 今後追加予定（設定テンプレートのみ）

## カスタムエージェント

- `update-memory` - CLAUDE.mdをプロジェクト最新情報に同期更新
- `update-docs` - README.md / docs配下のドキュメントをコードベースに同期更新
- `tech-spec-validator` - ライブラリ導入時に最新の公式ドキュメントを調査し、ベストプラクティスに基づく実装を行う。推測での実装を禁止

## カスタムスキル

- `extract-keywords` - data_source配下の収集データからキーワードとトレンドを抽出し`keyword.json`を生成
- `generate-requirements` - keyword.jsonを元にアプリ案を構想し、`requirements/`配下に所定構造で要件定義を出力。バリデーションまで実行
- `fix-issue` - GitHub Issueの内容確認→対応方針合意→Issueコメント→コード修正→PR作成のワークフロー
- `create-agent` - 会話内容をClaude Codeサブエージェント（`.claude/agents/*.md`）として永続化
- `create-skill` - 会話内容をClaude Codeスキル（`.claude/skills/*/SKILL.md`）として永続化

## Viewer API仕様

ビューワーサーバ（Hono）が提供するAPIエンドポイント:

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/apps` | アプリ一覧 |
| `GET /api/apps/:name/overview` | overview.mdの内容 |
| `GET /api/apps/:name/features` | 機能一覧（タイトル・概要付き） |
| `GET /api/apps/:name/features/:featureId` | 機能詳細のMarkdown |
| `GET /api/apps/:name/source-info` | _source_info.mdの内容 |

## pnpmワークスペース構成

```yaml
packages:
  - viewer
```

`viewer/` は独立したパッケージとして管理。ルートの `pnpm --filter viewer <cmd>` で操作。
