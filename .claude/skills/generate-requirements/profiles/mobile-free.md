# 要件生成スキル（mobile-free プロファイル）

プラットフォーム: **Android モバイルアプリ**、予算: **無料（$0）**
生成観点: **random**（定義済み観点からランダムに1〜3個選択）
エージェント: **Codex**（designer, reviewer）+ **Gemini**（designer, researcher）

`keyword.json` を読み込み、アプリケーションのアイデアを構想して `gen/requirements/` 配下に所定構造で詳細な要件定義を出力する。

## 対象の決定

### 通常モード（keyword.jsonベース）
- `$ARGUMENTS` が指定されている場合: `gen/data_source/$ARGUMENTS/keyword.json` を使用
- 指定がない場合: `gen/data_source/` 配下で最新のサブディレクトリ内の `keyword.json` を使用

### ダイレクトモード（`--direct` オプション使用時）
- キーワード抽出をスキップし、テキストデータから直接要件を生成する
- `keyword.json` は不要。ディレクトリ内の全テキストファイル（`.json`, `.md`, `.txt`）を直接読み込む
- ユーザーが書いた提案やメモの意図を尊重し、キーワード抽出を介さずに要件を詳細化する

現在のdata_source:

```
!`ls -1 gen/data_source/ | tail -5`
```

## 制約条件（固定）

このプロファイルでは以下の制約が常に適用される:

- **Platform**: mobile-android（Androidネイティブアプリ）
- **Budget**: free（無料枠のみ。月額$0で運用可能な構成にすること）

技術スタック選定・機能スコープ・インフラ構成は全てこの制約内で設計すること。
具体的には:
- Firebase無料枠、Supabase無料枠等の無料BaaSを活用
- Google Play Storeでの配布を前提
- Kotlin / Jetpack Compose をベース技術として推奨

## 生成観点（random モード）

定義済み観点からランダムに1〜3個を選択し、アプリの体験設計・機能設計・マネタイズ戦略に深く反映する。

定義済み観点:
- **kindness** — ユーザーに寄り添う優しいUX設計（アクセシビリティ重視、丁寧なオンボーディング等）
- **cunning** — 巧妙なマネタイズ・行動設計（ダークパターンではなく、賢いビジネスモデル設計）
- **frustration** — フラストレーション駆動の設計（無料版の制限による課金誘導、待ち時間の活用等）
- **dopamine** — 中毒性のある体験設計（ゲーミフィケーション、報酬ループ、ストリーク等）
- **target-focus** — ターゲットユーザー層に徹底的に最適化した設計（ニッチ特化）

適用した観点は `_source_info.json` の `perspectives` フィールドに記録すること。

## 出力ディレクトリ構造（厳守）

以下の構造を **必ず** 守って出力すること。ファイルやディレクトリの欠落・命名規則の逸脱は許容しない。

```
gen/requirements/{app_name}/
├── _source_info.json
├── overview.md
├── diagrams/
│   ├── 01_{diagram_name}.md
│   ├── 02_{diagram_name}.md
│   └── ...
└── features/
    ├── 01_{feature_name}.md
    ├── 02_{feature_name}.md
    ├── 03_{feature_name}.md
    └── ...
```

### 命名規則

- `{app_name}`: 英語のkebab-case（例: `task-flow`, `health-tracker`）。日本語不可
- `{feature_name}`: 英語のsnake_case（例: `user_auth`, `data_export`）
- `{diagram_name}`: 英語のsnake_case（例: `screen_transition`, `user_flow_login`）
- `{feature_id}` / `{diagram_id}`: 01から始まる2桁の連番

### ディレクトリ作成コマンド

ファイル書き出し前に、必ず以下のBashコマンドでディレクトリを作成すること:

```bash
mkdir -p gen/requirements/{app_name}/{features,diagrams}
```

## 手順

### ステップ1: データ読み込み

**通常モード**: 対象ディレクトリの `keyword.json` を読み込み、キーワードとトレンドを把握する。

**ダイレクトモード**: 対象ディレクトリ内の全テキストファイル（`*.json`（`keyword.json`除く）, `*.md`, `*.txt`）を読み込み、内容を把握する。

### ステップ2: アプリ案の構想

keyword.jsonの内容（またはテキストデータ）を元に、以下を思考する:

- どのキーワード・トレンドの組み合わせが有望か
- ターゲットユーザーは誰か、どんな課題を抱えているか
- どうすれば収益化できるか
- **Androidモバイルアプリ**として実現可能で、**無料予算**（月額$0）で運用できる構成に絞る

**連想ゲーム方式**: キーワードから直接的なアプリではなく、1〜2段階飛躍したアイデアを重視する。

### ステップ3: ディレクトリ作成

Bashで `mkdir -p gen/requirements/{app_name}/{features,diagrams}` を実行する。

### ステップ4: _source_info.json の書き出し

[テンプレート参照](templates.md) に従い、以下を含む `_source_info.json` を出力:

- `source`: 使用した data_source ディレクトリ名と収集日時
- `keywords`: 採用したキーワードと関連度スコア
- `tags`: `gen/tags.json` に定義されたタグ値から **最低3つ** 選択（該当するタグがない場合は新しいタグを `gen/tags.json` に追加してから使用すること）
- `constraints`: `{ "platform": "mobile-android", "budget": "free" }`
- `perspectives`: `{ "mode": "random", "items": [適用した観点] }`
- `description`: このアプリ案に至った思考の経緯

**データセットモードの場合**: `dataset` フィールドを追加し、`source.directory` を `dataset://{データセット名}` 形式にする。

**ダイレクトモードの場合**: `keywords` 配列は空配列 `[]` とし、`description` にはテキストデータからどのようにアプリ案を導いたかの経緯を記載する。

**出力先**: `gen/requirements/{app_name}/_source_info.json`

### ステップ5: overview.md の書き出し

[テンプレート参照](templates.md) に従い、以下を必ず含む `overview.md` を出力:

- コンセプト
- ターゲットユーザー
- 機能一覧テーブル（5〜8機能。ID・機能名・概要・優先度）
- マネタイズ（具体的な収益モデル）
- コスト分析（初期開発コスト、月額運用コスト、収支シミュレーション。具体的な金額を日本円で記載する。**月額$0の無料枠前提**で試算すること）
- 技術スタック提案（**Androidネイティブ**前提。Kotlin + Jetpack Compose推奨。バックエンドはFirebase/Supabase等の無料BaaS）
- 運用方針

**出力先**: `gen/requirements/{app_name}/overview.md`

### ステップ6: 各機能の詳細仕様を書き出し

overview.md の機能一覧テーブルに記載した **全ての機能** について、1機能1ファイルで詳細仕様を出力する。

[テンプレート参照](templates.md) に従い、各ファイルに以下を必ず含む:

- 概要（課題と提供価値）
- 画面構成（UI要素・レイアウト）
- ユーザーフロー（操作手順）
- データモデル（テーブル/コレクション定義）
- API設計（エンドポイント一覧）
- 非機能要件

**出力先**: `gen/requirements/{app_name}/features/{feature_id}_{feature_name}.md`

### ステップ6.5: diagrams/ の書き出し

overview.mdと各機能の仕様に基づき、Mermaid記法を使ったアプリケーション設計図を `diagrams/` ディレクトリに1図解1ファイルで出力する。

[テンプレート参照](templates.md) の「diagrams/」セクションに従い、**最低1つ以上** の図解を作成すること。以下は必須:

1. **画面遷移図** (`01_screen_transition.md`): 主要画面間のナビゲーション遷移をMermaid `graph` で記述

加えて、アプリの特性に合わせて自由に図解を追加する。

**出力先**: `gen/requirements/{app_name}/diagrams/{diagram_id}_{diagram_name}.md`

### ステップ7: バリデーション実行

全ファイルの書き出し後、バリデーションスクリプトを実行して構造・内容を検証する:

```bash
tsx scripts/validate-requirements.ts {app_name}
```

**エラーが出た場合は、該当ファイルを修正して再度バリデーションを実行すること。全チェック通過するまで繰り返す。**

### ステップ8: 結果報告

以下を報告:
- 生成したアプリ名とコンセプト（1文）
- 出力先パス
- 生成した機能数
- バリデーション結果

## マルチエージェント連携（generate.sh 経由の場合）

`pnpm generate` で実行する場合、以下のエージェントが自動的に呼び出される:

```
[Phase 1: Research]  Gemini (researcher) — トレンド・市場調査
    ↓ research_context として渡される
[Phase 2: Design]    Codex (designer) — アプリコンセプト設計提案
    ↓ design_context として渡される
[Phase 3: Generate]  Claude Code — 本スキルによるメイン生成（本ステップ）
    ↓
[Phase 4: Review]    Codex (reviewer) — 品質レビュー
```

- Phase 1-2 の結果はプロンプト内に「参考情報」として含まれる
- 参考情報はあくまで参考であり、そのまま採用する必要はない
- `--skip-agents` オプションで外部エージェントをスキップ可能

## 注意事項

- overview.md の機能一覧に載せた機能は **全て** features/ に個別ファイルを作ること。漏れは不可
- features/ のファイル名の `{feature_name}` 部分は overview.md の機能名と対応させること
- 全ファイルは日本語で記述する（コード例・API パス・技術用語は英語可）
- 既存の `gen/requirements/` 内の他アプリのディレクトリには一切触れないこと
