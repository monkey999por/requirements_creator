# 要件ファイルテンプレート

## overview.md

```markdown
# {アプリ名}

## コンセプト

{1-2文でアプリの核心を簡潔に}

## ターゲットユーザー

{想定ユーザー層と、そのユーザーが抱える課題}

## 機能一覧

| ID | 機能名 | 概要 | 優先度 |
|----|--------|------|--------|
| 01 | ... | ... | 高/中/低 |

## マネタイズ

{収益化の方針。フリーミアム/サブスク/広告/買い切り等の具体的なモデル}

## 技術スタック（提案）

{推奨する技術構成。フロントエンド/バックエンド/DB/インフラ等}

## 運用方針

{インフラ構成・デプロイ方式・監視・スケーリング等}
```

## features/{feature_id}_{feature_name}.md

```markdown
# {機能名}

## 概要

{この機能が解決する課題と提供する価値}

## 画面構成

{画面の説明。主要なUI要素、レイアウト、画面遷移を具体的に}

## ユーザーフロー

{操作手順をステップで記述}

1. ユーザーが〜する
2. システムが〜を表示する
3. ...

## データモデル

{この機能に関連するデータ構造。テーブル/コレクション定義}

## API設計

{必要なエンドポイント}

| メソッド | パス | 概要 |
|----------|------|------|
| GET | /api/... | ... |

## 非機能要件

{パフォーマンス目標、セキュリティ要件、アクセシビリティ等}
```

## diagrams.md

overview.mdと各機能の仕様内容に基づき、D2記法でアプリケーションの設計図を作成する。

````markdown
# {アプリ名} 設計図

## 画面遷移図

アプリの主要画面間のナビゲーション遷移を示す。

```d2
direction: right

home: ホーム画面 {
  shape: rectangle
}
login: ログイン画面 {
  shape: rectangle
}
dashboard: ダッシュボード {
  shape: rectangle
}
settings: 設定画面 {
  shape: rectangle
}

home -> login: ログイン
login -> dashboard: 認証成功
dashboard -> settings: 設定へ
settings -> dashboard: 戻る
```

## ユーザーフロー: {メインユースケース名}

{メインのユースケースをシーケンス図で記述。2〜3シナリオ作成する}

```d2
shape: sequence_diagram

user: ユーザー
frontend: フロントエンド
api: APIサーバー
db: データベース

user -> frontend: 操作する
frontend -> api: リクエスト送信
api -> db: データ取得
db -> api: 結果返却
api -> frontend: レスポンス
frontend -> user: 結果表示
```

## システム構成図

フロントエンド・バックエンド・DB・外部サービスの構成を示す。

```d2
direction: right

client: クライアント {
  browser: ブラウザ {
    shape: rectangle
  }
}

server: サーバー {
  api: APIサーバー {
    shape: rectangle
  }
  auth: 認証サービス {
    shape: rectangle
  }
}

data: データ層 {
  db: データベース {
    shape: cylinder
  }
  cache: キャッシュ {
    shape: cylinder
  }
}

client.browser -> server.api: HTTPS
server.api -> server.auth: 認証チェック
server.api -> data.db: クエリ
server.api -> data.cache: キャッシュ参照
```
````

### diagrams.md 作成時の注意事項

- D2コードブロックは必ず ` ```d2 ` で開始し ` ``` ` で閉じる
- 画面遷移図・ユーザーフロー・システム構成図の **3種類すべて** を含めること
- ユーザーフローは `shape: sequence_diagram` を使ったシーケンス図で記述すること（2〜3シナリオ）
- ラベルやコメントは日本語で記述する
- overview.mdの機能一覧・技術スタックと整合性を保つこと
- 上記テンプレートはあくまで構造の例。実際のアプリの内容に合わせて図の中身を具体的に記述すること

## D2記法リファレンス

D2（Declarative Diagramming）の主要な記法。公式ドキュメント: https://d2lang.com/tour/intro/

### ノード（形状）の宣言

```d2
# 基本宣言（デフォルトは rectangle）
my_node

# ラベル付き
my_node: "表示ラベル"

# 形状指定
db: データベース {
  shape: cylinder
}
user: ユーザー {
  shape: person
}
cloud_service: クラウド {
  shape: cloud
}
```

**利用可能な形状**: `rectangle`, `circle`, `oval`, `diamond`, `hexagon`, `cylinder`, `queue`, `package`, `step`, `callout`, `stored_data`, `person`, `document`, `page`, `parallelogram`, `cloud`

### 接続（矢印）

```d2
# 右方向矢印
A -> B

# 左方向矢印
A <- B

# 双方向矢印
A <-> B

# ラベル付き接続
A -> B: リクエスト送信

# 接続チェイン
A -> B -> C -> D
```

### コンテナ（グループ化）

```d2
server: サーバー {
  api: API {
    shape: rectangle
  }
  db: DB {
    shape: cylinder
  }
  api -> db: クエリ
}
```

### レイアウト方向

```d2
direction: right  # right, left, up, down
```

### シーケンス図

```d2
shape: sequence_diagram

actor1: アクター1
actor2: アクター2
system: システム

actor1 -> system: リクエスト
system -> actor2: 通知
actor2 -> system: 応答
system -> actor1: 結果返却
```

## _source_info.json

```json
{
  "source": {
    "directory": "gen/data_source/{タイムスタンプ}/",
    "collected_at": "{yyyy-MM-dd HH:mm:ss形式の収集日時}"
  },
  "keywords": [
    { "word": "{採用キーワード1}", "relevance": 0.90 },
    { "word": "{採用キーワード2}", "relevance": 0.85 }
  ],
  "tags": ["{タグ1}", "{タグ2}"],
  "description": "{なぜこのアプリ案が生まれたか。どのキーワード/トレンドの組み合わせから着想したかを人間が理解できるように簡潔に}"
}
```

**タグ値（以下から最低2つ選択）**: AI, Web3, ヘルスケア, 教育, 金融, モビリティ, サステナビリティ, エンタメ

## _source_info.json（データセットモード用）

データセットから要件を生成した場合は、以下のスキーマで `_source_info.json` を出力する:

```json
{
  "source": {
    "directory": "dataset://{データセット名}",
    "collected_at": "{yyyy-MM-dd HH:mm:ss形式の生成日時}"
  },
  "dataset": {
    "name": "{データセット名}",
    "sourceApps": [
      { "appName": "{参照元アプリ名}", "type": "overview" },
      { "appName": "{参照元アプリ名}", "type": "feature", "featureId": "{機能ID}", "title": "{機能タイトル}" }
    ]
  },
  "keywords": [
    { "word": "{採用キーワード1}", "relevance": 0.90 }
  ],
  "tags": ["{タグ1}", "{タグ2}"],
  "description": "{なぜこのアプリ案が生まれたか}"
}
```

- `source.directory` は `dataset://{データセット名}` 形式にする
- `dataset.sourceApps` にはデータセットに含まれる全アイテムを列挙する
- 各 `sourceApps` 項目の `type` は `"overview"` または `"feature"`。`type: "feature"` の場合は `featureId` と `title` も含める
