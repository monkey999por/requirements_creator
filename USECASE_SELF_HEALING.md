# USECASE_SELF_HEALING.md - 自己修復機能

パイプライン実行ログを解析し、設定との不整合やコマンド失敗を検出・自動修復する機能のドキュメント。

---

## 目次

- [概要](#概要)
- [使い方](#使い方)
  - [CLI から実行する](#cli-から実行する)
  - [systemd スケジューラとの連携](#systemd-スケジューラとの連携)
- [内部実装](#内部実装)
  - [ログの仕組み](#ログの仕組み)
  - [解析フロー](#解析フロー)
  - [修復フロー](#修復フロー)
  - [ファイル構成](#ファイル構成)
- [よくあるシナリオ](#よくあるシナリオ)

---

## 概要

### 何ができるか

- パイプライン（collect / extract / generate）の実行ログを JSONL 形式で自動記録
- ログを解析し、`app.config.yaml` の設定との不整合を検出
- 失敗したコマンドの原因を特定し、Claude Code で自動修復
- 修復結果を bugfix PR として作成

### なぜ必要か

- パイプラインの失敗を手動で確認・修正する手間を省く
- 設定変更後に動作が壊れていないかを自動チェック
- 定期実行（systemd タイマー）で無人運用時の問題を自動検出・修復

### 動作原理

```
[パイプライン実行]
   │ collect / extract / generate の各ステップでログ出力
   ▼
logs/{timestamp}.jsonl    ← JSONL 形式の構造化ログ
   │
   │ (systemd タイマー or 手動実行)
   ▼
self-healing.ts
   │
   ├─ 全ログファイルを解析
   ├─ app.config.yaml との整合性チェック
   ├─ 失敗ステップの検出
   │
   ├─ 問題なし → ログを保持して終了
   │
   └─ 問題あり:
      ├─ develop からブランチ作成 (bugfix/{date}-{time}-self-healing)
      ├─ Claude Code でコード修復
      ├─ コミット & PR 作成
      ├─ 元のブランチに復帰
      └─ ログディレクトリを削除
```

---

## 使い方

### CLI から実行する

#### 基本パターン

```bash
# ログ解析のみ（修復は実行しない）
pnpm self-healing -- --dry-run

# 解析 + 修復実行（問題があればブランチ作成→修復→PR作成）
pnpm self-healing
```

#### よくあるシナリオ

| シナリオ | コマンド |
|---------|---------|
| パイプライン失敗後の原因確認 | `pnpm self-healing -- --dry-run` |
| 修復まで一気通貫で実行 | `pnpm self-healing` |
| 設定変更後の動作確認 | `pnpm pipeline` → `pnpm self-healing -- --dry-run` |

### systemd スケジューラとの連携

パイプラインタイマーとは独立した別タイマーで管理される。

```bash
# 自己修復タイマーを有効化（毎日 JST 6:00 に実行）
pnpm self-healing:scheduler:enable

# 自己修復タイマーを無効化
pnpm self-healing:scheduler:disable

# 自己修復タイマーの状態確認
pnpm self-healing:scheduler:status
```

パイプラインスケジューラとは完全に独立したコマンドで管理される。

#### スケジュール設計

```
パイプラインタイマー:  02:00〜05:00, 12:03（JST）  ← アプリ生成
自己修復タイマー:      06:00（JST）                 ← 夜間実行分のログをチェック
```

パイプライン実行が完了した後に自己修復が走るよう、時間帯を分けている。

---

## 内部実装

### ログの仕組み

#### ログファイル

パイプライン実行時に `logs/{timestamp}.jsonl` が自動生成される。

```
logs/
├── 2026_02_16_02_00_00.jsonl   ← 2/16 02:00 のパイプライン実行ログ
├── 2026_02_16_05_00_00.jsonl   ← 2/16 05:00 のパイプライン実行ログ
└── 2026_02_17_02_00_00.jsonl   ← 2/17 02:00 のパイプライン実行ログ
```

#### ログエントリ（JSONL）

1行1エントリの JSON 形式。

```json
{"timestamp":"2026-02-16T02:00:01.000Z","level":"info","step":"pipeline","message":"パイプライン開始","data":{"options":{"skipCollect":false}}}
{"timestamp":"2026-02-16T02:00:02.000Z","level":"info","step":"collect","message":"設定情報","data":{"config":{"enabledSources":[{"name":"newsapi"},{"name":"youtube"}]}}}
{"timestamp":"2026-02-16T02:00:10.000Z","level":"info","step":"collect","message":"newsapi 取得成功","data":{"source":"newsapi"}}
{"timestamp":"2026-02-16T02:00:15.000Z","level":"error","step":"collect","message":"youtube 取得失敗: Request timeout","data":{"source":"youtube"}}
{"timestamp":"2026-02-16T02:01:00.000Z","level":"info","step":"collect","message":"collect 完了: success","data":{"summary":{"step":"collect","status":"success","durationMs":58000}}}
```

| フィールド | 説明 |
|-----------|------|
| `timestamp` | ISO 8601 形式のタイムスタンプ |
| `level` | `info` / `warn` / `error` / `debug` |
| `step` | `pipeline` / `collect` / `extract` / `generate` / `validate` |
| `message` | ログメッセージ |
| `data` | 付加データ（設定情報、サマリー、エラー詳細等） |

#### ログ出力の仕組み

- **TypeScript（collect.ts, pipeline.ts）**: `PipelineLogger` クラスを直接使用
- **シェルスクリプト（extract.sh, generate.sh）**: `PIPELINE_LOG_FILE` 環境変数経由で `pipeline_log()` 関数がログ追記
- **パイプライン実行時**: `pipeline.ts` がログファイルを作成し、子プロセスに `PIPELINE_LOG_FILE` 環境変数でパスを伝播

```
pipeline.ts (PipelineLogger作成)
   │ PIPELINE_LOG_FILE=logs/xxx.jsonl
   │
   ├─ collect.ts    ← 環境変数からログファイルパスを取得、同じファイルに追記
   ├─ extract.sh    ← pipeline_log() で追記
   └─ generate.sh   ← pipeline_log() で追記
```

### 解析フロー

`self-healing.ts` の解析処理:

```
1. logs/*.jsonl を読み込み（新しい順）
2. 各ログファイルに対して:
   a. 失敗ステップの検出
      - level: "error" かつ data.summary.status === "failed"
      - level: "error" かつメッセージに「失敗」「エラー」を含む
   b. app.config.yaml との整合性チェック
      - 有効ソースがログに記録されているか
      - APIキー未設定の警告がないか
3. 結果を集約して表示
```

### 修復フロー

問題が検出された場合の修復処理:

```
1. develop からブランチ作成: bugfix/{date}-{time}-self-healing
2. 検出された問題をサマリー化
3. Claude Code CLI を起動（self-healing スキルをシステムプロンプトに設定）
   - Read / Write / Edit / Glob / Grep / Bash(git/tsx/pnpm) のみ許可
   - タイムアウト: 10分
4. 修復後:
   - 変更がある → git add + commit + push + gh pr create
   - 変更なし → ブランチ削除
5. 元のブランチに復帰
6. ログディレクトリを削除（修復完了の証）
```

### ファイル構成

```
scripts/
├── self-healing.ts         # メインスクリプト（pnpm self-healing）
├── self-healing-run.sh     # systemd タイマー用ラッパー
├── self-healing-ctl.sh     # 自己修復スケジューラ制御
└── lib/
    ├── logger.ts           # PipelineLogger クラス、ログ読み書きユーティリティ
    └── common.sh           # pipeline_log() 関数（シェルスクリプト共通）

.claude/skills/
└── self-healing/
    └── SKILL.md            # 自己修復スキル定義（Claude Code への指示）

systemd/
├── self-healing.timer      # 定期実行タイマー（毎日 JST 6:00）
├── self-healing.service    # サービス定義
├── pipeline.timer          # （既存）パイプラインタイマー
└── pipeline.service        # （既存）パイプラインサービス

logs/                       # パイプラインログ出力先（.gitignore 対象）
├── {timestamp}.jsonl       # パイプライン実行ログ
└── scheduler/              # systemd スケジューラログ（既存）
    └── self-healing_{timestamp}.log
```

---

## よくあるシナリオ

### 1. パイプラインが失敗した後の確認

```bash
# パイプライン実行（失敗した）
pnpm pipeline

# ログを確認（修復はしない）
pnpm self-healing -- --dry-run
# → 失敗ステップ: 1件
# →   [失敗] collect: youtube 取得失敗: Request timeout
```

### 2. 自動修復の実行

```bash
# 修復まで実行
pnpm self-healing
# → bugfix/20260216-060000-self-healing ブランチ作成
# → Claude Code で修復実行
# → PR作成: https://github.com/.../pull/xxx
# → ログディレクトリ削除
```

### 3. 設定変更後の動作検証

```bash
# app.config.yaml を編集（新しいソースを有効化等）
# パイプラインを1回実行
pnpm pipeline

# 設定がちゃんと反映されているかチェック
pnpm self-healing -- --dry-run
# → 設定不整合: 0件 → OK
# → 設定不整合: 1件 → 設定の読み込みに問題あり
```

### 4. 定期実行で無人運用

```bash
# パイプラインタイマーを有効化
pnpm scheduler:enable

# 自己修復タイマーを有効化
pnpm self-healing:scheduler:enable

# 状態確認
pnpm scheduler:status
# → スケジューラ: 有効（02:00〜05:00, 12:03）
pnpm self-healing:scheduler:status
# → 自己修復スケジューラ: 有効（06:00）
```

毎日の流れ:
```
02:00〜05:00  パイプライン実行 → logs/ にログ出力
06:00         自己修復チェック → 問題があれば bugfix PR 作成
```

### 5. 自己修復タイマーだけ個別管理

```bash
# 自己修復だけ有効化（パイプラインは手動実行したい場合）
pnpm self-healing:scheduler:enable

# 自己修復だけ無効化（パイプラインは定期実行を継続）
pnpm self-healing:scheduler:disable

# 自己修復だけ状態確認
pnpm self-healing:scheduler:status
```

### 6. 手動でログを確認したい

```bash
# ログファイル一覧
ls logs/*.jsonl

# 最新のログを人間が読める形式で表示（jq がある場合）
cat logs/2026_02_16_02_00_00.jsonl | jq .

# エラーだけ抽出
cat logs/2026_02_16_02_00_00.jsonl | jq 'select(.level == "error")'

# 特定ステップだけ抽出
cat logs/2026_02_16_02_00_00.jsonl | jq 'select(.step == "collect")'
```
