# 05: Webビューワー

## 概要

生成された要件（`requirements/` 配下のMarkdownファイル）をブラウザで閲覧するための簡易Webアプリケーションを構築する。サイドバーでアプリ案を切り替え、MarkdownをHTMLにレンダリングして表示する。

## 前提

- `04_requirements-generation.md` が完了し、`requirements/` にデータが存在すること
- 技術スタック: TypeScript + Node.js + React（README指定）

## 必要な作業

### サーバサイド（Node.js）

- `viewer/` ディレクトリにWebアプリを構築
- APIエンドポイント:
  - `GET /api/apps` - `requirements/` 配下のアプリ一覧を返す
  - `GET /api/apps/:appName/overview` - 指定アプリの `overview.md` を返す
  - `GET /api/apps/:appName/features` - 指定アプリの機能一覧を返す
  - `GET /api/apps/:appName/features/:featureId` - 指定機能の詳細を返す
  - `GET /api/apps/:appName/source-info` - `_source_info.md` を返す
- Markdownファイルの読み込みとメタデータ抽出
- ファイルシステム監視（任意: 変更時のホットリロード）

### フロントエンド（React）

- **レイアウト構成**:
  - サイドバー: アプリ案一覧（`requirements/` 内のディレクトリ名を表示、クリックで切り替え）
  - メインエリア: 選択したアプリの要件表示
- **メインエリアの表示**:
  - ファーストビューで `overview.md` と全機能の概要を1ページで俯瞰できる構成
  - 各機能をカード/セクション形式で並べ、クリックで詳細展開
  - 複数ペイン分割表示（README指定: 「複数ペインに分割して表示」）
    - 例: 左ペインにoverview、右ペインに選択した機能の詳細
- **Markdownレンダリング**:
  - `remark` / `unified` を使用（README指定）
  - シンタックスハイライト（コードブロック対応）
  - テーブル、リスト等の標準Markdown要素のスタイリング

### 技術選定の検討事項

- フレームワーク: Vite + React が軽量で適切（簡易サーバなので重厚なフレームワークは不要）
- サーバ: Express or Hono（APIサーバ）
- Markdownパーサー: `unified` + `remark-parse` + `remark-react` or `react-markdown`
- スタイリング: Tailwind CSS or CSS Modules（要検討）

### 起動コマンド

- 開発: `pnpm --filter viewer dev`
- ビルド: `pnpm --filter viewer build`
- 起動: `pnpm --filter viewer start`
- または簡易に: `pnpm viewer`

## 完了条件

- `pnpm viewer` 等でローカルサーバが起動し、ブラウザでアクセスできる
- サイドバーに `requirements/` 内のアプリ案一覧が表示される
- アプリ案を選択すると `overview.md` と機能一覧がレンダリング表示される
- 各機能の詳細 Markdown がレンダリングされて閲覧できる
- ファーストビューで概要と機能一覧を俯瞰できる
