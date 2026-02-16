import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadAppConfig } from "./lib/config.js";
import type { LogEntry } from "./lib/logger.js";
import { LOGS_DIR, listLogFiles, readLogEntries } from "./lib/logger.js";
import { formatError } from "./lib/utils.js";
const SKILL_FILE = ".claude/skills/self-healing/SKILL.md";

// --- 型定義 ---
interface AnalysisResult {
  hasIssues: boolean;
  configMismatches: ConfigMismatch[];
  failedSteps: FailedStep[];
}

interface ConfigMismatch {
  setting: string;
  expected: string;
  actual: string;
  logFile: string;
}

interface FailedStep {
  step: string;
  error: string;
  logFile: string;
}

// --- 引数パース ---
interface SelfHealingOptions {
  dryRun: boolean;
}

function parseArgs(argv: string[]): SelfHealingOptions {
  const opts: SelfHealingOptions = { dryRun: false };
  for (const arg of argv) {
    switch (arg) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`不明なオプション: ${arg}`);
        process.exit(1);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: pnpm self-healing [options]

ログを解析し、コマンドの自己修復を行います。

Options:
  --dry-run    解析のみ実行し、修復は行わない
  -h, --help   ヘルプ表示`);
}

// --- ログ解析 ---
function analyzeLog(logFile: string, config: ReturnType<typeof loadAppConfig>): AnalysisResult {
  const entries = readLogEntries(logFile);
  const result: AnalysisResult = {
    hasIssues: false,
    configMismatches: [],
    failedSteps: [],
  };

  // 失敗ステップの検出
  for (const entry of entries) {
    if (entry.level === "error") {
      // ステップ完了の失敗を検出
      const summaryData = entry.data?.summary as { status?: string; error?: string } | undefined;
      if (summaryData?.status === "failed") {
        result.failedSteps.push({
          step: entry.step,
          error: summaryData.error ?? entry.message,
          logFile,
        });
        result.hasIssues = true;
      } else if (entry.message.includes("失敗") || entry.message.includes("エラー")) {
        result.failedSteps.push({
          step: entry.step,
          error: entry.message,
          logFile,
        });
        result.hasIssues = true;
      }
    }
  }

  // 設定との整合性チェック
  checkConfigConsistency(entries, config, logFile, result);

  return result;
}

function checkConfigConsistency(
  entries: LogEntry[],
  config: ReturnType<typeof loadAppConfig>,
  logFile: string,
  result: AnalysisResult,
): void {
  // collectの設定チェック: 有効ソースが正しく使われているか
  const configEntries = entries.filter((e) => e.message === "設定情報" && e.step === "collect");
  for (const entry of configEntries) {
    const logConfig = entry.data?.config as
      | {
          enabledSources?: Array<{ name: string }>;
        }
      | undefined;

    if (logConfig?.enabledSources) {
      const loggedSources = new Set(logConfig.enabledSources.map((s) => s.name));
      const configSources = Object.entries(config.collect.sources)
        .filter(([, src]) => src.enabled)
        .map(([name]) => name);

      for (const source of configSources) {
        if (!loggedSources.has(source)) {
          result.configMismatches.push({
            setting: `collect.sources.${source}`,
            expected: "enabled",
            actual: "ログに記録なし",
            logFile,
          });
          result.hasIssues = true;
        }
      }
    }
  }
}

// --- 自己修復実行 ---
function runSelfHealing(analysis: AnalysisResult): void {
  if (!analysis.hasIssues) {
    console.log("問題は検出されませんでした。修復は不要です。");
    return;
  }

  // 日時でブランチ名を生成（同日複数回実行に対応）
  const now = new Date();
  const today = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "");
  const branchName = `bugfix/${today}-${timeStr}-self-healing`;

  console.log(`\n修復ブランチを作成: ${branchName}`);

  // 現在のブランチを記録
  const currentBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();

  try {
    // developから新ブランチを作成
    execSync(`git checkout -b ${branchName} develop`, { stdio: "inherit" });

    // Claude Codeスキルを使って修復を実行
    const issuesSummary = buildIssuesSummary(analysis);

    console.log("\n=== Claude Codeで自己修復を実行 ===\n");

    // スキルファイルの本文を取得
    let skillPrompt = "";
    if (existsSync(SKILL_FILE)) {
      const skillContent = readFileSync(SKILL_FILE, "utf-8");
      // フロントマターを除去
      const parts = skillContent.split("---");
      if (parts.length >= 3) {
        skillPrompt = parts.slice(2).join("---").trim();
      }
    }

    const prompt = `以下のログ解析結果に基づいて、コマンドの自己修復を行ってください。

${issuesSummary}

修復後、変更されたファイルをgit addしてコミットしてください。
コミットメッセージ形式: fix: 自己修復 - <修正内容の要約>`;

    const result = spawnSync(
      "claude",
      [
        "-p",
        prompt,
        ...(skillPrompt ? ["--append-system-prompt", skillPrompt] : []),
        "--allowedTools",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "Bash(git:*)",
        "Bash(tsx:*)",
        "Bash(pnpm:*)",
        "--dangerously-skip-permissions",
      ],
      { stdio: "inherit", timeout: 600_000 },
    );

    if (result.status !== 0) {
      console.error("自己修復のClaude Code実行に失敗しました。");
      // 元のブランチに戻る
      execSync(`git checkout ${currentBranch}`, { stdio: "inherit" });
      return;
    }

    // 変更があるかチェック
    const diffResult = execSync("git diff --cached --name-only", { encoding: "utf-8" }).trim();
    const untrackedDiff = execSync("git diff --name-only", { encoding: "utf-8" }).trim();

    if (!diffResult && !untrackedDiff) {
      console.log("\n修復による変更はありませんでした。");
      execSync(`git checkout ${currentBranch}`, { stdio: "inherit" });
      execSync(`git branch -d ${branchName}`, { stdio: "inherit" });
      return;
    }

    // PRを作成
    console.log("\n=== PR作成 ===\n");
    try {
      execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });

      const prBody = [
        "## Summary",
        "",
        "自己修復機能によるバグ修正。",
        "",
        "### 検出された問題",
        "",
        issuesSummary,
        "",
        "### 修復内容",
        "",
        "ログ解析に基づく自動修復。",
        "",
        "## Test plan",
        "",
        "- [ ] 修正されたコマンドが正常に動作すること",
        "- [ ] パイプライン全体が正常に完了すること",
      ].join("\n");

      spawnSync(
        "gh",
        [
          "pr",
          "create",
          "--title",
          `fix: 自己修復 (${today})`,
          "--body",
          prBody,
          "--base",
          "develop",
        ],
        { stdio: "inherit" },
      );
    } catch (err) {
      console.error(`PR作成エラー: ${formatError(err)}`);
    }

    // 元のブランチに戻る
    execSync(`git checkout ${currentBranch}`, { stdio: "inherit" });
  } catch (err) {
    console.error(`自己修復エラー: ${formatError(err)}`);
    // エラー時は元のブランチに戻る
    try {
      execSync(`git checkout ${currentBranch}`, { stdio: "inherit" });
    } catch {
      // 無視
    }
  }
}

function buildIssuesSummary(analysis: AnalysisResult): string {
  const sections: string[] = [];

  if (analysis.failedSteps.length > 0) {
    sections.push("## 失敗したステップ\n");
    for (const step of analysis.failedSteps) {
      sections.push(`- **${step.step}**: ${step.error}`);
      sections.push(`  ログファイル: ${step.logFile}`);
    }
  }

  if (analysis.configMismatches.length > 0) {
    sections.push("\n## 設定との不整合\n");
    for (const mismatch of analysis.configMismatches) {
      sections.push(
        `- **${mismatch.setting}**: 期待値=${mismatch.expected}, 実際=${mismatch.actual}`,
      );
    }
  }

  return sections.join("\n");
}

// --- ログクリア ---
function clearAllLogs(): void {
  if (existsSync(LOGS_DIR)) {
    rmSync(LOGS_DIR, { recursive: true, force: true });
    console.log("ログディレクトリを削除しました。");
  }
}

// --- メイン ---
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log("=== 自己修復チェック ===\n");

  // ログファイル一覧を取得
  const logFiles = listLogFiles();
  if (logFiles.length === 0) {
    console.log("ログファイルがありません。チェック対象がありません。");
    return;
  }

  console.log(`ログファイル数: ${logFiles.length}\n`);

  // app.config.yaml を読み込み
  const config = loadAppConfig();

  // 全ログファイルを解析
  const allAnalysis: AnalysisResult = {
    hasIssues: false,
    configMismatches: [],
    failedSteps: [],
  };

  for (const logFile of logFiles) {
    const logPath = join(LOGS_DIR, logFile);
    console.log(`解析中: ${logFile}`);
    const analysis = analyzeLog(logPath, config);

    if (analysis.hasIssues) {
      allAnalysis.hasIssues = true;
      allAnalysis.configMismatches.push(...analysis.configMismatches);
      allAnalysis.failedSteps.push(...analysis.failedSteps);
    }
  }

  // 結果表示
  console.log("\n--- 解析結果 ---");
  if (!allAnalysis.hasIssues) {
    console.log("問題は検出されませんでした。");
  } else {
    console.log(`失敗ステップ: ${allAnalysis.failedSteps.length}件`);
    console.log(`設定不整合: ${allAnalysis.configMismatches.length}件`);

    for (const step of allAnalysis.failedSteps) {
      console.log(`  [失敗] ${step.step}: ${step.error}`);
    }
    for (const mismatch of allAnalysis.configMismatches) {
      console.log(`  [不整合] ${mismatch.setting}: ${mismatch.expected} != ${mismatch.actual}`);
    }
  }

  if (opts.dryRun) {
    console.log("\n(dry-run: 修復は実行しません)");
    return;
  }

  // 自己修復を実行し、修復後にログをクリア
  if (allAnalysis.hasIssues) {
    runSelfHealing(allAnalysis);
    clearAllLogs();
  } else {
    console.log("\n問題なし。ログは次回チェック用に保持します。");
  }
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
