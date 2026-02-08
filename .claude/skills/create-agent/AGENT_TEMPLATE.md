# エージェント（.md）テンプレート

会話内容から適切なエージェントを生成するためのテンプレート。

---

## フロントマター フィールド定義

`---` で囲まれたYAMLブロック。`name` と `description` が必須。

```yaml
---
# エージェント名。一意の識別子
# 使える文字: 小文字(a-z)、数字(0-9)、ハイフン(-) のみ
# Claudeが「Use the {name} agent to ...」のように参照する
# 必須
name: my-agent

# エージェントの説明。Claudeが「このタスクをこのエージェントに委譲すべきか」を判断する材料
# 「いつ使うか」を含めると委譲精度が上がる
# 例: "コードレビューの専門家。コード変更後に積極的に使用"
# 必須
description: エージェントの説明文

# エージェントが使用できるツール
# カンマ区切りで列挙。省略時はメイン会話の全ツールを継承
# 利用可能なツール:
#   Read        - ファイル読み込み
#   Write       - ファイル書き込み（新規作成）
#   Edit        - ファイル編集（既存ファイルの部分置換）
#   Glob        - ファイルパターン検索（例: **/*.ts）
#   Grep        - ファイル内容検索（正規表現対応）
#   Bash        - シェルコマンド実行
#   WebFetch    - URL取得
#   WebSearch   - Web検索
#   Task        - サブエージェント起動（※エージェントからは使用不可。ネスト禁止）
#   Skill       - スキル呼び出し
#   NotebookEdit - Jupyter Notebook編集
# 任意
tools: Read, Grep, Glob

# 拒否するツール。継承したツールから除外する場合に使う
# tools と併用する場合、tools で許可したものから更に除外する
# 任意
disallowedTools: Write, Edit

# 使用するモデル
# 選択肢:
#   haiku   - 高速・低コスト。単純な検索・分類タスク向け
#   sonnet  - バランス型。コード分析・一般的なタスク向け
#   opus    - 高精度。複雑な推論・設計判断向け
#   inherit - メイン会話と同じモデル（デフォルト）
# 必ずinherit
model: inherit

# 権限モード。エージェントが権限プロンプトをどう処理するか
# 選択肢:
#   default           - 標準の権限チェック（プロンプト表示）
#   acceptEdits       - ファイル編集を自動承認
#   dontAsk           - 権限プロンプトを自動拒否（明示許可ツールは動作）
#   bypassPermissions - 全権限チェックをスキップ（注意: 非推奨）
#   plan              - 読み取り専用の計画モード
# 必ずacceptEdits
permissionMode: acceptEdits

# スタートアップ時にコンテキストにプリロードするスキル
# スキルの完全な内容が注入される（呼び出し可能になるだけではない）
# エージェントは親の会話からスキルを継承しないため、必要なスキルは明示的に列挙する
# 任意
skills:
  - api-conventions
  - error-handling-patterns

# 永続メモリスコープ。会話をまたいで知識を蓄積する
# 選択肢:
#   user    - ~/.claude/agent-memory/{name}/  全プロジェクト共通（推奨デフォルト）
#   project - .claude/agent-memory/{name}/    プロジェクト固有（バージョン管理可）
#   local   - .claude/agent-memory-local/{name}/ プロジェクト固有（バージョン管理外）
# 必ずproject
memory: project

# ライフサイクルフック。エージェント実行中に発火するコマンド
# 利用可能なイベント:
#   PreToolUse  - ツール使用前（matcher でツール名指定）
#   PostToolUse - ツール使用後（matcher でツール名指定）
#   Stop        - エージェント完了時
# 任意
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
---
```

---

## マークダウン本文（システムプロンプト）

フロントマターの下に記述するマークダウンが、エージェントのシステムプロンプトになる。
エージェントはこのプロンプト**のみ**を受け取る（Claude Codeの完全なシステムプロンプトは受け取らない）。

### 記述すべき内容

1. **役割定義** - エージェントが何の専門家か
2. **呼び出し時の行動** - 何をどの順で実行するか
3. **判断基準・チェックリスト** - 何を確認するか
4. **出力形式** - 結果をどうフォーマットするか

---

## テンプレート一覧

### 読み取り専用エージェント（調査・分析）

コードを変更せず、調査・分析・レビューを行うエージェント。

```markdown
---
name: {agent-name}
description: {何の専門家か。いつ使うか}
tools: Read, Grep, Glob, Bash
model: sonnet
---

あなたは{専門分野}の専門家です。

呼び出されたら:
1. {分析ステップ1}
2. {分析ステップ2}
3. {分析ステップ3}

## 確認項目

- {チェック項目1}
- {チェック項目2}

## 出力形式

{結果のフォーマット指定}
```

---

### 実装エージェント（コード変更あり）

コードの修正・生成を行うエージェント。

```markdown
---
name: {agent-name}
description: {何の専門家か。いつ使うか}
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
---

あなたは{専門分野}の専門家です。

呼び出されたら:
1. {実装ステップ1}
2. {実装ステップ2}
3. {検証ステップ}

## 実装ルール

- {ルール1}
- {ルール2}

## 完了条件

- {条件1}
- {条件2}
```

---

### スキルプリロード付きエージェント

事前にスキルの知識を注入して動作するエージェント。

```markdown
---
name: {agent-name}
description: {何の専門家か。いつ使うか}
tools: Read, Edit, Write, Bash, Grep, Glob
skills:
  - {skill-name-1}
  - {skill-name-2}
---

あなたは{専門分野}の専門家です。
プリロードされたスキルの規約・パターンに従って作業を行います。

呼び出されたら:
1. {ステップ1}
2. {ステップ2}
```

---

### メモリ付きエージェント

会話をまたいで知識を蓄積するエージェント。

```markdown
---
name: {agent-name}
description: {何の専門家か。いつ使うか}
tools: Read, Grep, Glob, Bash
memory: user
model: sonnet
---

あなたは{専門分野}の専門家です。

作業開始前にエージェントメモリを確認し、過去の知見を活用してください。
作業完了後、発見したパターン・知見をメモリに記録してください。

呼び出されたら:
1. メモリを確認
2. {メインタスク}
3. 知見をメモリに保存
```
