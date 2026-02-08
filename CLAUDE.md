# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<language>Japanese</language>
<character_code>UTF-8</character_code>

## プロジェクト概要

ニュースやトレンド情報を収集し、そこからアプリケーション設計アイデアを連想方式で生成するツール。収集したデータからキーワードを抽出し、要件定義（overview + 機能別仕様）を自動生成する。生成された要件はMarkdownベースのWebビューワーで閲覧可能。

## アーキテクチャ

### データパイプライン

1. **データ収集**: NewsAPI・YouTube等の外部APIからトレンド情報を取得し `data_source/yyyy_mm_dd_hh_mm_ss/` に保存
2. **キーワード抽出**: 収集データからアプリ設計のヒントとなるキーワードを抽出・ベクトル化（`keyword.json`）
3. **要件生成**: キーワードからの連想でアプリ案を生成し `requirements/{app_name}/` に配置
4. **閲覧**: Node.js + React製のMarkdownビューワーで要件を表示

### ディレクトリ構造の意味

- `data_source/` - 外部API（NewsAPI等）から取得した生データ。タイムスタンプ付きサブディレクトリで管理
- `requirements/` - 生成されたアプリ要件。アプリ単位のサブディレクトリに `overview.md` と `features/{feature_id}_{feature_name}.md` を配置

### 計画中の技術スタック

- データ収集・処理: シェルスクリプト / Node.js（CLIツール群）
- Webビューワー: TypeScript + Node.js + React（remark/unified でMarkdownレンダリング）
- パッケージマネージャ: pnpm
- フォーマッター: `pnpm format`（ファイル編集時にhookで自動実行）

## 環境変数

`.env` に以下のAPIキーを設定:
- `NEWS_API_KEY` - NewsAPI用

## カスタムエージェント

- `update-memory` - CLAUDE.mdをプロジェクト最新情報に同期更新
- `update-docs` - README.md / docs配下のドキュメントをコードベースに同期更新
- `tech-spec-validator` - ライブラリ導入時に最新の公式ドキュメントを調査し、ベストプラクティスに基づく実装を行う。推測での実装を禁止

## 開発規約

- ドキュメント・コミュニケーションは日本語（コード例は除く）
- 技術選定時は必ず公式ドキュメントを参照し、内部知識だけで判断しない（`tech-spec-validator`エージェントを活用）
- 調査結果は `docs/_research/{date}_{title}` 形式でドキュメント化
