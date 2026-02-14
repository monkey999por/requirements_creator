# USECASE_QUEUE.md - パイプラインキュー機能

ユーザーのジャストアイデアを保存しておき、定期実行（systemdスケジューラ）で自動的に要件生成するキュー機能のドキュメント。

---

## 目次

- [概要](#概要)
- [使い方](#使い方)
  - [Viewer からキューを管理する](#viewer-からキューを管理する)
  - [CLI からキューを処理する](#cli-からキューを処理する)
  - [systemd スケジューラとの連携](#systemd-スケジューラとの連携)
- [内部実装](#内部実装)
  - [データ構造](#データ構造)
  - [処理フロー](#処理フロー)
  - [API エンドポイント](#api-エンドポイント)
  - [ファイル構成](#ファイル構成)
- [よくあるシナリオ](#よくあるシナリオ)

---

## 概要

### 何ができるか

- アプリのアイデアを `gen/pipeline_queue/` に保存しておく
- 定期実行時（systemd タイマー）にキューが自動で処理され、要件が生成される
- Viewer のキュー管理画面から新規作成・編集・削除ができる

### なぜ必要か

- 思いついたアイデアをすぐに保存しておきたい（でも今すぐ generate したくない）
- ユーザーの活動時間外（例: AM 5:00）に実行することで、Claude サブスクリプションの利用を効率化
- 既存のパイプライン（collect → extract → generate）には手を加えず、外付けで実現

### 動作原理

```
[ユーザー]
   │ アイデアを書く
   ▼
gen/pipeline_queue/{id}.json    ← Viewer or 手動で配置
   │
   │ (systemd タイマー or 手動実行)
   ▼
process-queue.ts
   │ キュー1件ごとに:
   ├─ gen/data_source/{timestamp}/user_proposal.md を作成
   ├─ pnpm pipeline --skip-collect --source {timestamp} を実行
   └─ 成功 → キューファイルを削除（data_source 側は残る）
```

---

## 使い方

### Viewer からキューを管理する

Viewer のサイドバーにあるオレンジ色のキューアイコン（横線が並んだアイコン）をクリック。

#### 新規作成

1. キュー画面右上の `+` ボタンをクリック
2. **タイトル**: アプリのアイデア名を入力（例: `ペットの健康管理アプリ`）
3. **内容**: アイデアの詳細を自由に記述
   - 箇条書きでも文章でもOK
   - 後で AI が user_proposal.md として読むので、やりたいことを素直に書く
4. 「追加」ボタンで保存

#### 編集

1. キュー一覧からアイテムを選択
2. 右上の鉛筆アイコンをクリック
3. タイトル・内容を修正して「更新」

#### 削除

- 一覧のアイテムにホバーしてゴミ箱アイコンをクリック
- または詳細画面の右上のゴミ箱アイコンをクリック

### CLI からキューを処理する

```bash
# キューに溜まったアイテムを全て処理（即時実行したい場合）
pnpm queue:process
```

キューが空なら何もせず終了する。1件ずつ順番に処理し、成功したアイテムはキューから削除される。失敗したアイテムはキューに残り、次回の実行で再試行される。

### systemd スケジューラとの連携

`scheduler-run.sh` の分岐ロジック:

```
スケジューラ実行開始
   │
   ├─ gen/pipeline_queue/ に .json ファイルがある？
   │     YES → pnpm queue:process（キューを処理）
   │     NO  → pnpm pipeline（新規データを collect して生成）
   │
   ▼
スケジューラ実行終了
```

つまり:

- **キューにアイデアがある日** → キューの要件生成が優先される
- **キューが空の日** → 通常通り外部 API からデータ収集して新しいアプリを生成

スケジューラの有効化:

```bash
pnpm scheduler:enable    # systemd タイマー有効化
pnpm scheduler:status    # 状態確認
```

---

## 内部実装

### データ構造

キューアイテムは `gen/pipeline_queue/{id}.json` に1ファイル1アイテムで保存される。

```json
{
  "id": "1739520000000-a1b2c3",
  "title": "ペットの健康管理アプリ",
  "content": "毎日の食事・運動・体重を記録し、獣医との共有もできるアプリ\n\n- 写真で食事記録\n- 散歩のGPSトラッキング\n- 体重グラフ",
  "createdAt": "2026-02-14T12:00:00.000Z",
  "updatedAt": "2026-02-14T12:00:00.000Z"
}
```

| フィールド | 説明 |
|-----------|------|
| `id` | `{timestamp_ms}-{random_6chars}` 形式のユニーク ID。ファイル名にもなる |
| `title` | アイデアのタイトル。`user_proposal.md` の `# 見出し` になる |
| `content` | アイデアの本文。Markdown 可。そのまま `user_proposal.md` の本文になる |
| `createdAt` | 作成日時（ISO 8601） |
| `updatedAt` | 最終更新日時（ISO 8601） |

### 処理フロー

`scripts/process-queue.ts` の処理:

```
1. gen/pipeline_queue/*.json を読み込み、createdAt 昇順でソート
2. アイテムごとにループ:
   a. タイムスタンプ付きディレクトリを作成: gen/data_source/{yyyy_mm_dd_hh_mm_ss}/
   b. user_proposal.md を書き出し:
      ---
      # {item.title}

      {item.content}
      ---
   c. execSync で実行:
      pnpm pipeline --skip-collect --source {timestamp_dir}
      → extract（キーワード抽出）→ generate（要件生成）→ validate
   d. 成功 → gen/pipeline_queue/{id}.json を削除
      失敗 → キューに残す（次回再試行）
```

ポイント:

- `--skip-collect` を指定するので外部 API は呼ばない
- `user_proposal.md` は `scripts/lib/data-source.ts` の `loadAllTexts()` で自動認識される
- 処理は逐次実行（1件ずつ）。並列ではない
- `data_source` 側のファイルは処理後も残る（キューファイルのみ削除）

### API エンドポイント

全て `viewer/server.ts` に実装。dev mode のみ書き込み可能。

| メソッド | パス | 説明 | dev mode |
|---------|------|------|----------|
| `GET` | `/api/queue` | キュー一覧（createdAt 昇順） | 不要 |
| `GET` | `/api/queue/:id` | キュー詳細 | 不要 |
| `POST` | `/api/queue` | キュー追加（body: `{title, content}`） | 必要 |
| `PUT` | `/api/queue/:id` | キュー編集（body: `{title?, content?}`） | 必要 |
| `DELETE` | `/api/queue/:id` | キュー削除 | 必要 |

レスポンス例:

```bash
# 一覧取得
curl http://localhost:3001/api/queue
# → [{"id":"...","title":"...","content":"...","createdAt":"...","updatedAt":"..."}]

# 新規作成
curl -X POST http://localhost:3001/api/queue \
  -H 'Content-Type: application/json' \
  -d '{"title":"テストアプリ","content":"テスト内容"}'
# → {"success":true,"item":{...}}
```

### ファイル構成

```
scripts/
├── process-queue.ts        # キュー処理スクリプト（pnpm queue:process）
├── scheduler-run.sh        # スケジューララッパー（キュー分岐ロジック）
└── lib/
    └── paths.ts            # PIPELINE_QUEUE_DIR 定数

viewer/
├── server.ts               # Queue API エンドポイント
└── src/
    ├── api.ts              # Queue API クライアント関数
    ├── App.tsx             # キュービューモード追加
    └── components/
        ├── Sidebar.tsx     # キューボタン追加
        └── QueueManager.tsx # キュー管理 UI

gen/
└── pipeline_queue/         # キューデータ保存先（.gitignore 対象）
    ├── 1739520000000-a1b2c3.json
    └── 1739520060000-d4e5f6.json
```

---

## よくあるシナリオ

### 1. 思いついたアイデアを後で自動生成

```bash
# Viewer を開いてキュー画面でアイデアを追加
pnpm viewer
# → サイドバーのキューアイコン → + ボタン → タイトルと内容を入力

# あとは放置。次のスケジューラ実行（AM 5:00）で自動処理される
```

### 2. キューを今すぐ処理したい

```bash
# スケジューラを待たずに手動実行
pnpm queue:process
```

### 3. JSON ファイルを直接配置

Viewer を使わずに、手動でキューファイルを作ることもできる。

```bash
mkdir -p gen/pipeline_queue

cat > gen/pipeline_queue/my-idea.json << 'EOF'
{
  "id": "my-idea",
  "title": "家計簿×AI分析アプリ",
  "content": "レシート写真から自動で家計簿をつけ、AIが節約ポイントを提案するアプリ\n\n- OCRでレシート読み取り\n- カテゴリ自動分類\n- 月次レポート生成",
  "createdAt": "2026-02-14T00:00:00.000Z",
  "updatedAt": "2026-02-14T00:00:00.000Z"
}
EOF

# 手動実行
pnpm queue:process
```

### 4. 複数アイデアをまとめてキューに入れる

Viewer で複数のアイデアを連続して追加しておく。処理は createdAt 順に1件ずつ実行される。

```
キュー:
  1. ペット健康管理アプリ    (02/14 10:00)
  2. 家計簿AI分析アプリ     (02/14 10:05)
  3. 読書ログSNSアプリ      (02/14 10:10)

→ スケジューラ実行時、1 → 2 → 3 の順で処理
→ 2 が失敗した場合: 1, 3 は成功してキューから消え、2 だけ残る
→ 次回実行で 2 が再試行される
```

### 5. 失敗したアイテムの確認

キュー処理で失敗したアイテムはキューに残る。Viewer で内容を確認・編集して再試行できる。

```bash
# ログで失敗原因を確認
ls logs/scheduler/
cat logs/scheduler/2026_02_14_05_00_00.log

# Viewer でキューを確認・編集
pnpm viewer
```
