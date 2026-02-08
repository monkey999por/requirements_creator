# 02: データ収集コマンド

## 概要

外部API（NewsAPI、YouTube Data API等）からトレンド情報を取得し、`data_source/yyyy_mm_dd_hh_mm_ss/` に保存するCLIコマンドを実装する。

## 前提

- `01_project-setup.md` が完了していること
- `.env` に `NEWS_API_KEY` が設定済み
- `collect.config.yaml` が設定済み

## 必要な作業

### 設定ファイル読み込み（collect.config.yaml）

- `collect.config.yaml` を読み込み、有効なデータソースのみ処理する
- 設定ファイルの構造:
  - 各データソースが `enabled: true/false` で有効/無効を制御
  - `api_key_env` で参照する環境変数名を指定（実際のキーは `.env` に保持）
  - `endpoint`, `params` でAPI呼び出しのパラメータを外部化
  - `output_file` で保存ファイル名を指定
- YAML読み込みライブラリ: `yaml`（`js-yaml`等）

### 共通基盤

- `data_source/` ディレクトリへの書き込みユーティリティ
  - タイムスタンプ形式 `yyyy_mm_dd_hh_mm_ss` のサブディレクトリを自動生成
  - JSON保存ヘルパー（prettify + UTF-8）
- `.env` からの環境変数読み込み（`dotenv`等）
- 各データソースの共通インターフェース定義
  ```typescript
  interface DataSource {
    name: string;
    fetch(config: SourceConfig): Promise<RawData>;
    save(dir: string, data: RawData, outputFile: string): Promise<void>;
  }
  ```
- 設定ファイルで `enabled: true` かつ `api_key_env` で指定された環境変数が存在するソースのみ実行

### NewsAPI連携

- NewsAPIクライアント実装
  - エンドポイント: `https://newsapi.org/v2/top-headlines` 等
  - パラメータ: country（`jp`）、category、pageSize等
  - レスポンスを `news.json` として保存
- レート制限・エラーハンドリング
  - 無料プランの制約: 1日100リクエスト、過去1ヶ月分のみ
- 保存フォーマット定義
  ```json
  {
    "fetched_at": "2025-01-01T00:00:00Z",
    "source": "newsapi",
    "params": { "country": "jp", "category": "technology" },
    "articles": [...]
  }
  ```

### YouTube Data API連携

- YouTube Data APIクライアント実装
  - エンドポイント: `https://www.googleapis.com/youtube/v3/videos`（chart=mostPopular）
  - パラメータ: regionCode（`JP`）、videoCategoryId、maxResults等
  - レスポンスを `youtube.json` として保存
- APIキー管理（`.env` に `YOUTUBE_API_KEY` を追加）
- 保存フォーマット定義（NewsAPIと同様のメタデータラッパー構造）

### CLIエントリポイント

- 実行コマンド: `pnpm collect` または `tsx scripts/collect.ts`
- オプション引数:
  - `--config`: 設定ファイルパスの指定（デフォルト: `collect.config.yaml`）
  - `--only`: 設定ファイル内の特定ソースのみ実行（例: `--only newsapi`）
  - `--dry-run`: 実際のAPI呼び出しなしで動作確認
- 動作: `collect.config.yaml` の `enabled: true` のソースを順に処理
- 実行結果のコンソール出力（取得件数、保存先パス等）

### 将来の拡張ポイント（今は実装しない）

- TikTok API連携
- RSSフィード対応
- cron/スケジューラー連携（README記載: アプリ外で設定）

## 完了条件

- `collect.config.yaml` で `enabled: true` のソースだけが実行される
- `enabled: false` のソースはスキップされる
- `pnpm collect` でNewsAPIからデータを取得し `data_source/yyyy_mm_dd_hh_mm_ss/news.json` に保存できる
- YouTube API連携が動作する（APIキー取得後、`collect.config.yaml` で有効化）
- 既存の `data_source/` ディレクトリ内のデータに影響を与えない
- APIキーが未設定のソースは警告を出してスキップする
- エラー時に適切なメッセージが表示される
