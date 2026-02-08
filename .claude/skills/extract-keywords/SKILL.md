---
name: extract-keywords
description: data_source配下の収集データからアプリ設計のヒントになるキーワードとトレンドを抽出し、keyword.jsonを生成する。データ収集後のキーワード抽出フェーズで使用。
disable-model-invocation: true
argument-hint: "[data_sourceサブディレクトリ名（省略時は最新）]"
allowed-tools: Read, Write, Glob, Bash
---

# キーワード抽出スキル

`data_source/` 配下の収集データを読み込み、アプリケーション設計に活かせるキーワードとトレンドを抽出して `keyword.json` を生成する。

## 対象ディレクトリの決定

- `$ARGUMENTS` が指定されている場合: `data_source/$ARGUMENTS/` を対象とする
- 指定がない場合: `data_source/` 配下で最新（名前の辞書順で最後）のサブディレクトリを対象とする

対象ディレクトリの確認:

```
!`ls -1 data_source/ | tail -5`
```

## 手順

### 1. データ読み込み

対象ディレクトリ内の全JSONファイル（`news.json`, `youtube.json` 等）を読み込む。

各データソースから以下のテキスト要素を抽出する:
- **NewsAPI** (`news.json`): `data.articles[].title` と `data.articles[].description`
- **YouTube** (`youtube.json`): `data.items[].snippet.title` と `data.items[].snippet.description`

### 2. キーワード・トレンド抽出

読み込んだ記事群を分析し、以下の観点で抽出を行う:

**重要: ニュースの要約ではなく「連想ゲーム」方式で抽出すること。**

- 記事の内容そのものではなく、そこから**派生する**ビジネス機会・ユーザーニーズ・技術トレンドに着目
- 「この出来事があるなら、こんなアプリが求められるのでは？」という思考
- 複数の記事を横断して見えてくる大きなトレンドやテーマを特定

### 3. keyword.json の生成

対象ディレクトリ内に `keyword.json` を以下のフォーマットで書き出す:

```json
{
  "generated_at": "ISO 8601形式のタイムスタンプ",
  "source_dir": "対象ディレクトリ名",
  "keywords": [
    {
      "word": "キーワード",
      "category": "カテゴリ（ライフスタイル, ビジネス, テクノロジー, 教育, 健康 等）",
      "relevance_score": 0.0,
      "source_articles": ["元になった記事タイトル"],
      "app_design_hints": ["このキーワードから連想されるアプリの方向性"]
    }
  ],
  "trends": [
    {
      "theme": "トレンドテーマ",
      "related_keywords": ["関連キーワード"],
      "potential_directions": ["このトレンドから考えられるアプリの方向性"]
    }
  ]
}
```

### 4. 結果報告

生成完了後、以下を報告:
- 対象ディレクトリ名
- 読み込んだ記事数
- 抽出したキーワード数とトレンド数
- 特に注目度の高いキーワード/トレンドのサマリー（上位3件程度）

## 注意事項

- `relevance_score` は 0.0〜1.0 の範囲で、アプリ設計への有用度を示す
- キーワードは最低5個、トレンドは最低2個を抽出する
- 日本語の記事・英語の記事が混在する場合があるが、出力は日本語で統一する
- `keyword.json` は既存ファイルがあれば上書きする
