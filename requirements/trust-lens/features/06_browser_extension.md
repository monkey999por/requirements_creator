# ブラウザ拡張連携

## 概要

Chromeブラウザで閲覧中のWebページに対してリアルタイムで信頼度バッジを表示する拡張機能。ユーザーがアプリを開かなくても、普段のブラウジング中に自然と情報の信頼度を確認できるようにする。

## 画面構成

- **ツールバーアイコン**: 現在のページの信頼度スコアを色付きバッジで表示（緑/黄/赤）
- **ポップアップパネル**: アイコンクリックで簡易スコア・バイアスサマリー・ソース情報を表示
- **インラインバッジ**: Google検索結果やSNSフィード内のリンクに小さな信頼度バッジをオーバーレイ
- **設定画面**: 表示対象サイトのホワイトリスト/ブラックリスト、バッジ表示位置の設定

## ユーザーフロー

1. Chrome Web Storeから拡張機能をインストール
2. TrustLensアカウントでログイン（Proプラン必須）
3. 任意のニュースサイトにアクセスするとツールバーアイコンに信頼度バッジが表示
4. アイコンをクリックするとポップアップで詳細スコアを確認
5. 「詳細分析」リンクからWebアプリの全機能分析画面に遷移

## データモデル

- **extension_sessions テーブル**: id, user_id, browser_id, last_active_at
- **page_analyses_cache テーブル**: id, url_hash, trust_score, bias_summary_json, cached_at, expires_at
- **extension_settings テーブル**: id, user_id, show_inline_badges, whitelist_domains_json, blacklist_domains_json

## API設計

| メソッド | パス | 概要 |
|----------|------|------|
| POST | /api/extension/analyze | 閲覧中ページのURLを送信し信頼度を取得（軽量版） |
| GET | /api/extension/batch | 複数URLの信頼度を一括取得（検索結果ページ用） |
| PUT | /api/extension/settings | 拡張機能の設定を更新 |

## 非機能要件

- 分析レスポンス: 3秒以内（ブラウジング体験を阻害しない）
- キャッシュヒット時は100ms以内
- Chrome Extension Manifest V3準拠
- メモリ使用量: 50MB以下
- バックグラウンドでの通信はユーザーのブラウジングに影響を与えない
