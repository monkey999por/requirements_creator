# STRUCTURE.md - コマンド処理構造マップ

各コマンドにおける **スクリプト（確定的処理）** と **Claude Code Skills / 外部AI（AI判断）** の責務を整理したドキュメント。

## 凡例

| アイコン | 意味 |
|---------|------|
| **[Script]** | スクリプトによる確定的処理（TypeScript / Shell） |
| **[AI:Claude]** | Claude Code Skills による AI 生成 |
| **[AI:Gemini]** | Gemini CLI による外部 AI 処理（設定で有効時のみ） |
| **[AI:Codex]** | Codex CLI による外部 AI 処理（設定で有効時のみ） |

---

## コマンド一覧

| コマンド | エントリポイント | 処理タイプ | 概要 |
|---------|-----------------|-----------|------|
| `pnpm collect` | `scripts/collect.ts` | **全て Script** | 外部APIからデータ収集 |
| `pnpm extract` | `scripts/extract.sh` | **Script + AI:Claude** | キーワード抽出（連想モード） |
| `pnpm generate` | `scripts/generate.sh` | **Script + AI:Claude + AI:外部** | 要件定義の生成 |
| `pnpm generate:validate` | `scripts/validate-requirements.ts` | **全て Script** | 要件構造のバリデーション |
| `pnpm pipeline` | `scripts/pipeline.ts` | **Script（オーケストレータ）** | collect→extract→generate→validateの一括実行 |
| `pnpm regenerate` | `scripts/regenerate.sh` | **Script + AI:Claude + AI:外部** | 既存アプリの要件再生成 |
| `pnpm queue:process` | `scripts/process-queue.ts` | **Script（オーケストレータ）** | キュー先頭1件をpipeline実行 |

---

## 各コマンドの詳細

### 1. `pnpm collect` — データ収集

**AI関与: なし（100% スクリプト）**

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | 設定読み込み | [Script] | `app.config.yaml` から有効なデータソースを判定 |
| 2 | API呼び出し | [Script] | NewsAPI・YouTube・X (Twitter)・Threads等の外部APIを呼び出し（`scripts/lib/fetchers.ts`） |
| 3 | データ保存 | [Script] | `gen/data_source/yyyy_mm_dd_hh_mm_ss/` にJSON保存 |

---

### 2. `pnpm extract` — キーワード抽出

**AI関与: あり（キーワード抽出・連想処理）**

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | 設定読み込み | [Script] | `app.config.yaml` から連想モード設定を取得 |
| 2 | ターゲット選択 | [Script] | 対象の data_source ディレクトリを特定 |
| 3 | データ検証 | [Script] | データファイルの存在確認 |
| 4 | プロンプト準備 | [Script] | `.claude/skills/extract-keywords/SKILL.md` をプロンプトとして構築 |
| 5 | **キーワード抽出** | **[AI:Claude]** | 収集データを読み、キーワードを抽出。連想モード有効時は関連キーワードも生成 |
| 6 | **keyword.json 出力** | **[AI:Claude]** | 構造化されたキーワードデータを書き出し（`source: "direct"` / `"association"` を付与） |

**使用スキル**: `/extract-keywords`

---

### 3. `pnpm generate` — 要件生成

**AI関与: あり（4フェーズ中3フェーズがAI処理）**

#### Phase 1: リサーチ（オプション）

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | エージェント設定確認 | [Script] | `app.config.yaml` で researcher ロールが有効か判定 |
| 2 | **市場・技術調査** | **[AI:Gemini]** or **[AI:Codex]** | keyword.json を元にトレンド・競合を調査し `research_context.md` を生成 |

#### Phase 2: デザイン（オプション）

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | エージェント設定確認 | [Script] | designer ロールが有効か判定 |
| 2 | **アプリコンセプト設計** | **[AI:Codex]** or **[AI:Gemini]** | キーワード＋リサーチ結果からアプリ案を提案し `design_context.md` を生成 |

#### Phase 3: 生成（メイン）

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | プロンプト構築 | [Script] | キーワード・外部エージェント結果・制約条件を組み立て |
| 2 | **アプリ構想** | **[AI:Claude]** | キーワードからアプリのアイデアを発想 |
| 3 | **要件定義ファイル生成** | **[AI:Claude]** | 以下を生成: |
|   |  `_source_info.json` | **[AI:Claude]** | メタデータ・タグ・キーワード・制約条件 |
|   |  `overview.md` | **[AI:Claude]** | コンセプト・ターゲットユーザー・機能一覧・収益化・技術スタック |
|   |  `features/01_*.md` | **[AI:Claude]** | 各機能の詳細仕様（UI・フロー・データモデル・API・NFR） |
|   |  `diagrams/01_*.md` | **[AI:Claude]** | Mermaid図（画面遷移・ER図等） |
| 4 | バリデーション実行 | [Script] | `tsx scripts/validate-requirements.ts` を呼び出し |

**使用スキル**: `/generate-requirements`

#### Phase 4: レビュー（オプション）

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | エージェント設定確認 | [Script] | reviewer ロールが有効か判定 |
| 2 | **品質レビュー** | **[AI:Codex]** or **[AI:Gemini]** | 生成された要件の完全性・品質をチェックし `review_result.md` を生成 |

---

### 4. `pnpm generate:validate` — バリデーション

**AI関与: なし（100% スクリプト）**

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | ディレクトリ構造検証 | [Script] | 必須ディレクトリ・ファイルの存在確認 |
| 2 | 命名規則検証 | [Script] | kebab-case / snake_case の準拠チェック |
| 3 | `_source_info.json` 検証 | [Script] | 必須フィールド・タグの妥当性（`gen/tags.json` との照合） |
| 4 | Markdown構造検証 | [Script] | overview.md / feature ファイルの必須セクション確認 |
| 5 | 図解検証 | [Script] | `\`\`\`mermaid` ブロックの存在確認 |
| 6 | 整合性チェック | [Script] | overview の機能テーブルと features ファイル数の一致確認 |
| 7 | JSON自動修復 | [Script] | malformed JSON の自動リペア（可能な場合） |

---

### 5. `pnpm pipeline` — パイプライン一括実行

**AI関与: 自身はなし（オーケストレータとしてサブコマンドに委譲）**

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | CLIオプション解析 | [Script] | `--skip-collect`, `--skip-extract`, `--source`, `--direct`, `--dataset`, `--regenerate` |
| 2 | collect 実行 | [Script] → Script | `tsx scripts/collect.ts`（スキップ可） |
| 3 | extract 実行 | [Script] → **AI:Claude** | `bash scripts/extract.sh`（スキップ可） |
| 4 | generate 実行 | [Script] → **AI:Claude + AI:外部** | `bash scripts/generate.sh` |
| 5 | validate 実行 | [Script] → Script | `tsx scripts/validate-requirements.ts` |
| 6 | プロセス管理 | [Script] | 子プロセス管理・SIGINT/SIGTERM ハンドリング |
| 7 | Slack通知 | [Script] | パイプライン結果をSlackに通知（`app.config.yaml` で有効時のみ） |

**動作モード別の違い**:

| モード | collect | extract | generate | validate |
|-------|---------|---------|----------|----------|
| 通常 | 実行 | 実行 | 実行 | 実行 |
| `--direct` | 実行 | スキップ | `--direct` で実行 | 実行 |
| `--dataset <name>` | スキップ | スキップ | データセットから実行 | 実行 |
| `--regenerate <app>` | スキップ | スキップ | `regenerate.sh` で実行 | 実行 |

---

### 6. `pnpm regenerate` — 既存アプリ再生成

**AI関与: あり（generate と同様、memo.md を最優先指示として使用）**

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | 既存ファイル読み込み | [Script] | overview, features, diagrams, memo.md を読み込み |
| 2 | memo.md 更新 | [Script] | `--memo "text"` 指定時に memo.md へ書き込み |
| 3 | keyword.json 特定 | [Script] | `_source_info.json` から元の keyword.json を特定 |
| 4 | 外部エージェント実行 | **[AI:Gemini/Codex]** | researcher/designer が有効なら外部エージェントで調査・設計（オプション） |
| 5 | **要件再生成** | **[AI:Claude]** | memo.md を最優先フィードバックとして既存要件を改善・上書き |
| 6 | バリデーション実行 | [Script] | `tsx scripts/validate-requirements.ts` を呼び出し |

**使用スキル**: `/generate-requirements`（regenerate モード）

---

### 7. `pnpm queue:process` — キュー処理

**AI関与: 自身はなし（pipeline に委譲）**

**重要**: キュー内の **先頭1件のみ** を処理する。複数件ある場合は次回のスケジューラ実行で順次処理される。

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | キュー読み込み | [Script] | `gen/pipeline_queue/` から `createdAt` 昇順で最古のアイテム1件を取得 |
| 2 | data_source 準備 | [Script] | タイムスタンプ付きディレクトリ作成、`user_proposal.md` を書き込み |
| 3 | pipeline 実行 | [Script] → **AI含む** | `pnpm pipeline --skip-collect --source {timestamp}` |
| 4 | キュー管理 | [Script] | 成功時はアイテムを `pipeline_queue_rejected/` に移動、失敗時はキューに残留 |

---

### 8. `scheduler-run.sh` — スケジューラ実行ラッパー

**AI関与: 自身はなし（サブコマンドに委譲）**

Viewer内蔵スケジューラ（croner）から呼び出されるエントリポイント。キューの有無で処理を分岐する。

| # | 処理 | タイプ | 説明 |
|---|------|--------|------|
| 1 | 環境初期化 | [Script] | NVM読み込み、ログディレクトリ作成 |
| 2 | キュー判定 | [Script] | `gen/pipeline_queue/` 内に `.json` ファイルがあるか確認 |
| 3a | キューあり | [Script] → **AI含む** | `pnpm queue:process` を実行（先頭1件のみ処理） |
| 3b | キューなし | [Script] → **AI含む** | `pnpm pipeline` を通常実行 |
| 4 | ログ記録 | [Script] | `logs/scheduler/` にタイムスタンプ付きログを保存 |

---

## 処理タイプ別サマリー

### スクリプト（確定的処理）が担う領域

- 外部API呼び出し（データ収集）
- 設定ファイルの読み込み・解析
- ファイルI/O（ディレクトリ作成・保存・移動）
- バリデーション（構造・スキーマ・命名規則）
- プロセスオーケストレーション（パイプライン・キュー管理・スケジューラ分岐）
- CLI引数の解析
- Slack通知（パイプライン結果）

### AI（Claude Code Skills）が担う領域

- キーワード抽出と連想（extract）
- アプリアイデアの発想（generate）
- 要件定義の文書生成（overview, features, diagrams）
- メタデータ・タグの判断（_source_info.json）
- memo.md に基づく要件改善（regenerate）

### 外部AI（Gemini / Codex）が担う領域（オプション）

- 市場・技術トレンドのリサーチ（Gemini: researcher）
- アプリコンセプトの設計提案（Codex: designer）
- 生成要件の品質レビュー（Codex: reviewer）

---

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                   scheduler-run.sh                           │
│          [Script: Viewer内蔵スケジューラから起動]               │
└──┬──────────────────────────────────┬────────────────────────┘
   │ キューあり                         │ キューなし
   ▼                                   ▼
┌──────────────┐            ┌─────────────────────────────────┐
│queue:process │            │          pnpm pipeline           │
│[先頭1件のみ]  │            │       [Script: オーケストレータ]   │
└──────┬───────┘            └──┬──────┬──────────┬──────┬──────┘
       │                       │      │          │      │
       └───────────────────────┘      │          │      │
                                      ▼          ▼      ▼
┌──────┐  ┌───────┐  ┌───────────┐  ┌───────────┐  ┌───────┐
│collect│  │extract│  │ generate  │  │ validate  │  │ Slack │
│[全Script]│  │       │  │           │  │[全Script] │  │[通知]  │
└──────┘  │[Script]│  │ [Script]  │  └───────────┘  └───────┘
          │   +    │  │    +      │
          │[Claude]│  │ [Claude]  │
          └───────┘  │    +      │
                     │ [Gemini]  │
                     │ [Codex]   │
                     └───────────┘
```
