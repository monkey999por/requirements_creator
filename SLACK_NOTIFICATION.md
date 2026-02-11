# Slack通知セットアップ

`pipeline` および `generate` の完了時にSlackへ通知を送信する機能です。

通知先チャンネル: `#requirements_notify`

## 前提条件

- Slackワークスペースへのアクセス権限
- Slack Appの作成権限（または管理者への依頼）

## セットアップ手順

### 1. Slack Appの作成とBot Tokenの取得

1. [Slack API](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch** を選択
3. App名（例: `Requirements Creator`）とワークスペースを指定して作成
4. 左メニューの **OAuth & Permissions** をクリック
5. **Scopes** → **Bot Token Scopes** に `chat:write` を追加
6. ページ上部の **Install to Workspace** をクリックして承認
7. 表示された **Bot User OAuth Token**（`xoxb-` で始まる）をコピー
8. 通知先チャンネル `#requirements_notify` にAppを招待（チャンネル内で `/invite @AppName`）

### 2. 環境変数の設定

`.env` ファイルに以下を追加:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

### 3. 設定ファイルの確認

`app.config.yaml` の `notifications.slack` が以下のようになっていることを確認:

```yaml
notifications:
  slack:
    enabled: true
    token_env: SLACK_BOT_TOKEN
```

## 設定項目

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| `enabled` | Slack通知の有効/無効 | `true` |
| `token_env` | Bot Tokenを格納する環境変数名 | `SLACK_BOT_TOKEN` |

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

  ✅ collect
  ✅ extract
  ✅ generate
  ✅ validate

記事数: 20
キーワード数: 15
生成アプリ: my-awesome-app
```

### 一部失敗時

```
⚠️ パイプライン一部失敗

  ✅ collect
  ✅ extract
  ❌ generate
```

## トラブルシューティング

### 通知が届かない場合

1. `.env` の `SLACK_BOT_TOKEN` が正しく設定されているか確認
2. `app.config.yaml` の `notifications.slack.enabled` が `true` か確認
3. Appが `#requirements_notify` チャンネルに招待されているか確認
4. Bot Token Scopesに `chat:write` が含まれているか確認

### Bot Tokenのテスト

以下のコマンドで直接テスト可能:

```bash
curl -X POST 'https://slack.com/api/chat.postMessage' \
  -d "token=$SLACK_BOT_TOKEN" \
  -d 'channel=#requirements_notify' \
  -d 'text=テスト通知'
```
