---
name: self-healing
description: パイプラインログを解析し、コマンドの自己修復を行うスキル
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(git:*)
  - Bash(tsx:*)
  - Bash(pnpm:*)
---

# 自己修復スキル

パイプライン実行ログを解析し、コマンドの問題を検出・修復するスキル。

## ログの見方

ログファイルは `logs/` ディレクトリに JSONL 形式（1行1エントリ）で保存される。

### ログエントリの構造

```json
{
  "timestamp": "ISO 8601形式",
  "level": "info | warn | error | debug",
  "step": "collect | extract | generate | validate | pipeline",
  "message": "メッセージ本文",
  "data": {
    "任意のデータ": "..."
  }
}
```

### 重要なエントリパターン

1. **ステップ開始**: `message` が `"{step} 開始"` のエントリ
2. **ステップ完了**: `data.summary` に `{step, status, durationMs, error?}` を含むエントリ
3. **設定情報**: `message` が `"設定情報"` で `data.config` に使用された設定が記録
4. **コマンド実行**: `message` が `"コマンド実行: ..."` で実行されたコマンドが記録
5. **エラー**: `level` が `"error"` のエントリ

## チェック項目

### 1. app.config.yaml との整合性チェック

以下を確認する:

- **collect.sources**: 有効化されているソースがすべてログに記録されているか
- **collect.sources.*.api_key_env**: APIキー未設定の警告がないか
- **extract.association**: 連想モードの設定がログの記録と一致するか
- **generate.agents**: エージェント設定が正しく適用されているか
- **generate.constraints**: 制約設定がログに反映されているか

### 2. 失敗コマンドの検出

以下のパターンで失敗を検出:

- `level: "error"` かつ `data.summary.status === "failed"` → ステップ全体の失敗
- `level: "error"` かつメッセージに「失敗」「エラー」を含む → 個別操作の失敗
- `level: "warn"` かつ「スキップ」を含む → 想定外のスキップ

### 3. パフォーマンス異常

- ステップの `durationMs` が通常よりも極端に長い場合（collect: 5分以上、extract: 10分以上、generate: 30分以上）

## 修正方針

### 設定不整合の場合

1. `app.config.yaml` の設定が正しいか確認
2. コマンドのコードが設定を正しく読み込んでいるか確認
3. 設定の読み込みロジックに問題がある場合、コードを修正

### コマンド失敗の場合

1. エラーメッセージから失敗原因を特定
2. 原因に応じた修正:
   - **API呼び出しエラー**: エンドポイントやパラメータの修正
   - **ファイルI/Oエラー**: パスやパーミッションの修正
   - **パースエラー**: データ形式の修正
   - **タイムアウト**: リトライロジックの追加・改善
3. 必要に応じて追加のログ出力をコマンドに仕込む

### 修正の原則

- 最小限の変更で問題を修正する
- 既存の動作に影響を与えないようにする
- 修正後は `pnpm check` でフォーマット・リントを確認
- テスト可能な場合はテストを実行

## 修復後の処理

1. 変更されたファイルを `git add` でステージング
2. `fix: 自己修復 - <修正内容の要約>` 形式でコミット
3. PRを作成（developへのマージ）
4. ログディレクトリを削除（修復完了の証として）
