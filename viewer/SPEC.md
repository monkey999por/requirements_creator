# Viewer 仕様書

Viewerを正常に動作させるために必要なファイル構造・データ仕様をまとめる。

## 1. ディレクトリ構造

Viewerは `gen/` 配下のファイルを参照する。ベースディレクトリは `app.config.yaml` の `output_base_dir`（デフォルト: `gen`）で決定される。

```text
gen/
├── requirements/              # アプリ要件（Viewerの主要データソース）
│   └── {app_name}/
│       ├── overview.md        # 必須: アプリ概要
│       ├── _source_info.json  # 必須: メタ情報（タグ・キーワード等）
│       ├── memo.md            # 任意: メモ（Viewerから編集可能）
│       └── features/          # 任意: 機能別仕様
│           └── {nn}_{feature_name}.md
└── datasets/                  # 任意: データセット
    └── {dataset_name}.json
```

### 必須/任意の判定

| ファイル | 必須 | 不在時の挙動 |
|---------|------|-------------|
| `gen/requirements/` | - | 全APIが空配列を返す |
| `overview.md` | 必須 | `/api/apps/:name/overview` が 404 |
| `_source_info.json` | 必須 | `/api/apps/:name/source-info` が 404、タグ情報が失われる |
| `features/` | 任意 | `/api/apps/:name/features` が空配列を返す |
| `features/{nn}_{name}.md` | 任意 | 個別取得時に 404 |
| `memo.md` | 任意 | 空文字列を返す（404ではない） |
| `gen/datasets/` | 任意 | `/api/datasets` が空配列を返す |

## 2. ファイル仕様

### 2.1 `_source_info.json`

アプリのメタ情報を管理するJSONファイル。

```json
{
  "source": {
    "directory": "data_source/2026_02_08_19_53_55/",
    "collected_at": "2026-02-08 19:53:55"
  },
  "dataset": {
    "name": "dataset_name",
    "sourceApps": [
      {
        "appName": "source_app_name",
        "type": "overview",
        "featureId": null,
        "title": null
      }
    ]
  },
  "keywords": [
    {
      "word": "メディア信頼性評価",
      "relevance": 0.8
    }
  ],
  "tags": ["AI", "金融"],
  "description": "生成の経緯・背景説明"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `source` | object | 任意 | データソース情報 |
| `source.directory` | string | 任意 | 収集データのディレクトリパス |
| `source.collected_at` | string | 任意 | 収集日時 |
| `dataset` | object | 任意 | データセットからの生成情報 |
| `dataset.name` | string | 任意 | データセット名 |
| `dataset.sourceApps` | array | 任意 | 参照元アプリ情報 |
| `keywords` | array | 任意 | キーワード一覧 |
| `keywords[].word` | string | 要素内必須 | キーワード文字列 |
| `keywords[].relevance` | number | 任意 | 関連度スコア (0-1) |
| `tags` | string[] | 任意 | カテゴリタグ |
| `description` | string | 任意 | 生成の経緯・背景説明 |

### 2.2 `overview.md`

アプリ概要のMarkdownファイル。以下のセクションを含む。

**必須セクション:**

- コンセプト
- ターゲットユーザー
- 機能一覧（テーブル形式: ID / 機能名 / 概要）
- マネタイズ
- 技術スタック
- 運用方針

```markdown
# アプリ名

## コンセプト

...

## ターゲットユーザー

...

## 機能一覧

| ID | 機能名 | 概要 |
|----|-------|------|
| 01 | ... | ... |

## マネタイズ

...

## 技術スタック

...

## 運用方針

...
```

### 2.3 `features/{nn}_{feature_name}.md`

機能別仕様のMarkdownファイル。

**ファイル命名規則:**

- `{nn}`: 2桁の連番（01, 02, 03...）。ソート順に使用される
- `{feature_name}`: スネークケース（例: `article_scoring`）

**必須セクション:**

- 概要（`## 概要`）
- 画面構成
- ユーザーフロー
- データモデル
- API設計
- 非機能要件

```markdown
# 機能名

## 概要

1行目がAPIレスポンスのsummaryとして使用される。

## 画面構成

...

## ユーザーフロー

...

## データモデル

...

## API設計

...

## 非機能要件

...
```

**パース処理:**

- タイトル: 最初の `# ` 行から抽出（`/^#\s+(.+)/m`）。マッチしない場合はファイル名を使用
- 概要: `## 概要` セクションの最初の行を抽出（`/## 概要\s*\n+([\s\S]*?)(?=\n## )/`）

### 2.4 `memo.md`

フリーフォーマットのMarkdownファイル。Viewerの「メモ」タブから編集可能（開発モードのみ）。

構造の制約はなし。

## 3. APIエンドポイント

### 3.1 アプリ関連

| エンドポイント | メソッド | 対応ファイル | レスポンス |
|--------------|---------|-------------|-----------|
| `/api/apps` | GET | `requirements/*/` | アプリ一覧（名前・タグ・更新日時、降順） |
| `/api/apps/:name/overview` | GET | `requirements/:name/overview.md` | `{content: string}` |
| `/api/apps/:name/features` | GET | `requirements/:name/features/*.md` | `Feature[]`（id, filename, title, summary） |
| `/api/apps/:name/features/:featureId` | GET | `requirements/:name/features/:featureId.md` | `{content: string}` |
| `/api/apps/:name/source-info` | GET | `requirements/:name/_source_info.json` | SourceInfo オブジェクト |
| `/api/apps/:name/memo` | GET | `requirements/:name/memo.md` | `{content: string}` |
| `/api/apps/:name/memo` | POST | `requirements/:name/memo.md` | 開発モードのみ。ファイルを上書き |

### 3.2 検索

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/apps-with-tags` | GET | 全アプリのタグ一覧 |
| `/api/search?type=grep&q=:query` | GET | 全文検索（`requirements/` 配下の `.md` / `.json`、最大200行） |
| `/api/search?type=tag&q=:tag` | GET | タグ部分一致検索 |

### 3.3 データセット

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/datasets` | GET | データセット一覧 |
| `/api/datasets/:name` | GET | データセット詳細 |
| `/api/datasets/:name/generate` | POST | パイプライン実行（開発モードのみ） |

### 3.4 その他

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/mode` | GET | 現在の動作モード（dev / production） |
| `/api/git/commit-push` | POST | git add + commit + push（開発モードのみ） |

## 4. タグシステム

`_source_info.json` の `tags` フィールドで指定する。定義済みタグ（`scripts/lib/tags.ts`）:

| タグ |
|------|
| AI |
| Web3 |
| ヘルスケア |
| 教育 |
| 金融 |
| モビリティ |
| サステナビリティ |
| エンタメ |

**表示:** Sidebarでアプリ名の下に最大2つ表示。

**検索:** `/api/search?type=tag&q=:tag` で部分一致検索（例: `"金"` → `"金融"` にマッチ）。

## 5. 開発/本番モード

`process.env.NODE_ENV !== "production"` で判定。

| 機能 | 開発モード | 本番モード |
|------|-----------|-----------|
| メモ編集（POST /api/apps/:name/memo） | 可能 | 403 |
| Git操作（POST /api/git/commit-push） | 可能 | 403 |
| データセット管理（POST/DELETE） | 可能 | 403 |

## 6. エラーハンドリング

| ケース | レスポンス |
|-------|-----------|
| `gen/requirements/` が存在しない | `/api/apps` が空配列 `[]` を返す |
| アプリディレクトリが存在しない | 該当APIが 404 を返す |
| `overview.md` が存在しない | 404 |
| `_source_info.json` が存在しない | 404（タグ取得時は空配列にフォールバック） |
| `features/` が存在しない | 空配列 `[]` を返す |
| `memo.md` が存在しない | 空文字列 `""` を返す（404ではない） |
| `gen/datasets/` が存在しない | 空配列 `[]` を返す |
| 本番モードで書き込みAPI呼び出し | 403 |
