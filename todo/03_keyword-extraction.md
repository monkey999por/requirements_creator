# 03: キーワード抽出コマンド

## 概要

`data_source/yyyy_mm_dd_hh_mm_ss/` に保存された生データからキーワードを抽出し、`keyword.json` を生成する。ニュースそのもののコンテキストではなく、アプリ設計のヒントとなるキーワードの抽出・重み付けを行う。

## 前提

- `02_data-collection.md` が完了し、`data_source/` にデータが存在すること

## 必要な作業

### キーワード抽出ロジック

- 収集データ（`news.json`, `youtube.json` 等）を読み込み、テキスト要素を統合
  - NewsAPI: `title`, `description` フィールド
  - YouTube: `snippet.title`, `snippet.description`, `snippet.tags` フィールド
- キーワード抽出手法の選定・実装
  - 選択肢1: LLM（Claude API）によるキーワード抽出
    - 記事群をまとめてプロンプトに渡し、アプリ設計に有用なキーワード・トレンドを抽出
    - 「連想ゲーム形式」: ニュースの内容そのものではなく、そこから派生するビジネス機会やユーザーニーズに着目
  - 選択肢2: 形態素解析（kuromoji等）+ TF-IDF
    - 日本語対応の形態素解析で名詞・固有名詞を抽出
    - 頻出度と重要度でスコアリング
  - 推奨: LLMベースの抽出（プロジェクトの趣旨である「連想」に合致）

### keyword.json フォーマット定義

```json
{
  "generated_at": "2025-01-01T00:00:00Z",
  "source_dir": "2025_01_01_12_00_00",
  "keywords": [
    {
      "word": "リモートワーク",
      "category": "働き方",
      "relevance_score": 0.95,
      "source_articles": ["記事タイトル1", "記事タイトル2"],
      "app_design_hints": ["タスク管理", "コミュニケーション", "集中力"]
    }
  ],
  "trends": [
    {
      "theme": "AI×教育",
      "related_keywords": ["生成AI", "EdTech", "パーソナライズ"],
      "potential_directions": ["学習アシスタント", "自動問題生成"]
    }
  ]
}
```

### CLIエントリポイント

- 実行コマンド: `pnpm extract` または `tsx scripts/extract.ts`
- 引数:
  - `--target`: 対象の `data_source` サブディレクトリ（省略時は最新を使用）
  - `--method`: 抽出手法の指定（`llm` / `tfidf`）
- 生成した `keyword.json` を対象の `data_source/yyyy_mm_dd_hh_mm_ss/` 内に保存

### LLM連携（選択肢1の場合）

- Claude API（Anthropic SDK）の導入
- `.env` に `ANTHROPIC_API_KEY` を追加
- プロンプト設計:
  - 入力: 収集したニュース記事群のタイトル・概要
  - 出力: 上記 `keyword.json` のフォーマットに準拠した構造化データ
  - 指示: 「ニュースの要約ではなく、ここから連想されるアプリケーションのアイデアに繋がるキーワードとトレンドを抽出せよ」

## 完了条件

- `pnpm extract` で指定（または最新）の `data_source` ディレクトリから `keyword.json` を生成できる
- `keyword.json` が定義したフォーマットに準拠している
- 抽出結果がニュースの単なる要約ではなく、アプリ設計のヒントとして機能するキーワードになっている
