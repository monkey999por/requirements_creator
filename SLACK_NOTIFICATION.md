# Slack通知セットアップ

`pipeline` および `generate` の完了時にSlackへ通知を送信する機能です。

## 前提条件

- Slackワークスペースへのアクセス権限
- Slack Appの作成権限（または管理者への依頼）

## セットアップ手順

### 1. Slack Appの作成とIncoming Webhookの取得

1. [Slack API](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch** を選択
3. App名（例: `Requirements Creator`）とワークスペースを指定して作成
4. 左メニューの **Incoming Webhooks** をクリック
5. **Activate Incoming Webhooks** をONにする
6. **Add New Webhook to Workspace** をクリック
7. 通知先のチャンネルを選択して **Allow**
8. 生成された **Webhook URL** をコピー

### 2. 環境変数の設定

`.env` ファイルに以下を追加:

```env
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
```

### 3. 設定ファイルの有効化

`app.config.yaml` の `notifications.slack.enabled` を `true` に変更:

```yaml
notifications:
  slack:
    enabled: true
    webhook_url_env: SLACK_WEBHOOK_URL
```

## 設定項目

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| `enabled` | Slack通知の有効/無効 | `false` |
| `webhook_url_env` | Webhook URLを格納する環境変数名 | `SLACK_WEBHOOK_URL` |

## 通知タイミング

| タイミング | コマンド | 通知内容 |
|-----------|---------|---------|
| パイプライン完了時 | `pnpm pipeline` | 各ステップの成否、生成アプリ名、記事数・キーワード数 |
| 要件生成完了時 | `pnpm generate` | 生成完了、新規アプリ名 |

**注意**: `pnpm pipeline` 経由で `generate` が実行された場合、パイプライン側でまとめて通知されます（二重通知なし）。

## 通知メッセージ例

### パイプライン完了時

```
✅ パイプライン完了
───────────────
ステップ結果:
  ✅ collect
  ✅ extract
  ✅ generate
  ✅ validate
───────────────
記事数: 20
キーワード数: 15
生成アプリ: my-awesome-app
```

### 一部失敗時

```
⚠️ パイプライン一部失敗
───────────────
ステップ結果:
  ✅ collect
  ✅ extract
  ❌ generate
```

## トラブルシューティング

### 通知が届かない場合

1. `.env` の `SLACK_WEBHOOK_URL` が正しく設定されているか確認
2. `app.config.yaml` の `notifications.slack.enabled` が `true` か確認
3. Webhook URLの有効期限が切れていないか確認（Slack Appの設定画面で確認）

### Webhook URLのテスト

以下のコマンドで直接テスト可能:

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"テスト通知"}' \
  $SLACK_WEBHOOK_URL
```
