import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadAppConfig } from "./lib/config.js";
import {
  getLatestDataSource,
  loadAllTexts,
  loadJson,
  selectDataSource,
} from "./lib/data-source.js";
import { PipelineLogger } from "./lib/logger.js";
import { DATA_SOURCE_DIR, DATASETS_DIR, REQUIREMENTS_DIR } from "./lib/paths.js";
import { notifyPipelineResult, type PipelineStepResult } from "./lib/slack.js";
import { formatError } from "./lib/utils.js";

// --- 型定義 ---
interface PipelineOptions {
  skipCollect: boolean;
  skipExtract: boolean;
  direct: boolean;
  source?: string;
  dataset?: string;
  regenerate?: string;
  memo?: string;
}

type StepStatus = "success" | "skipped" | "failed";

interface StepResult {
  name: string;
  status: StepStatus;
}

interface DatasetItem {
  appName: string;
  type: "overview" | "feature";
  featureId?: string;
  title?: string;
}

interface Dataset {
  name: string;
  createdAt: string;
  items: DatasetItem[];
}

// --- 引数パース ---
function parseArgs(argv: string[]): PipelineOptions {
  const opts: PipelineOptions = { skipCollect: false, skipExtract: false, direct: false };
  let i = 0;
  while (i < argv.length) {
    switch (argv[i]) {
      case "--skip-collect":
        opts.skipCollect = true;
        i++;
        break;
      case "--skip-extract":
        opts.skipExtract = true;
        i++;
        break;
      case "--direct":
        opts.direct = true;
        opts.skipExtract = true;
        i++;
        break;
      case "--source":
        opts.source = argv[i + 1];
        if (!opts.source) {
          console.error("エラー: --source にはディレクトリ名を指定してください。");
          process.exit(1);
        }
        i += 2;
        break;
      case "--dataset":
        opts.dataset = argv[i + 1];
        if (!opts.dataset) {
          console.error("エラー: --dataset にはデータセット名を指定してください。");
          process.exit(1);
        }
        i += 2;
        break;
      case "--regenerate":
        opts.regenerate = argv[i + 1];
        if (!opts.regenerate) {
          console.error("エラー: --regenerate にはアプリ名を指定してください。");
          process.exit(1);
        }
        i += 2;
        break;
      case "--memo":
        opts.memo = argv[i + 1];
        if (!opts.memo) {
          console.error("エラー: --memo にはテキストを指定してください。");
          process.exit(1);
        }
        i += 2;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`不明なオプション: ${argv[i]}`);
        process.exit(1);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: pnpm pipeline [options]

データ収集 → キーワード抽出 → 要件生成 を一括実行します。

Options:
  --skip-collect        既存データを使いキーワード抽出から開始
  --skip-extract        既存キーワードを使い要件生成のみ実行
  --direct              キーワード抽出をスキップし、テキストデータから直接要件生成
  --source <dir>        使用する data_source サブディレクトリを指定
  --dataset <name>      データセットをソースとして要件生成（collect/extractスキップ）
  --regenerate <app>    既存アプリ要件をmemo.mdベースで再生成
  --memo "text"         再生成時にmemo.mdに書き込むテキスト（--regenerateと併用）
  -h, --help            ヘルプ表示`);
}

// --- 子プロセス管理 ---
let activeChild: ChildProcess | null = null;

function cleanup() {
  if (activeChild?.pid) {
    console.log("\n中断シグナルを受信しました。子プロセスを終了しています...");
    try {
      // detached: true で独自プロセスグループを持つため、-pid でグループ全体を終了
      process.kill(-activeChild.pid, "SIGTERM");
    } catch {
      // プロセスが既に終了している場合は無視
    }
    activeChild = null;
  }
  process.exit(130);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// --- 子プロセス実行ヘルパー ---
let pipelineLogFile: string | undefined;

function runStep(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const env: Record<string, string | undefined> = { ...process.env, PIPELINE_MODE: "1" };
    if (pipelineLogFile) {
      env.PIPELINE_LOG_FILE = pipelineLogFile;
    }
    const child = spawn(cmd, args, { stdio: "inherit", detached: true, env });
    activeChild = child;
    child.on("error", (err) => {
      activeChild = null;
      reject(new Error(`コマンド起動失敗: ${err.message}`));
    });
    child.on("close", (code) => {
      activeChild = null;
      if (code !== 0) {
        reject(new Error(`コマンドが終了コード ${code} で失敗しました`));
      } else {
        resolve();
      }
    });
  });
}

// --- requirements/ のアプリ一覧を取得 ---
function listRequirementApps(): string[] {
  if (!existsSync(REQUIREMENTS_DIR)) return [];
  return readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

// --- バリデーション実行ヘルパー ---
async function runValidation(
  newApps: string[],
  results: StepResult[],
  prefix = "[validate]",
): Promise<void> {
  if (newApps.length > 0) {
    console.log(`${prefix} ${newApps.join(", ")} を検証...\n`);
    try {
      for (const app of newApps) {
        await runStep("tsx", ["scripts/validate-requirements.ts", app]);
      }
      console.log("");
      results.push({ name: "validate", status: "success" });
    } catch (err) {
      console.error(`\nvalidate 失敗: ${formatError(err)}`);
      results.push({ name: "validate", status: "failed" });
    }
  } else {
    console.log(`${prefix} 新規アプリが検出されませんでした（スキップ）\n`);
    results.push({ name: "validate", status: "skipped" });
  }
}

// --- データセットからソースファイルを生成 ---
function buildDatasetSource(datasetName: string): string {
  const datasetPath = join(DATASETS_DIR, `${datasetName}.json`);
  if (!existsSync(datasetPath)) {
    console.error(`エラー: データセット ${datasetName} が見つかりません。`);
    process.exit(1);
  }

  const dataset = JSON.parse(readFileSync(datasetPath, "utf-8")) as Dataset;
  if (dataset.items.length === 0) {
    console.error("エラー: データセットにアイテムがありません。");
    process.exit(1);
  }

  const sections: string[] = [];
  sections.push(`# データセットソース: ${dataset.name}\n`);
  sections.push("以下は複数のアプリ要件から選択されたOverviewとFeatureの組み合わせです。");
  sections.push("これらをインスピレーションとして、新しいアプリ要件を生成してください。\n");

  for (const item of dataset.items) {
    if (item.type === "overview") {
      const filePath = join(REQUIREMENTS_DIR, item.appName, "overview.md");
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        sections.push(`---\n## ${item.appName} - Overview\n\n${content}\n`);
      }
    } else if (item.type === "feature" && item.featureId) {
      const filePath = join(REQUIREMENTS_DIR, item.appName, "features", `${item.featureId}.md`);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        sections.push(
          `---\n## ${item.appName} - Feature: ${item.title ?? item.featureId}\n\n${content}\n`,
        );
      }
    }
  }

  return sections.join("\n");
}

// --- メイン ---
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results: StepResult[] = [];

  // ロガー初期化
  const logger = new PipelineLogger();
  pipelineLogFile = logger.filePath;
  logger.info("pipeline", "パイプライン開始", {
    options: {
      skipCollect: opts.skipCollect,
      skipExtract: opts.skipExtract,
      direct: opts.direct,
      source: opts.source,
      dataset: opts.dataset,
      regenerate: opts.regenerate,
    },
  });

  // 再生成モード
  if (opts.regenerate) {
    const appName = opts.regenerate;
    const appDir = join(REQUIREMENTS_DIR, appName);

    if (!existsSync(appDir)) {
      console.error(`エラー: ${appDir} が見つかりません。`);
      process.exit(1);
    }

    console.log(`=== パイプライン（再生成モード）===\n`);
    console.log(`対象アプリ: ${appName}\n`);

    results.push({ name: "collect", status: "skipped" });
    results.push({ name: "extract", status: "skipped" });

    // regenerate
    console.log("[regenerate] 要件再生成を開始...\n");
    try {
      const args = ["scripts/regenerate.sh", appName];
      if (opts.memo) {
        args.push("--memo", opts.memo);
      }
      await runStep("bash", args);
      console.log("");
      results.push({ name: "regenerate", status: "success" });
    } catch (err) {
      console.error(`\nregenerate 失敗: ${formatError(err)}`);
      results.push({ name: "regenerate", status: "failed" });
      await printSummary(results, undefined, undefined, "再生成", logger);
      process.exit(1);
    }

    // validate
    console.log(`[validate] ${appName} を検証...\n`);
    try {
      await runStep("tsx", ["scripts/validate-requirements.ts", appName]);
      console.log("");
      results.push({ name: "validate", status: "success" });
    } catch (err) {
      console.error(`\nvalidate 失敗: ${formatError(err)}`);
      results.push({ name: "validate", status: "failed" });
    }

    await printSummary(results, undefined, [appName], "再生成", logger);
    return;
  }

  // データセットモード
  if (opts.dataset) {
    console.log(`=== パイプライン（データセットモード）===\n`);
    console.log(`データセット: ${opts.dataset}\n`);

    results.push({ name: "collect", status: "skipped" });
    results.push({ name: "extract", status: "skipped" });

    // データセットソースファイルを生成
    const sourceContent = buildDatasetSource(opts.dataset);
    const sourcePath = resolve(DATASETS_DIR, `${opts.dataset}_source.md`);
    writeFileSync(sourcePath, sourceContent, "utf-8");
    console.log(`データセットソースファイル: ${sourcePath}\n`);

    // generate
    const appsBefore = new Set(listRequirementApps());
    console.log("[generate] データセットから要件生成を開始...\n");
    try {
      await runStep("bash", [
        "scripts/generate.sh",
        "--dataset-source",
        sourcePath,
        "--dataset-name",
        opts.dataset,
      ]);
      console.log("");
      results.push({ name: "generate", status: "success" });
    } catch (err) {
      console.error(`\ngenerate 失敗: ${formatError(err)}`);
      results.push({ name: "generate", status: "failed" });
      await printSummary(results, undefined, undefined, "データセット", logger);
      process.exit(1);
    }

    // validate
    const appsAfter = listRequirementApps();
    const newApps = appsAfter.filter((app) => !appsBefore.has(app));
    await runValidation(newApps, results);

    await printSummary(results, undefined, newApps, "データセット", logger);
    return;
  }

  // 通常モード
  console.log("=== パイプライン一括実行 ===\n");

  // Step 1: collect
  if (opts.skipCollect) {
    console.log("[Step 1] collect: スキップ\n");
    results.push({ name: "collect", status: "skipped" });
    logger.info("collect", "collect スキップ");
  } else {
    console.log("[Step 1] collect: データ収集を開始...\n");
    logger.startStep("collect");
    logger.logCommand("collect", "tsx", ["scripts/collect.ts"]);
    try {
      await runStep("tsx", ["scripts/collect.ts"]);
      console.log("");
      results.push({ name: "collect", status: "success" });
      logger.endStep("collect", "success");
    } catch (err) {
      console.error(`\ncollect 失敗: ${formatError(err)}`);
      results.push({ name: "collect", status: "failed" });
      logger.endStep("collect", "failed", formatError(err));
      await printSummary(results, undefined, undefined, undefined, logger);
      process.exit(1);
    }
  }

  // 対象ディレクトリ決定
  // 優先順位: 1. --source オプション → 2. app.config.yaml の pipeline.default_source → 3. 最新自動検出
  let targetDir: string;
  if (opts.source) {
    targetDir = opts.source;
    const fullPath = resolve(DATA_SOURCE_DIR, targetDir);
    if (!existsSync(fullPath)) {
      console.error(`エラー: ${DATA_SOURCE_DIR}/${targetDir} が存在しません。`);
      process.exit(1);
    }
  } else {
    const config = loadAppConfig();
    const configSource = config.pipeline?.default_source;
    if (configSource) {
      const fullPath = resolve(DATA_SOURCE_DIR, configSource);
      if (!existsSync(fullPath)) {
        console.error(
          `エラー: 設定ファイルの pipeline.default_source で指定された ${DATA_SOURCE_DIR}/${configSource} が存在しません。`,
        );
        process.exit(1);
      }
      targetDir = configSource;
    } else if (opts.skipCollect) {
      // collectスキップ時のみ対話選択（collectを実行した場合は最新を自動使用）
      const selected = await selectDataSource();
      if (!selected) {
        console.error(
          `エラー: ${DATA_SOURCE_DIR}/ にデータがありません。先に pnpm collect を実行してください。`,
        );
        process.exit(1);
      }
      targetDir = selected;
    } else {
      const latest = getLatestDataSource();
      if (!latest) {
        console.error(
          `エラー: ${DATA_SOURCE_DIR}/ にデータがありません。先に pnpm collect を実行してください。`,
        );
        process.exit(1);
      }
      targetDir = latest;
    }
  }
  console.log(`対象ディレクトリ: ${DATA_SOURCE_DIR}/${targetDir}\n`);

  // Step 2: extract
  if (opts.direct) {
    console.log("[Step 2] extract: スキップ（ダイレクトモード）\n");
    results.push({ name: "extract", status: "skipped" });
    logger.info("extract", "extract スキップ（ダイレクトモード）");
  } else if (opts.skipExtract) {
    console.log("[Step 2] extract: スキップ\n");
    const keywordPath = resolve(DATA_SOURCE_DIR, targetDir, "keyword.json");
    if (!existsSync(keywordPath)) {
      console.error(
        `エラー: ${keywordPath} が存在しません。--skip-extract を外して実行してください。`,
      );
      process.exit(1);
    }
    results.push({ name: "extract", status: "skipped" });
    logger.info("extract", "extract スキップ");
  } else {
    console.log("[Step 2] extract: キーワード抽出を開始...\n");
    logger.startStep("extract");
    const maxRetries = 2;
    let extractSuccess = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`\n[extract] リトライ ${attempt}/${maxRetries}...\n`);
          logger.warn("extract", `リトライ ${attempt}/${maxRetries}`);
        }
        logger.logCommand("extract", "bash", ["scripts/extract.sh", "--target", targetDir]);
        await runStep("bash", ["scripts/extract.sh", "--target", targetDir]);
        console.log("");
        const keywordPath = resolve(DATA_SOURCE_DIR, targetDir, "keyword.json");
        if (!existsSync(keywordPath)) {
          throw new Error("keyword.json が生成されませんでした");
        }
        extractSuccess = true;
        break;
      } catch (err) {
        console.error(`\nextract 試行 ${attempt} 失敗: ${formatError(err)}`);
        logger.error("extract", `試行 ${attempt} 失敗: ${formatError(err)}`);
        if (attempt === maxRetries) {
          results.push({ name: "extract", status: "failed" });
          logger.endStep("extract", "failed", formatError(err));
          await printSummary(results, undefined, undefined, undefined, logger);
          process.exit(1);
        }
      }
    }
    if (extractSuccess) {
      results.push({ name: "extract", status: "success" });
      logger.endStep("extract", "success");
    }
  }

  // Step 3: generate
  const appsBefore = new Set(listRequirementApps());
  const generateLabel = opts.direct ? "要件生成（ダイレクトモード）" : "要件生成";
  console.log(`[Step 3] generate: ${generateLabel}を開始...\n`);
  logger.startStep("generate");
  try {
    const generateArgs = ["scripts/generate.sh", "--target", targetDir];
    if (opts.direct) {
      generateArgs.push("--direct");
    }
    logger.logCommand("generate", "bash", generateArgs);
    await runStep("bash", generateArgs);
    console.log("");
    results.push({ name: "generate", status: "success" });
    logger.endStep("generate", "success");
  } catch (err) {
    console.error(`\ngenerate 失敗: ${formatError(err)}`);
    results.push({ name: "generate", status: "failed" });
    logger.endStep("generate", "failed", formatError(err));
    await printSummary(results, undefined, undefined, undefined, logger);
    process.exit(1);
  }

  // Step 4: validate（新規生成されたアプリのみ）
  const appsAfter = listRequirementApps();
  const newApps = appsAfter.filter((app) => !appsBefore.has(app));
  await runValidation(newApps, results, "[Step 4] validate:");

  // サマリー
  await printSummary(results, targetDir, newApps, undefined, logger);
}

async function printSummary(
  results: StepResult[],
  targetDir?: string,
  newApps?: string[],
  mode?: string,
  logger?: PipelineLogger,
): Promise<void> {
  console.log("========================================");
  console.log("パイプライン実行結果:");
  console.log("========================================");

  const statusLabel: Record<StepStatus, string> = {
    success: "✓ 成功",
    skipped: "- スキップ",
    failed: "✗ 失敗",
  };

  for (const r of results) {
    console.log(`  ${statusLabel[r.status]}  ${r.name}`);
  }

  let articleCount: number | undefined;
  let keywordCount: number | undefined;

  if (targetDir) {
    const texts = loadAllTexts(targetDir);
    const keywordData = loadJson<{ keywords?: unknown[] }>(targetDir, "keyword.json");
    articleCount = texts.length;
    keywordCount = keywordData?.keywords?.length ?? 0;

    console.log("");
    if (newApps && newApps.length > 0) {
      const appNames = newApps.map((a) => `「${a}」`).join(", ");
      console.log(
        `${articleCount}件の記事から${keywordCount}個のキーワードを抽出し、アプリ案 ${appNames} を生成しました。`,
      );
    } else {
      console.log(`${articleCount}件の記事, ${keywordCount}個のキーワード`);
    }
  }

  if (newApps && newApps.length > 0 && !targetDir) {
    const appNames = newApps.map((a) => `「${a}」`).join(", ");
    console.log(`\nアプリ案 ${appNames} を生成しました。`);
  }

  const hasFailed = results.some((r) => r.status === "failed");
  if (hasFailed) {
    console.log("\n一部ステップが失敗しました。");
  } else {
    console.log("\n全ステップ完了。");
  }

  // Slack通知
  const slackSteps: PipelineStepResult[] = results.map((r) => ({
    name: r.name,
    status: r.status,
  }));
  const slackResult = await notifyPipelineResult(slackSteps, {
    newApps,
    articleCount,
    keywordCount,
    mode,
  });
  if (slackResult.success) {
    console.log("Slack通知を送信しました。");
  } else if (slackResult.error && slackResult.error !== "Slack通知が無効または未設定です") {
    console.error(`Slack通知エラー: ${slackResult.error}`);
  }

  // パイプライン全体のログサマリー
  if (logger) {
    const hasFailed = results.some((r) => r.status === "failed");
    logger.info("pipeline", "パイプライン完了", {
      overallStatus: hasFailed ? "failed" : "success",
      steps: results,
      newApps,
      articleCount,
      keywordCount,
      mode,
    });
  }
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
