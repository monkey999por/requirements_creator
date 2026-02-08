---
name: fix-issue
description: GitHub Issueの内容を確認し、ユーザーと対応方針を合意した上でIssueにコメントを残してからコード修正・PR作成を行う。Issue番号（#1等）を引数で指定。
disable-model-invocation: true
argument-hint: "[#Issue番号]"
---

# Issue 対応

`$ARGUMENTS` で指定されたGitHub Issueの対応を行う。

## 前提情報

- 現在のブランチ: !`git branch --show-current`
- リモート: !`git remote -v | head -1`

## 手順

### 1. Issue番号の解決

`$ARGUMENTS` から `#` を除去してIssue番号を取得する。

### 2. Issue情報の取得

```bash
gh issue view <番号> --json title,body,state,labels,assignees,comments
```

- Issueがclosedの場合は、その旨を報告して終了する
- ステートがopenであることを確認してから続行

### 3. Issue内容の分析

以下を読み取る:
- 報告された問題 / 要望の内容
- 再現手順（バグの場合）
- 期待する動作
- ラベル（bug, enhancement, etc.）
- 既存のコメントでの議論内容

### 4. コードベース調査

Issueの内容に関連するコードを調査:
- 該当する機能・モジュールの特定
- 影響範囲の把握
- 修正方針の検討

### 5. 分析結果の提示とユーザーへの確認

取得・分析した情報を以下の形式で整理し、ユーザーに提示する:

```
## Issue #<番号>: <タイトル>

**ステート**: open | **ラベル**: bug / enhancement / ...

### Issue内容の要約

<Issueの内容を簡潔にまとめる>

### 影響範囲

- <関連ファイル1>
- <関連ファイル2>

### 対応方針

| # | 対応内容 | 対象ファイル |
|---|---------|-------------|
| 1 | <具体的な修正内容> | <ファイルパス> |
| 2 | <具体的な修正内容> | <ファイルパス> |

上記の方針で進めてよいですか？変更があれば指示してください。
```

**必ずユーザーの承認を得てから次のステップに進む。**

### 6. Issueへの対応方針コメント

ユーザー承認後、Issueに対応方針をコメントとして残す:

```bash
gh issue comment <番号> --body "<コメント本文>"
```

コメント形式:
```markdown
## 対応方針

以下の方針で対応します。

| # | 対応内容 |
|---|---------|
| 1 | <具体的な対応内容> |
| 2 | <具体的な対応内容> |

対応PRを作成次第リンクします。
```

### 7. 作業ブランチの作成

```bash
git checkout -b fix/<番号>-<issueの短い説明> <ベースブランチ>
```

ブランチ名の例: `fix/1-broken-collect-command`, `feat/2-add-youtube-source`

### 8. コード修正

- Issueの内容とユーザー合意済みの方針に忠実に修正
- 修正範囲はIssueの対応に限定し、無関係な変更を含めない
- lint/formatチェックを実行: `pnpm check` (失敗した場合は修正)

### 9. コミット

```bash
git add <修正ファイル>
git commit -m "<type>: <修正内容の要約> (#<番号>)

- <対応内容1>
- <対応内容2>

Closes #<番号>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

コミットタイプ:
- `fix`: バグ修正
- `feat`: 新機能
- `refactor`: リファクタリング
- `docs`: ドキュメント修正

### 10. PR作成

```bash
git push -u origin <ブランチ名>
gh pr create --title "<type>: <修正内容の要約>" --body "$(cat <<'EOF'
## Summary

<修正内容の要約>

Closes #<番号>

## Changes

- <変更点1>
- <変更点2>

## Test plan

- <確認項目1>
- <確認項目2>
EOF
)"
```

### 11. 対応完了報告

```
✅ Issue #<番号> 対応完了
   ブランチ: <branch-name>
   PR: <PR URL>

   対応内容:
   - <対応1>
   - <対応2>

   Issueにコメント済み、PRにCloses #<番号>を記載済みです。
```

## 注意事項

- ユーザー確認なしでコード修正を開始しない
- force pushは絶対に行わない
- Issueと無関係なリファクタリングや改善を含めない
- `--no-verify` でコミットフックをスキップしない
- Issueを自動でcloseしない（PRマージ時に自動closeされる）
- `gh` CLIが未認証の場合は `gh auth login` の実行を案内して終了
