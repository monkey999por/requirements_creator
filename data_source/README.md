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

## ファイルの役割

- **news.json** - NewsAPIのトップヘッドラインレスポンス
- **youtube.json** - YouTube Data APIの人気動画レスポンス（`collect.config.yaml` で有効化が必要）
- **keyword.json** - 収集データからClaude Code CLIで抽出されたキーワードとトレンド情報。要件生成（`pnpm generate`）のインプットとして使用

## 関連コマンド

- `pnpm collect` - データ収集を実行
- `pnpm extract` - 収集データからキーワードを抽出し `keyword.json` を生成
- `pnpm pipeline` - 収集からキーワード抽出、要件生成まで一括実行
