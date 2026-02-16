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

6. **自己修復** (`pnpm self-healing`): パイプラインのJSONLログを解析し、config不整合や繰り返しエラーを検出。Claude Codeで自動修復しPR作成

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
│       ├── generate-requirements/
│       ├── refactor-dedup/
│       └── self-healing/
├── gen/                      # 生成データ出力先（.gitignore対象）
│   ├── tags.json             # タグ定義（generateごとに自由に追加可能）
│   ├── data_source/          # 外部APIから取得した生データ（タイムスタンプ付きサブディレクトリ）
│   │   └── yyyy_mm_dd_hh_mm_ss/
│   │       ├── news.json
│   │       └── keyword.json
│   ├── datasets/             # データセット定義（JSON、Viewer経由で管理）
│   │   └── {dataset_name}.json
│   ├── pipeline_queue/       # パイプラインキュー（アイデアをJSON保存、スケジューラで自動処理）
│   │   └── {id}.json
│   └── requirements/         # 生成されたアプリ要件（アプリ単位のサブディレクトリ）
│       └── {app_name}/
│           ├── _source_info.json
│           ├── overview.md
│           ├── memo.md           # メモ（Viewerから編集可能、dev mode時のみ）
│           ├── features/
│           │   └── {nn}_{feature_name}.md
│           └── diagrams/         # 図解（Mermaid等のMarkdown）
│               └── {nn}_{diagram_name}.md
├── scripts/                  # CLIツール群
│   ├── collect.ts            # データ収集
│   ├── extract.sh / extract.ts  # キーワード抽出
│   ├── generate.sh / generate.ts  # 要件生成
│   ├── regenerate.sh         # 既存アプリの再生成
│   ├── validate-requirements.ts  # バリデーション
│   ├── pipeline.ts           # パイプライン一括実行（PipelineLogger統合）
│   ├── process-queue.ts      # パイプラインキュー処理（先頭1件のみpipeline実行）
│   ├── self-healing.ts       # 自己修復（ログ解析→config不整合チェック→Claude Code修復→PR作成）
│   ├── self-healing-run.sh   # 自己修復用systemdタイマーラッパー
│   ├── scheduler-run.sh      # systemdタイマー用ラッパー（キュー優先で分岐実行）
│   ├── scheduler-ctl.sh      # systemdスケジューラの有効/無効/状態確認（--target対応）
│   ├── test-slack-notify.ts  # Slack通知テスト
│   └── lib/                  # 共通ライブラリ
│       ├── agents.ts         # マルチエージェント管理
│       ├── claude-stream-filter.ts  # Claude CLIストリーム処理
│       ├── cli.ts            # CLIオプションパーサー
│       ├── common.sh         # シェルスクリプト共通関数（pipeline_log()等）
│       ├── config.ts         # app.config.yaml読み込み
│       ├── data-source.ts    # data_source操作ユーティリティ
│       ├── fetchers.ts       # API呼び出し（NewsAPI等）
│       ├── logger.ts         # JSONL構造化ログ（PipelineLoggerクラス）
│       ├── generate-helpers.sh  # 生成ヘルパー（シェル）
│       ├── paths.ts          # パス定数
│       ├── select-source.sh  # データソース選択（シェル）
│       ├── slack.ts          # Slack通知
│       ├── storage.ts        # ファイル出力
│       └── tags.ts           # タグ管理（gen/tags.jsonから動的読み込み・バリデーション）
├── systemd/                  # systemdユニットファイル
│   ├── self-healing.timer    # 自己修復の定期実行タイマー
│   └── self-healing.service  # 自己修復サービス定義
├── viewer/                   # Webビューワー（pnpmワークスペースパッケージ）
│   ├── server.ts             # Hono APIサーバ + Vite dev middleware
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx           # ViewMode: "apps" | "datasets" | "commands" | "config" | "queue" | "scheduler"
│       ├── animations.ts     # 共通アニメーション定義
│       ├── api.ts
│       ├── index.css
│       ├── main.tsx
│       ├── hooks/            # カスタムフック
│       │   ├── useIsMobile.ts     # モバイル判定
│       │   ├── useMessageToast.ts # トースト通知管理
│       │   ├── useSwipeTab.ts     # スワイプによるタブ切替
│       │   └── useZoomPan.ts      # ズーム・パン操作
│       └── components/
│           ├── AppView.tsx        # メインビュー（overview + features + diagrams + memo表示）
│           ├── DatasetAddButton.tsx  # データセットへのアイテム追加ボタン
│           ├── DatasetManager.tsx # データセット管理画面（プレビューペイン・ナビゲーション付き）
│           ├── MarkdownPane.tsx   # Markdownレンダリング
│           ├── MemoTab.tsx        # メモ編集タブ
│           ├── QueueManager.tsx   # パイプラインキュー管理画面（CRUD操作・個別実行）
│           ├── SchedulerSettings.tsx  # スケジューラ設定画面（有効/無効・スケジュール編集）
│           ├── SearchView.tsx     # 検索結果表示
│           ├── Sidebar.tsx        # アプリ選択サイドバー（タグフィルタ・検索機能付き）
│           ├── CommandRunner.tsx  # コマンド実行UI（パイプライン操作等）
│           ├── ConfigEditor.tsx   # app.config.yaml編集UI
│           ├── Toast.tsx          # トースト通知
│           └── shared/            # 共通UIコンポーネント
│               ├── BackButton.tsx     # 戻るボタン
│               ├── CreateButton.tsx   # 作成ボタン
│               ├── EmptyState.tsx     # 空状態表示
│               ├── FormControls.tsx   # フォームコントロール
│               ├── Icons.tsx          # 共通アイコン（SVG）
│               ├── LoadingSpinner.tsx  # ローディング表示
│               ├── MessageToast.tsx   # メッセージトースト
│               ├── SaveButton.tsx     # 保存ボタン
│               └── TypeBadge.tsx      # タイプバッジ
├── todo/                     # 開発タスク管理（フェーズ別）
├── USECASE_SELF_HEALING.md   # 自己修復機能のユースケースドキュメント
├── app.config.yaml           # アプリケーション設定（フェーズ別の設定を階層管理）
├── biome.jsonc               # Biome設定（フォーマッター・リンター）
├── tsconfig.json             # TypeScript設定（scripts用）
├── pnpm-workspace.yaml       # pnpmワークスペース定義（viewer）
└── package.json
```

### 技術スタック

**ランタイム・言語**:

- Node.js >= 22 + TypeScript 5.9
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
- 図解: mermaid（Mermaidダイアグラムのレンダリング）
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
| `pnpm regenerate` | 既存アプリの要件を再生成 |
| `pnpm queue:process` | パイプラインキュー内の先頭1件を処理 |

### 自己修復

| コマンド | 説明 |
| --------- | ------ |
| `pnpm self-healing` | パイプラインログ解析→config不整合チェック→自動修復→PR作成 |

### スケジューラ

| コマンド | 説明 |
| --------- | ------ |
| `pnpm scheduler:enable` | systemdスケジューラを有効化（`--target pipeline\|self-healing\|all`） |
| `pnpm scheduler:disable` | systemdスケジューラを無効化（`--target pipeline\|self-healing\|all`） |
| `pnpm scheduler:status` | スケジューラの状態・今後の実行予定を表示（`--target pipeline\|self-healing\|all`） |

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

### テスト・ユーティリティ

| コマンド | 説明 |
| --------- | ------ |
| `pnpm test:slack` | Slack通知のテスト送信 |

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
- `YOUTUBE_DATA_API_KEY` - YouTube Data API用
- `X_API_BEARER_TOKEN` - X (Twitter) API用（トレンド・人気投稿取得）
- `THREADS_ACCESS_TOKEN` - Threads API用（キーワード検索）
- `SLACK_BOT_USER_OAUTH_TOKEN` - Slack通知用

## アプリケーション設定（`app.config.yaml`）

フェーズごとの設定を階層管理する設定ファイル。

### データ収集（`collect`）

`collect.sources` 配下にデータソースごとの有効/無効、APIエンドポイント、パラメータ、出力ファイル名を定義。対応ソース:

- **NewsAPI**: ニューストップヘッドライン取得
- **YouTube Data API**: カテゴリ指定・全体ランキングの人気動画取得（複数ソース設定可能）
- **X (Twitter)**: トレンド取得（`x`）+ 人気投稿取得（`x_popular_posts`）
- **Threads**: キーワード検索による投稿取得
- TikTok、RSSフィード: 今後追加予定（設定テンプレートのみ）

### キーワード抽出（`extract`）

`extract.association` で連想ゲーム方式の有効/無効と連想の深さを制御。

- **`association.enabled`**: 連想モードの有効/無効（デフォルト: `true`）
  - `true`: 収集データから直接抽出したキーワードに加え、連想で関連キーワードも抽出
  - `false`: 収集データに直接記載されているキーワードのみ抽出
- **`association.depth`**: 連想の深さ（デフォルト: `moderate`）
  - `shallow`: 1段階の連想（直接的な関連語・類義語）
  - `moderate`: 2段階の連想（関連分野・応用領域まで）
  - `deep`: 3段階以上の連想（異分野の組み合わせ・創造的な飛躍まで）

連想モード設定は `scripts/extract.sh` がClaude Code CLIに渡し、生成された `keyword.json` に記録される。各キーワードには `"source": "direct"` または `"source": "association"` が付与される。

### 要件生成（`generate`）

- **`constraints`**: 生成アプリの技術的制約（platform, budget, difficulty, team_size, tech_stack）
- **`perspectives`**: アプリ案の体験設計・マネタイズ戦略（mode: single/combine/random、items: kindness/cunning/frustration/dopamine/target-focus）
- **`agents`**: マルチエージェント設定（Codex: designer+reviewer、Gemini: designer+researcher）

### 通知（`notifications`）

`notifications.slack` でSlack通知を制御。

- **`enabled`**: Slack通知の有効/無効
- **`token_env`**: Bot Token環境変数名
- **`viewer_host`**: Viewerへのリンク生成用ホスト（通知メッセージにアプリへのリンクを含める）
- **`mention`**: メンション設定（Slack User IDまたは`channel`）

## タグシステム

タグ定義は `gen/tags.json`（文字列配列）に外部化されており、generateのたびに自由に追加可能。

- **定義ファイル**: `gen/tags.json` -- 全タグの文字列配列
- **バリデーション**: `scripts/lib/tags.ts` が `gen/tags.json` を動的に読み込み、各アプリに最低3つのタグを要求
- **Viewer連携**: Sidebarのタグ選択は `GET /api/tags` から動的に取得（ハードコーディングなし）
- **表示**: アプリ一覧では最大3つのタグをバッジ表示

## カスタムエージェント

- `update-memory` - CLAUDE.mdをプロジェクト最新情報に同期更新
- `update-docs` - README.md / docs配下のドキュメントをコードベースに同期更新
- `tech-spec-validator` - ライブラリ導入時に最新の公式ドキュメントを調査し、ベストプラクティスに基づく実装を行う。推測での実装を禁止

## カスタムスキル

- `extract-keywords` - data_source配下の収集データからキーワードとトレンドを抽出し`keyword.json`を生成。連想モード有効時は直接抽出に加え、関連キーワードを連想ゲーム方式で追加（`app.config.yaml`の`extract.association`設定に従う）
- `generate-requirements` - keyword.jsonを元にアプリ案を構想し、`requirements/`配下に所定構造で要件定義を出力。バリデーションまで実行
- `fix-issue` - GitHub Issueの内容確認→対応方針合意→Issueコメント→コード修正→PR作成のワークフロー
- `create-agent` - 会話内容をClaude Codeサブエージェント（`.claude/agents/*.md`）として永続化
- `create-skill` - 会話内容をClaude Codeスキル（`.claude/skills/*/SKILL.md`）として永続化
- `refactor-dedup` - コードの重複を検出・共通化するリファクタリング
- `self-healing` - パイプラインのJSONLログを解析し、エラーパターンやconfig不整合を検出してClaude Codeで自動修復・PR作成

## Viewer API仕様

ビューワーサーバ（Hono）が提供するAPIエンドポイント:

### アプリ・コンテンツ

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/apps` | アプリ一覧（タグ最大3つ付き、更新日時降順） |
| `GET /api/apps/:name/overview` | overview.mdの内容 |
| `GET /api/apps/:name/features` | 機能一覧（タイトル・概要付き） |
| `GET /api/apps/:name/features/:featureId` | 機能詳細のMarkdown |
| `GET /api/apps/:name/source-info` | _source_info.jsonの内容 |
| `GET /api/apps/:name/diagrams` | 図解一覧（Markdown） |
| `GET /api/apps/:name/memo` | メモ内容の取得 |
| `POST /api/apps/:name/memo` | メモ内容の保存（dev modeのみ） |
| `GET /api/tags` | 定義済みタグ一覧（`gen/tags.json`） |
| `GET /api/mode` | 動作モード（isDev）の取得 |

### データセット

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/datasets` | データセット一覧 |
| `GET /api/datasets/:name` | データセット詳細 |
| `POST /api/datasets` | データセット作成（dev modeのみ） |
| `DELETE /api/datasets/:name` | データセット削除（dev modeのみ） |
| `POST /api/datasets/:name/items` | データセットにアイテム追加（dev modeのみ） |
| `DELETE /api/datasets/:name/items` | データセットからアイテム削除（dev modeのみ） |
| `POST /api/datasets/:name/generate` | データセットからパイプライン実行（dev modeのみ） |
| `GET /api/datasets/:name/generated-apps` | データセットから生成されたアプリ一覧 |

### 検索

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/apps-with-tags` | 全アプリのタグ情報（全タグ取得、名前順） |
| `GET /api/search?q=&tags=` | 全文検索 + タグAND検索（複合検索対応） |

### パイプラインキュー

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/queue` | キューアイテム一覧取得 |
| `GET /api/queue/:id` | キューアイテム詳細取得 |
| `POST /api/queue` | キューアイテム作成（dev modeのみ、body: `{title, content}`） |
| `PUT /api/queue/:id` | キューアイテム更新（dev modeのみ、body: `{title?, content?}`） |
| `DELETE /api/queue/:id` | キューアイテム削除（dev modeのみ） |
| `POST /api/queue/:id/execute` | キューアイテムを個別実行（dev modeのみ） |

### スケジューラ

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/scheduler/status` | スケジューラの状態取得 |
| `POST /api/scheduler/enable` | スケジューラを有効化（dev modeのみ） |
| `POST /api/scheduler/disable` | スケジューラを無効化（dev modeのみ） |
| `POST /api/scheduler/schedule` | スケジュール設定変更（dev modeのみ、body: `{days, times}`） |

### 設定

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/config` | app.config.yamlの内容取得 |
| `PUT /api/config` | app.config.yamlの更新（dev modeのみ） |
| `GET /api/apps/:name/config` | アプリ固有の設定取得 |

### コマンド実行

| エンドポイント | 説明 |
| -------------- | ------ |
| `GET /api/commands/data-sources` | データソース一覧 |
| `GET /api/commands/apps` | アプリ名一覧 |
| `GET /api/commands/collect-sources` | 収集ソース一覧（config由来） |
| `GET /api/commands/dataset-names` | データセット名一覧 |
| `POST /api/commands/execute` | コマンド実行（dev modeのみ、body: `{command, args}`） |
| `POST /api/commands/abort` | 実行中コマンドの中止 |

### Git操作

| エンドポイント | 説明 |
| -------------- | ------ |
| `POST /api/git/commit-push` | genディレクトリのgit add + commit + push（dev modeのみ） |
| `GET /api/git/branch` | 現在のブランチ名取得 |
| `POST /api/git/switch-branch` | main/develop間のブランチ切り替え（dev modeのみ） |

## pnpmワークスペース構成

```yaml
packages:
  - viewer
```

`viewer/` は独立したパッケージとして管理。ルートの `pnpm --filter viewer <cmd>` で操作。
