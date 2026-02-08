---

## フロントマター フィールド定義

`---` で囲まれたYAMLブロック。すべてのフィールドは任意だが `description` は強く推奨。

```yaml
---
# スキル名。省略時はディレクトリ名が使われる
# 使える文字: 小文字(a-z)、数字(0-9)、ハイフン(-) のみ。最大64文字
# この名前が /スラッシュコマンド になる（例: name: deploy → /deploy）
name: my-skill

# スキルの説明。Claudeが「このスキルを自動で呼び出すべきか」を判断する材料になる
# 「いつ使うか」を含めると精度が上がる
# 例: "PRのレビューを行う。コードレビュー依頼時やPR作成後に使用"
description: スキルの説明文

# /スキル名 の後に何を入力すべきかのヒント。オートコンプリートUIに表示される
# 例: "[issue-number]", "[filename] [format]", "[feature-name]"
argument-hint: "[引数の説明]"

# Claudeの自動呼び出しを無効化し、ユーザーが /名前 で明示的に呼び出した時だけ実行する
# 必ず true を設定すること
disable-model-invocation: true

# 必ずfalse
user-invocable: false

# スキル実行中に Claude が許可プロンプトなしで使えるツールを制限する
# カンマ区切りで列挙。省略時はすべてのツールを使用可能
# 利用可能なツール:
#   Read        - ファイル読み込み
#   Write       - ファイル書き込み（新規作成）
#   Edit        - ファイル編集（既存ファイルの部分置換）
#   Glob        - ファイルパターン検索（例: **/*.ts）
#   Grep        - ファイル内容検索（正規表現対応）
#   Bash        - シェルコマンド実行。特定コマンドに制限可: Bash(git:*), Bash(npm:*)
#   WebFetch    - URL取得
#   WebSearch   - Web検索
#   Task        - サブエージェント起動
#   Skill       - 他のスキル呼び出し
#   NotebookEdit - Jupyter Notebook編集
allowed-tools: Read, Grep, Glob

# 使用するモデルを指定
# 選択肢: sonnet, opus, haiku, inherit（親から継承）
# デフォルト: inherit
model: inherit

---
```

---

## コンテンツで使える変数・構文

スキル本文（フロントマターの下のマークダウン部分）で使用可能。

### 文字列置換

| 構文 | 説明 | 展開タイミング |
|------|------|---------------|
| `$ARGUMENTS` | `/スキル名 ここの部分` で渡された引数全体。コンテンツ内に `$ARGUMENTS` がない場合は末尾に `ARGUMENTS: 値` として自動追加される | スキル呼び出し時 |
| `${CLAUDE_SESSION_ID}` | 現在のセッションの一意なID。ログファイル名やセッション固有の出力に使う | スキル呼び出し時 |

### 動的コンテキスト注入

| 構文 | 説明 |
|------|------|
| `` !`シェルコマンド` `` | スキルがClaudeに渡される**前**にシェルコマンドを実行し、その出力でプレースホルダーを置換する。Claudeはコマンド自体を見ず、実行結果のみ受け取る |

```markdown
# 使用例
- 現在のブランチ: !`git branch --show-current`
- 変更ファイル: !`git diff --name-only`
- PR情報: !`gh pr view --json title,body`
```

### サポートファイル参照

SKILL.md から同ディレクトリ内の別ファイルを参照できる。Claudeは必要に応じてファイルを読み込む。

```markdown
詳細は [reference.md](reference.md) を参照
使用例は [examples/](examples/) を参照
```

---

## テンプレート一覧

### タスク型

手順・ワークフローをスキル化する場合。ユーザーが `/名前` で明示的に呼び出す。

```markdown
---
name: {skill-name}
description: {何をするスキルか。1文で}
disable-model-invocation: true
argument-hint: "{引数の説明}"
---

# {タイトル}

`$ARGUMENTS` に対して以下を実行する。

## 手順

1. {ステップ1}
2. {ステップ2}
3. {ステップ3}

## 注意事項

- {会話で判明した落とし穴・注意点}
```

---

### リファレンス型

規約・パターン・知識をスキル化する場合。ユーザーもClaudeも呼び出せる。

```markdown
---
name: {skill-name}
description: {どんな知識・規約か}
disable-model-invocation: true
---

# {タイトル}

{規約・パターン・知識の記述}

## ルール

- {ルール1}
- {ルール2}

## 例

{具体例}
```

---

### リファレンス型（バックグラウンド知識）

Claudeだけが自動参照する知識。`/`メニューには表示されない。

```markdown
---
name: {skill-name}
description: {どんな知識か}
disable-model-invocation: true
user-invocable: false
---

# {タイトル}

{Claudeが参照すべき知識}
```
