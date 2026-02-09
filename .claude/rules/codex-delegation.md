# Codex Delegation Rule

**Codex CLI は要件生成における設計・レビューのパートナー。**

## このプロジェクトでの役割

| 役割 | フェーズ | 用途 |
|------|---------|------|
| **designer** | Phase 2 | keyword + research結果からアプリコンセプト案を提案 |
| **reviewer** | Phase 4 | 生成された要件の品質・完全性チェック |

## いつ使うか

### generate パイプライン内（自動）

`app.config.yaml` の `generate.agents.codex` が `enabled: true` かつ対応する role が設定されている場合、`generate.sh` が自動的に呼び出す。

### 対話的に使う場合

以下のような場面で Codex に相談:

1. **アプリ設計の判断** — 「このコンセプトは実現可能か？」「どのアーキテクチャが適切か？」
2. **要件のレビュー** — 「この要件は漏れがないか？」「機能の優先度は適切か？」
3. **トレードオフ分析** — 「技術スタックAとBのどちらが適切か？」

## 呼び出しパターン

### 直接呼び出し（短い質問）

```bash
codex exec --model o4-mini --sandbox read-only --full-auto "Brief question" 2>/dev/null
```

### サブエージェント経由（詳細な分析）

```
Task tool:
- subagent_type: "general-purpose"
- prompt: |
    Consult Codex about: {topic}
    codex exec --model o4-mini --sandbox read-only --full-auto "{question}" 2>/dev/null
    Return CONCISE summary.
```

## いつ使わないか

- 単純なファイル編集
- keyword.json の読み込みや整形
- バリデーションスクリプトの実行
- Git 操作

## 言語プロトコル

1. Codex には **英語** で質問
2. 回答は **英語** で受け取り
3. ユーザーには **日本語** で報告
