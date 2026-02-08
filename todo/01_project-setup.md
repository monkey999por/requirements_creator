# 01: プロジェクト初期セットアップ

## 概要

pnpmワークスペースとTypeScript環境を整備し、全コンポーネントの基盤を構築する。

## 必要な作業

### pnpm初期化

- `pnpm init` でルートの `package.json` を作成
- `pnpm-workspace.yaml` を作成し、ワークスペース構成を定義
  - 想定パッケージ: CLIツール群（データ収集・キーワード抽出・要件生成）、Webビューワー
- `.npmrc` に必要な設定を追加（例: `shamefully-hoist=true` 等、必要に応じて）

### TypeScript設定

- ルートに `tsconfig.base.json` を作成（共通設定）
- 各パッケージで `tsconfig.json` を作成しルートを継承
- `ts-node` または `tsx` をdevDependenciesに追加（CLIスクリプト実行用）

### コード品質ツール

- フォーマッター導入（`.claude/settings.json` で `pnpm format` hookが設定済み）
  - Biome or Prettier のいずれかを選定・設定
- `pnpm format` スクリプトを `package.json` に定義

### .gitignore整備

- 現在 `.env` のみ → `node_modules/`, `dist/`, `.turbo/` 等を追加

### ディレクトリ構造の確定

```
requirements_creator/
├── scripts/           # CLIツール群（データ収集・キーワード抽出・要件生成）
│   ├── collect.ts     # データ収集エントリポイント
│   ├── extract.ts     # キーワード抽出エントリポイント
│   └── generate.ts    # 要件生成エントリポイント
├── viewer/            # Webビューワー（React + Node.js）
├── data_source/       # 収集データ格納先（生成物）
├── requirements/      # 生成された要件格納先（生成物）
├── todo/              # タスク管理
└── docs/              # ドキュメント
```

※ ディレクトリ構造はモノレポ（pnpm workspace）にするか、シンプルなスクリプト群にするか要検討。README上は「CLIで実行可能な単体のshell scriptやnodeで実行可能なもの」と記載されているため、軽量なスクリプト構成がベースとなる。

## 完了条件

- `pnpm install` が正常に完了する
- `pnpm format` が実行できる
- TypeScriptファイルを `tsx` 等で直接実行できる
- `.gitignore` が適切に設定されている
