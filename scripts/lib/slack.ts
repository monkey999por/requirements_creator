import { loadAppConfig } from "./config.js";
import "dotenv/config";

const SLACK_API_URL = "https://slack.com/api/chat.postMessage";
const SLACK_CHANNEL = "#requirements_notify";

export interface SlackNotificationResult {
  success: boolean;
  error?: string;
}

function getToken(): string | undefined {
  const config = loadAppConfig();
  const slackConfig = config.notifications?.slack;
  if (!slackConfig?.enabled) return undefined;
  const envKey = slackConfig.token_env ?? "SLACK_BOT_USER_OAUTH_TOKEN";
  return process.env[envKey];
}

async function postToSlack(token: string, text: string): Promise<SlackNotificationResult> {
  try {
    const params = new URLSearchParams();
    params.append("token", token);
    params.append("channel", SLACK_CHANNEL);
    params.append("text", text);

    const res = await fetch(SLACK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      return { success: false, error: `Slack API error: ${data.error}` };
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
  const token = getToken();
  if (!token) return { success: false, error: "Slack通知が無効または未設定です" };

  const hasFailed = steps.some((s) => s.status === "failed");
  const emoji = hasFailed ? ":warning:" : ":white_check_mark:";
  const statusText = hasFailed ? "一部失敗" : "完了";
  const modeLabel = opts?.mode ? ` (${opts.mode})` : "";

  const stepLines = steps
    .map((s) => {
      const icon =
        s.status === "success" ? ":ok:" : s.status === "failed" ? ":x:" : ":fast_forward:";
      return `  ${icon} ${s.name}`;
    })
    .join("\n");

  const lines: string[] = [`${emoji} *パイプライン${statusText}${modeLabel}*`, "", stepLines];

  if (opts?.articleCount !== undefined) {
    lines.push("", `記事数: ${opts.articleCount}`);
  }
  if (opts?.keywordCount !== undefined) {
    lines.push(`キーワード数: ${opts.keywordCount}`);
  }
  if (opts?.newApps && opts.newApps.length > 0) {
    lines.push(`生成アプリ: ${opts.newApps.join(", ")}`);
  }

  return postToSlack(token, lines.join("\n"));
}

export async function notifyGenerateResult(newApps?: string[]): Promise<SlackNotificationResult> {
  const token = getToken();
  if (!token) return { success: false, error: "Slack通知が無効または未設定です" };

  const appList = newApps && newApps.length > 0 ? newApps.join(", ") : "（新規アプリなし）";
  const text = `:white_check_mark: *要件生成完了*\n生成アプリ: ${appList}`;

  return postToSlack(token, text);
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
