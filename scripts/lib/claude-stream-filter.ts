/**
 * Claude CLI stream-json output filter
 *
 * Reads JSONL from stdin (claude -p --output-format stream-json)
 * and outputs formatted progress to stderr.
 *
 * Usage:
 *   claude -p "..." --output-format stream-json | tsx scripts/lib/claude-stream-filter.ts
 */
import { createInterface } from "node:readline";

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  message?: {
    content?: ContentBlock[];
  };
  cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  try {
    const event: StreamEvent = JSON.parse(line);

    switch (event.type) {
      case "assistant": {
        const content = event.message?.content;
        if (!Array.isArray(content)) break;
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            const info = formatToolInput(block.name, block.input);
            const suffix = info ? ` ${info}` : "";
            process.stderr.write(`  [${block.name}]${suffix}\n`);
          }
        }
        break;
      }
      case "result": {
        const parts: string[] = [];
        if (event.cost_usd !== undefined) {
          parts.push(`cost: $${Number(event.cost_usd).toFixed(4)}`);
        }
        if (event.duration_ms !== undefined) {
          const sec = (event.duration_ms / 1000).toFixed(1);
          parts.push(`${sec}s`);
        }
        if (event.num_turns !== undefined) {
          parts.push(`${event.num_turns} turns`);
        }
        const summary = parts.length > 0 ? ` (${parts.join(", ")})` : "";
        process.stderr.write(`  [完了]${summary}\n`);
        break;
      }
    }
  } catch {
    // Ignore unparseable lines
  }
});
