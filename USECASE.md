# USECASE.md - コマンド別ユースケース集

各コマンドのよく利用する引数パターンと実行例をまとめたドキュメント。

---

## 目次

- [パイプライン系コマンド](#パイプライン系コマンド)
  - [pnpm collect](#pnpm-collect---データ収集)
  - [pnpm extract](#pnpm-extract---キーワード抽出)
  - [pnpm generate](#pnpm-generate---要件生成)
  - [pnpm generate:validate](#pnpm-generatevalidate---バリデーション)
  - [pnpm pipeline](#pnpm-pipeline---一括実行)
- [Viewer系コマンド](#viewer系コマンド)
  - [pnpm viewer](#pnpm-viewer---開発サーバー起動)
  - [pnpm viewer:build / viewer:start](#pnpm-viewerbuild--viewerstart---本番ビルドと起動)
- [コード品質系コマンド](#コード品質系コマンド)
  - [pnpm format / lint / check](#pnpm-format--lint--check)

---

## パイプライン系コマンド

### `pnpm collect` - データ収集

外部API（NewsAPI, YouTube等）からトレンド情報を取得し、`gen/data_source/` に保存する。

#### 基本パターン

```bash
# 全ての有効なソースから収集（最も一般的な使い方）
pnpm collect

# 特定のソースのみ収集（NewsAPIだけ取得したい時）
pnpm collect -- --only newsapi

# 実際のAPI呼び出しなしで確認（APIクォータを消費したくない時）
pnpm collect -- --dry-run
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| 日次のデータ収集 | `pnpm collect` |
| NewsAPIだけ試したい | `pnpm collect -- --only newsapi` |
| API呼び出し内容を事前確認 | `pnpm collect -- --dry-run` |
| 別の設定ファイルを使う | `pnpm collect -- --config custom.yaml` |

#### 必要な環境変数

```bash
# .env に設定
NEWS_API_KEY=your_key      # NewsAPI用（必須）
YOUTUBE_API_KEY=your_key   # YouTube用（app.config.yamlでenabled: trueの場合のみ）
```

#### 出力先

```
gen/data_source/2025_02_09_14_30_00/
├── news.json       # NewsAPIの取得結果
└── youtube.json    # YouTube APIの取得結果（有効時）
```

---

### `pnpm extract` - キーワード抽出

収集データからアプリ設計のヒントとなるキーワードを抽出し、`keyword.json` を生成する。

#### 基本パターン

```bash
# 最新のdata_sourceから抽出（最も一般的）
pnpm extract

# 特定のdata_sourceを指定して抽出
pnpm extract -- --target 2025_02_09_14_30_00
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| 直前のcollect結果から抽出 | `pnpm extract` |
| 過去の特定データから再抽出 | `pnpm extract -- --target 2025_01_15_10_00_00` |
| どのデータがあるか確認してから実行 | `ls gen/data_source/` → `pnpm extract -- --target <選んだディレクトリ>` |

#### 入出力

```
# 入力
gen/data_source/2025_02_09_14_30_00/news.json

# 出力（同じディレクトリに追加される）
gen/data_source/2025_02_09_14_30_00/keyword.json
```

---

### `pnpm generate` - 要件生成

キーワードからアプリ案を構想し、要件定義（overview + diagrams + features）を自動生成する。

#### 基本パターン

```bash
# 最新のkeyword.jsonから生成（最も一般的）
pnpm generate

# 特定のdata_sourceを指定
pnpm generate -- --target 2025_02_09_14_30_00

# データセットモード（既存要件の組み合わせから新アプリを生成）
pnpm generate -- --dataset-source gen/datasets/my_dataset.md --dataset-name my_dataset
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| 新しいアプリ案を生成 | `pnpm generate` |
| 過去のキーワードからやり直し | `pnpm generate -- --target 2025_01_15_10_00_00` |
| 既存アプリの組み合わせで新アプリ | `pnpm generate -- --dataset-source <file> --dataset-name <name>` |

#### 出力構造

```
gen/requirements/{app_name}/
├── _source_info.json    # メタデータ（ソース情報、キーワード、タグ）
├── overview.md          # アプリ概要（コンセプト、機能一覧、技術スタック等）
├── diagrams.md          # 設計図（画面遷移図、ユーザーフロー、システム構成図）
└── features/
    ├── 01_feature_name.md   # 各機能の詳細仕様
    ├── 02_feature_name.md
    └── ...
```

---

### `pnpm generate:validate` - バリデーション

生成された要件の構造・内容を自動検証する。

#### 基本パターン

```bash
# 全アプリを一括検証
pnpm generate:validate

# 特定のアプリのみ検証
pnpm generate:validate trust-lens

# スクリプトを直接実行（結果は同じ）
tsx scripts/validate-requirements.ts
tsx scripts/validate-requirements.ts trust-lens
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| generate後の確認 | `pnpm generate:validate <生成されたapp_name>` |
| 全アプリの一括チェック | `pnpm generate:validate` |
| 手動編集後の整合性確認 | `pnpm generate:validate <編集したapp_name>` |

#### 検証項目

- ディレクトリ・ファイルの存在（overview.md, diagrams.md, features/, _source_info.json）
- 命名規則（app_name: kebab-case、feature: nn_snake_case.md）
- overview.mdの必須セクション（コンセプト、ターゲットユーザー、機能一覧、マネタイズ、技術スタック、運用方針）
- diagrams.mdのD2コードブロック・シーケンス図の存在
- 各featureの必須セクション（概要、画面構成、ユーザーフロー、データモデル、API設計、非機能要件）
- overview.mdの機能数とfeatureファイル数の一致
- _source_info.jsonのスキーマ検証（tags、keywords等）

---

### `pnpm pipeline` - 一括実行

collect → extract → generate → validate を連続実行する。スキップオプションで部分実行も可能。

#### 基本パターン

```bash
# フルパイプライン（データ収集から要件生成まで一気通貫）
pnpm pipeline

# データ収集をスキップ（既にcollect済みのデータを使う）
pnpm pipeline -- --skip-collect

# 収集＋抽出をスキップ（既にkeyword.jsonがある場合）
pnpm pipeline -- --skip-collect --skip-extract

# 特定のdata_sourceを使ってパイプライン実行
pnpm pipeline -- --source 2025_02_09_14_30_00

# データセットから要件生成（collect/extractはスキップされる）
pnpm pipeline -- --dataset my_dataset
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| 初めて実行 / 最新トレンドで全自動 | `pnpm pipeline` |
| APIクォータ節約（既存データ再利用） | `pnpm pipeline -- --skip-collect` |
| キーワードを手動調整した後に再生成 | `pnpm pipeline -- --skip-collect --skip-extract` |
| 過去の特定データで再実行 | `pnpm pipeline -- --source 2025_01_15_10_00_00` |
| Viewerで作ったデータセットから生成 | `pnpm pipeline -- --dataset my_dataset` |
| generate結果が不満で再トライ | `pnpm pipeline -- --skip-collect --skip-extract` |

#### フロー図

```
pnpm pipeline
  │
  ├─ [1] collect    ← --skip-collect で省略可
  │     ↓
  ├─ [2] extract    ← --skip-extract で省略可
  │     ↓
  ├─ [3] generate
  │     ↓
  └─ [4] validate   ← 新規生成アプリのみ自動検証
```

---

## Viewer系コマンド

### `pnpm viewer` - 開発サーバー起動

Markdownビューワーを開発モードで起動する。HMR（ホットリロード）対応。

```bash
# 開発サーバー起動（http://localhost:3001）
pnpm viewer
```

#### ビューワーの機能

- アプリ一覧の閲覧・検索（全文検索 / タグ検索）
- Overview / Source Info / Diagrams / Features / Memo タブ切り替え
- D2図解のSVGレンダリング表示
- データセットの作成・管理
- Commit & Push（devモードのみ）

#### ポート番号

デフォルト `3001`。使用中の場合は自動的に `3002`, `3003`... と順に試行する。

---

### `pnpm viewer:build` / `pnpm viewer:start` - 本番ビルドと起動

```bash
# 本番ビルド（viewer/dist/ に出力）
pnpm viewer:build

# 本番サーバー起動
pnpm viewer:start
```

---

## コード品質系コマンド

### `pnpm format` / `lint` / `check`

Biomeによるフォーマットとリントを実行する。

```bash
# フォーマット実行（ファイルを自動修正）
pnpm format

# リントチェック（問題箇所の報告のみ）
pnpm lint

# フォーマット＋リントの一括実行（修正も行う）
pnpm check
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| コード編集後のフォーマット | `pnpm format`（Claude Code使用時はhookで自動実行） |
| CI/PRレビュー前の確認 | `pnpm check` |
| 問題箇所だけ確認したい | `pnpm lint` |

---

## 組み合わせ例（よくあるワークフロー）

### 1. 初回セットアップから要件閲覧まで

```bash
# .envにAPIキーを設定した後
pnpm pipeline            # 全自動でデータ収集→要件生成
pnpm viewer              # ビューワーで閲覧
```

### 2. 生成結果が気に入らない場合のリトライ

```bash
# 同じキーワードで再生成（collectとextractを省略）
pnpm pipeline -- --skip-collect --skip-extract
```

### 3. 過去データの再利用

```bash
# 利用可能なデータ一覧を確認
ls gen/data_source/

# 特定データから再生成
pnpm pipeline -- --source 2025_02_09_14_30_00 --skip-collect --skip-extract
```

### 4. 複数アプリの融合（データセット活用）

```bash
# ビューワーでデータセットを作成・アイテム追加した後
pnpm pipeline -- --dataset my_dataset
pnpm viewer              # 新アプリを確認
```

### 5. 手動でdiagrams.mdを編集した後の検証

```bash
# 編集後にバリデーション
pnpm generate:validate my-app

# ビューワーでD2図解の表示確認
pnpm viewer
```
