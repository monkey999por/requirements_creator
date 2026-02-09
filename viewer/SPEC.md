# Viewer 仕様書

Viewerを正常に動作させるために必要なファイル構造・データ仕様をまとめる。

## 1. ディレクトリ構造

Viewerは `gen/` 配下のファイルを参照する。ベースディレクトリは `app.config.yaml` の `output_base_dir`（デフォルト: `gen`）で決定される。

```text
gen/
├── requirements/              # アプリ要件（Viewerの主要データソース）
│   └── {app_name}/           # kebab-case（英小文字・数字・ハイフンのみ）
│       ├── overview.md        # 必須: アプリ概要
│       ├── _source_info.json  # 必須: メタ情報（タグ・キーワード等）
│       ├── memo.md            # 任意: メモ（Viewerから編集可能）
│       └── features/          # 必須: 機能別仕様（1ファイル以上）
│           └── {nn}_{feature_name}.md
└── datasets/                  # 任意: データセット
    └── {dataset_name}.json
```

### app_name 命名規則

`{app_name}` はkebab-caseに従うこと。

- 正規表現: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`
- 使用可能文字: 英小文字、数字、ハイフン
- 先頭は英小文字
- 例: `trust-lens`, `health-tracker`, `ai-news`

### 必須/任意の判定

| ファイル | 必須 | 不在時の挙動（Viewer API） | バリデーション |
|---------|------|--------------------------|--------------|
| `gen/requirements/` | - | 全APIが空配列を返す | - |
| `overview.md` | 必須 | `/api/apps/:name/overview` が 404 | 必須セクションチェック |
| `_source_info.json` | 必須 | `/api/apps/:name/source-info` が 404、タグ情報が失われる | スキーマチェック |
| `features/` | 必須 | `/api/apps/:name/features` が空配列を返す | 1ファイル以上必要 |
| `features/{nn}_{name}.md` | 必須（1つ以上） | 個別取得時に 404 | 命名・連番・セクションチェック |
| `memo.md` | 任意 | 空文字列を返す（404ではない） | - |
| `gen/datasets/` | 任意 | `/api/datasets` が空配列を返す | - |

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
| `source` | object | 必須 | データソース情報 |
| `source.directory` | string | 必須 | 収集データのディレクトリパス |
| `source.collected_at` | string | 必須 | 収集日時 |
| `dataset` | object | 任意 | データセットからの生成情報（存在する場合、内部フィールドは必須） |
| `dataset.name` | string | dataset内必須 | データセット名 |
| `dataset.sourceApps` | array | dataset内必須 | 参照元アプリ情報（1つ以上） |
| `dataset.sourceApps[].appName` | string | 要素内必須 | 参照元アプリ名 |
| `dataset.sourceApps[].type` | string | 要素内必須 | `"overview"` または `"feature"` のみ |
| `dataset.sourceApps[].featureId` | string | 任意 | type="feature" の場合のfeature ID |
| `dataset.sourceApps[].title` | string | 任意 | タイトル |
| `keywords` | array | 必須 | キーワード一覧（1つ以上） |
| `keywords[].word` | string | 要素内必須 | キーワード文字列 |
| `keywords[].relevance` | number | 任意 | 関連度スコア (0-1) |
| `tags` | string[] | 必須 | カテゴリタグ（1つ以上、定義済みタグ値のみ） |
| `description` | string | 必須 | 生成の経緯・背景説明 |

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
| 02 | ... | ... |

ID列は2桁の連番（`| 01 |`, `| 02 |` ...）。テーブル内のID数とfeaturesディレクトリのファイル数が一致すること。

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

- 正規表現: `/^(\d{2})_([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.md$/`
- `{nn}`: 2桁の連番（01, 02, 03...）。01から連続であること（欠番不可）
- `{feature_name}`: スネークケース（英小文字・数字・アンダースコア。例: `article_scoring`）
- overview.mdの機能一覧テーブルのID数とfeatureファイル数が一致すること

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

## 7. バリデーションルール

`pnpm generate:validate` で実行されるバリデーション（`scripts/validate-requirements.ts`）の一覧。

### 7.1 ディレクトリ・ファイル存在チェック

| チェック対象 | ルール |
|------------|-------|
| `{app_name}/` | ディレクトリが存在すること |
| `app_name` | kebab-case（`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`） |
| `overview.md` | 存在すること |
| `_source_info.json` | 存在すること |
| `features/` | ディレクトリが存在すること |
| `features/*.md` | 1ファイル以上存在すること |

### 7.2 `_source_info.json` スキーマチェック

| チェック対象 | ルール |
|------------|-------|
| JSON構文 | パース可能であること |
| `source.directory` | 設定されていること |
| `source.collected_at` | 設定されていること |
| `keywords` | 非空配列であること |
| `tags` | 非空配列かつ定義済みタグ値のみ |
| `description` | 設定されていること |
| `dataset`（存在時） | `name` が設定されていること |
| `dataset.sourceApps`（存在時） | 非空配列、各要素に `appName` と `type`（`"overview"` / `"feature"`）が必要 |

### 7.3 `overview.md` セクションチェック

`## セクション名` の形式で以下が存在すること:

1. コンセプト
2. ターゲットユーザー
3. 機能一覧
4. マネタイズ
5. 技術スタック
6. 運用方針

追加チェック: 機能一覧テーブルに2桁IDの行（`| 01 |` 形式）が1つ以上存在すること。

### 7.4 `features/{nn}_{name}.md` チェック

| チェック対象 | ルール |
|------------|-------|
| ファイル名 | `/^(\d{2})_([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.md$/` に一致 |
| 連番 | 01から連続（欠番不可） |
| ファイル数 | overview.mdの機能一覧テーブルのID数と一致 |
| 必須セクション | 概要、画面構成、ユーザーフロー、データモデル、API設計、非機能要件 |
