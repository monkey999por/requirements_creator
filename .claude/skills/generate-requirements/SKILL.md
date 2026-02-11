---
name: generate-requirements
description: keyword.jsonを元にアプリケーションのアイデアを生成し、gen/requirements/配下に所定のディレクトリ構造で詳細な要件定義を出力する。キーワード抽出後の要件生成フェーズで使用。
disable-model-invocation: true
argument-hint: "[keyword.jsonのあるdata_sourceサブディレクトリ名（省略時は最新）]"
allowed-tools: Read, Write, Glob, Bash
---

# 要件生成スキル

`keyword.json` を読み込み、アプリケーションのアイデアを構想して `gen/requirements/` 配下に所定構造で詳細な要件定義を出力する。

## 対象の決定

- `$ARGUMENTS` が指定されている場合: `gen/data_source/$ARGUMENTS/keyword.json` を使用
- 指定がない場合: `gen/data_source/` 配下で最新のサブディレクトリ内の `keyword.json` を使用

現在のdata_source:

```
!`ls -1 gen/data_source/ | tail -5`
```

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

### ステップ1: keyword.json 読み込み

対象ディレクトリの `keyword.json` を読み込み、キーワードとトレンドを把握する。

### ステップ2: アプリ案の構想

keyword.jsonの内容を元に、以下を思考する:

- どのキーワード・トレンドの組み合わせが有望か
- ターゲットユーザーは誰か、どんな課題を抱えているか
- どうすれば収益化できるか
- **制約条件が指定されている場合**: プラットフォーム・予算・難易度・チーム規模の範囲内で実現可能なアプリに絞る

**連想ゲーム方式**: キーワードから直接的なアプリではなく、1〜2段階飛躍したアイデアを重視する。

**制約条件**: `app.config.yaml` の `generate.constraints` に設定がある場合、またはプロンプト内で制約条件が指定されている場合は、その制約を尊重してアプリ案を構想する。制約条件は `_source_info.json` にも記録する。

### ステップ3: ディレクトリ作成

Bashで `mkdir -p gen/requirements/{app_name}/features` を実行する。

### ステップ4: _source_info.json の書き出し

[テンプレート参照](templates.md) に従い、以下を含む `_source_info.json` を出力:

- `source`: 使用した data_source ディレクトリ名と収集日時
- `keywords`: 採用したキーワードと関連度スコア
- `tags`: `gen/tags.json` に定義されたタグ値から **最低3つ** 選択（該当するタグがない場合は新しいタグを `gen/tags.json` に追加してから使用すること）
- `constraints`（オプション）: 制約条件が指定されている場合、適用した制約を記録する（`platform`, `budget`, `difficulty`, `team_size`）
- `description`: このアプリ案に至った思考の経緯

**データセットモードの場合**: `dataset` フィールドを追加し、`source.directory` を `dataset://{データセット名}` 形式にする。`dataset.sourceApps` にはデータセットに含まれる全アイテム（appName, type, featureId, title）を列挙する。詳細は[テンプレート参照](templates.md)の「データセットモード用」セクションを参照。

**出力先**: `gen/requirements/{app_name}/_source_info.json`

### ステップ5: overview.md の書き出し

[テンプレート参照](templates.md) に従い、以下を必ず含む `overview.md` を出力:

- コンセプト
- ターゲットユーザー
- 機能一覧テーブル（5〜8機能。ID・機能名・概要・優先度）
- マネタイズ（具体的な収益モデル）
- 技術スタック提案
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

加えて、アプリの特性に合わせて自由に図解を追加する。例:

- ユーザーフロー図（`sequenceDiagram`）
- システム構成図（`graph`）
- ER図（`erDiagram`）
- ステート図（`stateDiagram-v2`）
- その他、要件の理解を助ける図解

Mermaid記法はMarkdown内の ` ```mermaid ` コードブロックで記述する。Mermaid記法の詳細は[テンプレート参照](templates.md)の「Mermaid記法リファレンス」を参照すること。

**出力先**: `gen/requirements/{app_name}/diagrams/{diagram_id}_{diagram_name}.md`

### ステップ7: バリデーション実行

全ファイルの書き出し後、バリデーションスクリプトを実行して構造・内容を検証する:

```bash
tsx scripts/validate-requirements.ts {app_name}
```

このスクリプトは以下を自動検証する:
- `_source_info.json`, `overview.md`, `diagrams/`（Mermaid記法）, `features/` ディレクトリの存在
- `_source_info.json` のJSONスキーマ（必須フィールド、tagsが `gen/tags.json` に定義されたタグ値であることの検証）
- `app_name` がkebab-case、featureファイル名が `{nn}_{snake_case}.md` であること
- 連番が01から連続していること
- overview.mdの機能一覧テーブルの機能数とfeatureファイル数の一致
- 各ファイルの必須セクションの存在（overview: コンセプト/ターゲットユーザー/機能一覧/マネタイズ/技術スタック/運用方針、feature: 概要/画面構成/ユーザーフロー/データモデル/API設計/非機能要件）

**エラーが出た場合は、該当ファイルを修正して再度バリデーションを実行すること。全チェック通過するまで繰り返す。**

### ステップ8: 結果報告

以下を報告:
- 生成したアプリ名とコンセプト（1文）
- 出力先パス
- 生成した機能数
- バリデーション結果

## マルチエージェント連携（generate.sh 経由の場合）

`pnpm generate` で実行する場合、`app.config.yaml` の `generate.agents` 設定に基づき、外部エージェント（Codex CLI / Gemini CLI）が各フェーズで自動的に呼び出される。

### フロー

```
[Phase 1: Research]  gemini (researcher) — トレンド・市場調査
    ↓ research_context として渡される
[Phase 2: Design]    codex (designer) — アプリコンセプト設計提案
    ↓ design_context として渡される
[Phase 3: Generate]  Claude Code — 本スキルによるメイン生成（本ステップ）
    ↓
[Phase 4: Review]    codex/gemini (reviewer) — 品質レビュー
```

- Phase 1-2 の結果はプロンプト内に「参考情報」として含まれる
- 参考情報はあくまで参考であり、そのまま採用する必要はない
- `--skip-agents` オプションで外部エージェントをスキップ可能

### 対話的実行時の外部エージェント利用

対話的に `/generate-requirements` を使う場合、必要に応じて手動でエージェントを呼び出せる:

```bash
# Codex に設計相談
codex exec --model o4-mini --sandbox read-only --full-auto "{質問}" 2>/dev/null

# Gemini にトレンド調査
gemini -p "{調査内容}" 2>/dev/null
```

詳細は `.claude/rules/codex-delegation.md` / `.claude/rules/gemini-delegation.md` を参照。

## 注意事項

- overview.md の機能一覧に載せた機能は **全て** features/ に個別ファイルを作ること。漏れは不可
- features/ のファイル名の `{feature_name}` 部分は overview.md の機能名と対応させること
- 全ファイルは日本語で記述する（コード例・API パス・技術用語は英語可）
- 既存の `gen/requirements/` 内の他アプリのディレクトリには一切触れないこと
