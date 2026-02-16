import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";

// --- 型定義 ---
export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  step: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

export interface StepSummary {
  step: string;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}

// --- 定数 ---
const LOGS_DIR = resolve("logs");

// --- ユーティリティ ---
function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("_");
}

function isoNow(): string {
  return new Date().toISOString();
}

// --- PipelineLogger ---
export class PipelineLogger {
  private logFile: string;
  private stepTimers: Map<string, number> = new Map();

  /**
   * @param logFileOrDir - 既存のログファイルパス（.jsonl）またはログディレクトリ。
   *                       .jsonlで終わる場合はそのファイルに追記。それ以外はディレクトリとして新規ファイルを作成。
   */
  constructor(logFileOrDir?: string) {
    if (logFileOrDir?.endsWith(".jsonl")) {
      this.logFile = logFileOrDir;
    } else {
      const dir = logFileOrDir ?? LOGS_DIR;
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.logFile = join(dir, `${formatTimestamp()}.jsonl`);
    }
  }

  get filePath(): string {
    return this.logFile;
  }

  /** ログエントリを書き込み */
  log(level: LogLevel, step: string, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: isoNow(),
      level,
      step,
      message,
    };
    if (data) entry.data = data;
    appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`);
  }

  info(step: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", step, message, data);
  }

  warn(step: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", step, message, data);
  }

  error(step: string, message: string, data?: Record<string, unknown>): void {
    this.log("error", step, message, data);
  }

  /** ステップの計測開始 */
  startStep(step: string): void {
    this.stepTimers.set(step, Date.now());
    this.info(step, `${step} 開始`);
  }

  /** ステップの計測終了とサマリー書き込み */
  endStep(step: string, status: "success" | "failed" | "skipped", error?: string): StepSummary {
    const startTime = this.stepTimers.get(step);
    const durationMs = startTime ? Date.now() - startTime : 0;
    this.stepTimers.delete(step);

    const summary: StepSummary = { step, status, durationMs };
    if (error) summary.error = error;

    this.log(status === "failed" ? "error" : "info", step, `${step} 完了: ${status}`, {
      summary,
    });

    return summary;
  }

  /** コマンド実行をログ */
  logCommand(step: string, command: string, args: string[]): void {
    this.info(step, `コマンド実行: ${command} ${args.join(" ")}`, { command, args });
  }

  /** 設定情報をログ */
  logConfig(step: string, config: Record<string, unknown>): void {
    this.info(step, "設定情報", { config });
  }
}

// --- ログディレクトリのクリア ---
export function clearLogs(logDir?: string): void {
  const dir = logDir ?? LOGS_DIR;
  if (!existsSync(dir)) return;

  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  for (const file of files) {
    unlinkSync(join(dir, file));
  }
}

// --- ログファイル一覧 ---
export function listLogFiles(logDir?: string): string[] {
  const dir = logDir ?? LOGS_DIR;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse();
}

// --- ログファイルの読み込み ---
export function readLogEntries(logFilePath: string): LogEntry[] {
  if (!existsSync(logFilePath)) return [];
  const content = readFileSync(logFilePath, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line) as LogEntry);
}
