import { loadAppConfig } from "./config.js";
import "dotenv/config";

export interface SlackNotificationResult {
  success: boolean;
  error?: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: { type: string; text: string }[];
  fields?: { type: string; text: string }[];
}

function getWebhookUrl(): string | undefined {
  const config = loadAppConfig();
  const slackConfig = config.notifications?.slack;
  if (!slackConfig?.enabled) return undefined;
  const envKey = slackConfig.webhook_url_env ?? "SLACK_WEBHOOK_URL";
  return process.env[envKey];
}

async function postToSlack(
  webhookUrl: string,
  blocks: SlackBlock[],
  text: string,
): Promise<SlackNotificationResult> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Slack API error: ${res.status} ${body}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Slack送信失敗: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export interface PipelineStepResult {
  name: string;
  status: "success" | "skipped" | "failed";
}

export async function notifyPipelineResult(
  steps: PipelineStepResult[],
  opts?: {
    newApps?: string[];
    articleCount?: number;
    keywordCount?: number;
    mode?: string;
  },
): Promise<SlackNotificationResult> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return { success: false, error: "Slack通知が無効または未設定です" };

  const hasFailed = steps.some((s) => s.status === "failed");
  const emoji = hasFailed ? ":warning:" : ":white_check_mark:";
  const statusText = hasFailed ? "一部失敗" : "完了";
  const modeLabel = opts?.mode ? ` (${opts.mode})` : "";

  const stepLines = steps
    .map((s) => {
      const icon =
        s.status === "success" ? ":ok:" : s.status === "failed" ? ":x:" : ":fast_forward:";
      return `${icon} ${s.name}`;
    })
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} パイプライン${statusText}${modeLabel}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*ステップ結果:*\n${stepLines}` },
    },
  ];

  const details: string[] = [];
  if (opts?.articleCount !== undefined) {
    details.push(`記事数: ${opts.articleCount}`);
  }
  if (opts?.keywordCount !== undefined) {
    details.push(`キーワード数: ${opts.keywordCount}`);
  }
  if (opts?.newApps && opts.newApps.length > 0) {
    details.push(`生成アプリ: ${opts.newApps.join(", ")}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: "section",
      fields: details.map((d) => ({ type: "mrkdwn", text: d })),
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `_${new Date().toLocaleString("ja-JP")}_ | requirements_creator` },
    ],
  });

  const fallbackText = `パイプライン${statusText}${modeLabel}`;
  return postToSlack(webhookUrl, blocks, fallbackText);
}

export async function notifyGenerateResult(newApps?: string[]): Promise<SlackNotificationResult> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return { success: false, error: "Slack通知が無効または未設定です" };

  const appList = newApps && newApps.length > 0 ? newApps.join(", ") : "（新規アプリなし）";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: ":white_check_mark: 要件生成完了" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*生成アプリ:* ${appList}` },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `_${new Date().toLocaleString("ja-JP")}_ | requirements_creator` },
      ],
    },
  ];

  return postToSlack(webhookUrl, blocks, `要件生成完了: ${appList}`);
}

// CLI用エントリーポイント: generate.sh から呼び出し
// 使用法: tsx scripts/lib/slack.ts generate [app1] [app2] ...
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "generate") {
    const apps = args.slice(1);
    const result = await notifyGenerateResult(apps.length > 0 ? apps : undefined);
    if (!result.success && result.error !== "Slack通知が無効または未設定です") {
      console.error(result.error);
    }
  }
}

if (process.argv[1]?.endsWith("slack.ts")) {
  main();
}
