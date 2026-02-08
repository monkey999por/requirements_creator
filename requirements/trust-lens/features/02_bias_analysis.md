# バイアス分析

## 概要

記事に含まれる政治的・商業的・感情的バイアスを検出し、レーダーチャートで可視化する。ユーザーが記事の偏りを直感的に把握でき、多角的な情報収集を促す。

## 画面構成

- **レーダーチャート**: 5軸（政治的偏向、商業的バイアス、感情的表現、事実vs意見の比率、情報源の多様性）
- **偏向インジケーター**: 左右の政治スペクトラム上での位置表示
- **ハイライトビュー**: 記事本文中のバイアス該当箇所をカラーハイライト表示
- **比較パネル**: 同一トピックの別視点記事を推薦表示

## ユーザーフロー

1. 記事信頼度スコアリング画面から「バイアス詳細」をタップ
2. レーダーチャートと偏向インジケーターが表示される
3. 「本文ハイライト」タブでバイアス箇所がマーキングされた記事を閲覧
4. 「別視点」タブで同一トピックの異なる視点の記事が表示される

## データモデル

- **bias_reports テーブル**: id, analysis_id, political_score(-1.0〜1.0), commercial_score, emotional_score, fact_opinion_ratio, source_diversity_score
- **bias_highlights テーブル**: id, bias_report_id, start_offset, end_offset, bias_type, explanation
- **alternative_articles テーブル**: id, bias_report_id, article_url, article_title, perspective_label

## API設計

| メソッド | パス | 概要 |
|----------|------|------|
| GET | /api/analyses/:id/bias | バイアス分析結果を取得 |
| GET | /api/analyses/:id/bias/highlights | バイアスハイライト一覧を取得 |
| GET | /api/analyses/:id/alternatives | 別視点記事の推薦リストを取得 |

## 非機能要件

- バイアス分析は信頼度スコアリングと同時に実行（追加遅延なし）
- ハイライト表示はクライアントサイドレンダリングで高速表示
- 別視点記事の推薦は非同期で取得（初回表示後にバックグラウンドで取得）
