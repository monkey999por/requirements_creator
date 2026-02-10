#!/usr/bin/env python3
"""
UserPromptSubmit hook: Route to appropriate agent based on user intent.

Analyzes user prompts and suggests the most appropriate agent
(Codex for design/review, Gemini for research/trends).
Optimized for the requirements_creator project.
"""

import json
import sys

# Triggers for Codex (design, review, deep reasoning)
CODEX_TRIGGERS = {
    "ja": [
        "設計", "どう設計", "アーキテクチャ",
        "レビュー", "確認して", "チェック",
        "どちらがいい", "比較して", "トレードオフ",
        "コンセプト", "アプリ案",
        "実現可能", "フィージビリティ",
        "考えて", "分析して",
    ],
    "en": [
        "design", "architecture", "concept",
        "review", "check", "evaluate",
        "compare", "trade-off", "tradeoff",
        "feasible", "feasibility",
        "think", "analyze",
    ],
}

# Triggers for Gemini (research, trends, external information)
GEMINI_TRIGGERS = {
    "ja": [
        "調べて", "リサーチ", "調査",
        "トレンド", "市場", "動向",
        "最新", "ドキュメント",
        "競合", "既存サービス",
        "技術スタック",
    ],
    "en": [
        "research", "investigate", "look up",
        "trend", "market", "landscape",
        "latest", "documentation",
        "competitor", "existing",
        "tech stack",
    ],
}


def detect_agent(prompt: str) -> tuple[str | None, str]:
    """Detect which agent should handle this prompt."""
    prompt_lower = prompt.lower()

    for triggers in CODEX_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "codex", trigger

    for triggers in GEMINI_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "gemini", trigger

    return None, ""


def main():
    try:
        data = json.load(sys.stdin)
        prompt = data.get("prompt", "")

        if len(prompt) < 10:
            sys.exit(0)

        agent, trigger = detect_agent(prompt)

        if agent == "codex":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Agent Routing] Detected '{trigger}' - this task may benefit from "
                        "Codex CLI's deep reasoning. Consider: "
                        '`codex exec --model o4-mini --sandbox read-only --full-auto '
                        '"{task}"` for design decisions or requirements review.'
                    ),
                }
            }
            print(json.dumps(output))

        elif agent == "gemini":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Agent Routing] Detected '{trigger}' - this task may benefit from "
                        "Gemini CLI's research capabilities. Consider: "
                        '`gemini -p "Research: {topic}" 2>/dev/null` '
                        "for trend analysis or market research."
                    ),
                }
            }
            print(json.dumps(output))

        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
