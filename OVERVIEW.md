# 機能一覧（OVERVIEW）

## データパイプライン（CLI）

### データ収集

- `pnpm collect` — 外部API（NewsAPI・YouTube等）からトレンド情報を取得し `gen/data_source/` に保存
- NewsAPI: USビジネスニュースのトップヘッドライン取得
- YouTube Data API: 人気動画ランキング取得（デフォルト無効）

### キーワード抽出

- `pnpm extract` — 収集データからアプリ設計のヒントとなるキーワードを抽出し `keyword.json` を生成
- 連想モード: 直接抽出に加え、関連キーワードを連想ゲーム方式で追加
- 連想の深さ設定: shallow / moderate / deep

### 要件生成

- `pnpm generate` — キーワードからアプリ案を連想し、要件定義（overview + 機能別仕様 + 図解）を自動生成
- `pnpm regenerate` — 既存アプリの要件を `memo.md` の内容をベースに再生成
- マルチエージェント連携: Gemini（リサーチ）、Codex（設計・レビュー）と協調動作可能

### バリデーション

- `pnpm generate:validate` — 生成された要件の構造・内容を自動検証

### パイプライン一括実行

- `pnpm pipeline` — 収集→抽出→生成→検証を連続実行
  - `--skip-collect` — 収集をスキップ
  - `--skip-extract` — 抽出をスキップ
  - `--source <dir>` — 既存データソースを指定

### パイプラインキュー

- `pnpm queue:process` — キュー内のアイテムを順次パイプライン実行
- キューアイテムはViewerから作成・編集・削除可能

## スケジューラ

- `pnpm scheduler:enable` — systemdタイマーを有効化し定期的にパイプラインを実行
- `pnpm scheduler:disable` — systemdタイマーを無効化
- `pnpm scheduler:status` — タイマー・サービスの状態と今後の実行予定を表示
- キューがあればキュー処理を優先、なければ通常パイプラインを実行

## Webビューワー

### 起動

- `pnpm viewer` — 開発サーバ起動（http://localhost:3001、HMR対応）
- `pnpm viewer:build` — 本番ビルド
- `pnpm viewer:start` — 本番サーバ起動

### アプリ閲覧

- アプリ一覧表示（タグバッジ付き、更新日時降順）
- Overview表示 — アプリ概要のMarkdownレンダリング
- Features表示 — 機能別仕様の一覧・詳細表示
- Diagrams表示 — 図解（Mermaid等）のMarkdownレンダリング
- Source Info表示 — 生成元データソース情報の表示
- スワイプによるアプリ切り替え

### メモ機能

- メモの閲覧・編集（dev modeのみ編集可能）
- 再生成時のベース情報として利用

### サイドバー

- アプリ一覧の表示・選択
- タグフィルタリング
- 全文検索
- 折りたたみ対応

### 検索

- 全文検索（アプリ名・概要・機能のテキストマッチ）
- タグAND検索
- 全文検索 + タグの複合検索
- 2ペインレイアウトで検索結果とプレビューを同時表示

### お気に入り

- アプリ・機能・図解のお気に入り登録・解除
- お気に入り一覧ページ（プレビュー付き）
- お気に入りからデータセットへの追加

### データセット

- データセットの作成・削除
- アイテムの追加・削除
- データセットからのパイプライン実行
- データセットから生成されたアプリ一覧の表示

### パイプラインキュー管理

- キューアイテムの作成（タイトル・内容）
- キューアイテムの編集・削除
- 削除前の確認ダイアログ
- キュー一覧表示

### コマンド実行

- パイプライン操作のGUI実行（collect / extract / generate / pipeline等）
- ストリーミングログ表示
- 実行中コマンドの中止
- データソース・アプリ・収集ソースの選択UI

### 設定管理

- `app.config.yaml` のGUI編集（dev modeのみ）
- 収集設定、抽出設定、生成設定の各項目をフォームで変更可能

### Git操作

- `gen/` ディレクトリのgit add + commit + push（dev modeのみ）
- 現在のブランチ名表示
- main / develop間のブランチ切り替え

### 通知

- トースト通知（操作結果のフィードバック）

## コード品質

- `pnpm format` — Biomeでコードフォーマット（ファイル編集時にhookで自動実行）
- `pnpm lint` — Biomeでリント
- `pnpm check` — フォーマット + リントの一括チェック・修正

## カスタムエージェント（Claude Code）

- `update-memory` — CLAUDE.mdをプロジェクト最新情報に同期更新
- `update-docs` — README.md / docs配下のドキュメントをコードベースに同期更新
- `tech-spec-validator` — ライブラリ導入時に最新公式ドキュメントを調査し、ベストプラクティスに基づく実装を行う

## カスタムスキル（Claude Code）

- `extract-keywords` — 収集データからキーワード・トレンドを抽出し `keyword.json` を生成
- `generate-requirements` — keyword.jsonからアプリ案を構想し、要件定義を出力（バリデーション付き）
- `fix-issue` — GitHub Issue確認→方針合意→コメント→修正→PR作成の一連のワークフロー
- `create-agent` — 会話内容をサブエージェント定義として永続化
- `create-skill` — 会話内容をスキル定義として永続化

## 外部エージェント連携

- **Gemini CLI** — キーワードからのトレンド・技術の外部調査（リサーチャー役）
- **Codex CLI** — アプリコンセプト設計・要件レビュー（デザイナー・レビュワー役）

## 通知

- Slack通知 — パイプライン完了時にSlackへ通知（`app.config.yaml` で設定）
