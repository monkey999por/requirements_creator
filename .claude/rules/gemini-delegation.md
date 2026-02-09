# Gemini Delegation Rule

**Gemini CLI は外部情報のリサーチ・分析スペシャリスト。**

## このプロジェクトでの役割

| 役割 | フェーズ | 用途 |
|------|---------|------|
| **researcher** | Phase 1 | keyword.json からトレンド・技術の外部調査 |

## いつ使うか

### generate パイプライン内（自動）

`app.config.yaml` の `generate.agents.gemini` が `enabled: true` かつ `researcher` role が設定されている場合、`generate.sh` が自動的に呼び出す。

### 対話的に使う場合

以下のような場面で Gemini に調査依頼:

1. **トレンド調査** — 「このキーワードに関する最新の市場動向は？」
2. **技術リサーチ** — 「このフレームワークの最新ベストプラクティスは？」
3. **競合分析** — 「この分野の既存サービスは？」

## 呼び出しパターン

### 直接呼び出し（短い質問）

```bash
gemini -p "Brief research question" 2>/dev/null
```

### サブエージェント経由（詳細な調査）

```
Task tool:
- subagent_type: "general-purpose"
- prompt: |
    Research: {topic}
    gemini -p "{question}" 2>/dev/null
    Return CONCISE summary (5-7 bullet points).
```

## いつ使わないか

- **コードベース分析** — Claude が 1M コンテキストで直接読む
- 設計判断 — Codex の領域
- ファイル編集 — Claude Code の領域
- バリデーション — スクリプトの領域

## 言語プロトコル

1. Gemini には **英語** で質問
2. 回答は **英語** で受け取り
3. ユーザーには **日本語** で報告
