import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getLatestDataSource, loadAllTexts, loadJson } from "./lib/data-source.js";
import { DATA_SOURCE_DIR, DATASETS_DIR, REQUIREMENTS_DIR } from "./lib/paths.js";

// --- 型定義 ---
interface PipelineOptions {
  skipCollect: boolean;
  skipExtract: boolean;
  source?: string;
  dataset?: string;
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
  const opts: PipelineOptions = { skipCollect: false, skipExtract: false };
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
  --skip-collect   既存データを使いキーワード抽出から開始
  --skip-extract   既存キーワードを使い要件生成のみ実行
  --source <dir>   使用する data_source サブディレクトリを指定
  --dataset <name> データセットをソースとして要件生成（collect/extractスキップ）
  -h, --help       ヘルプ表示`);
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
function runStep(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", detached: true });
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
      console.error(`\ngenerate 失敗: ${err instanceof Error ? err.message : err}`);
      results.push({ name: "generate", status: "failed" });
      printSummary(results);
      process.exit(1);
    }

    // validate
    const appsAfter = listRequirementApps();
    const newApps = appsAfter.filter((app) => !appsBefore.has(app));

    if (newApps.length > 0) {
      console.log(`[validate] ${newApps.join(", ")} を検証...\n`);
      try {
        for (const app of newApps) {
          await runStep("tsx", ["scripts/validate-requirements.ts", app]);
        }
        console.log("");
        results.push({ name: "validate", status: "success" });
      } catch (err) {
        console.error(`\nvalidate 失敗: ${err instanceof Error ? err.message : err}`);
        results.push({ name: "validate", status: "failed" });
      }
    } else {
      console.log("[validate] 新規アプリが検出されませんでした（スキップ）\n");
      results.push({ name: "validate", status: "skipped" });
    }

    printSummary(results, undefined, newApps);
    return;
  }

  // 通常モード
  console.log("=== パイプライン一括実行 ===\n");

  // Step 1: collect
  if (opts.skipCollect) {
    console.log("[Step 1] collect: スキップ\n");
    results.push({ name: "collect", status: "skipped" });
  } else {
    console.log("[Step 1] collect: データ収集を開始...\n");
    try {
      await runStep("tsx", ["scripts/collect.ts"]);
      console.log("");
      results.push({ name: "collect", status: "success" });
    } catch (err) {
      console.error(`\ncollect 失敗: ${err instanceof Error ? err.message : err}`);
      results.push({ name: "collect", status: "failed" });
      printSummary(results);
      process.exit(1);
    }
  }

  // 対象ディレクトリ決定
  let targetDir: string;
  if (opts.source) {
    targetDir = opts.source;
    const fullPath = resolve(DATA_SOURCE_DIR, targetDir);
    if (!existsSync(fullPath)) {
      console.error(`エラー: ${DATA_SOURCE_DIR}/${targetDir} が存在しません。`);
      process.exit(1);
    }
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
  console.log(`対象ディレクトリ: ${DATA_SOURCE_DIR}/${targetDir}\n`);

  // Step 2: extract
  if (opts.skipExtract) {
    console.log("[Step 2] extract: スキップ\n");
    const keywordPath = resolve(DATA_SOURCE_DIR, targetDir, "keyword.json");
    if (!existsSync(keywordPath)) {
      console.error(
        `エラー: ${keywordPath} が存在しません。--skip-extract を外して実行してください。`,
      );
      process.exit(1);
    }
    results.push({ name: "extract", status: "skipped" });
  } else {
    console.log("[Step 2] extract: キーワード抽出を開始...\n");
    try {
      await runStep("bash", ["scripts/extract.sh", "--target", targetDir]);
      console.log("");
      const keywordPath = resolve(DATA_SOURCE_DIR, targetDir, "keyword.json");
      if (!existsSync(keywordPath)) {
        throw new Error("keyword.json が生成されませんでした");
      }
      results.push({ name: "extract", status: "success" });
    } catch (err) {
      console.error(`\nextract 失敗: ${err instanceof Error ? err.message : err}`);
      results.push({ name: "extract", status: "failed" });
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 3: generate
  const appsBefore = new Set(listRequirementApps());
  console.log("[Step 3] generate: 要件生成を開始...\n");
  try {
    await runStep("bash", ["scripts/generate.sh", "--target", targetDir]);
    console.log("");
    results.push({ name: "generate", status: "success" });
  } catch (err) {
    console.error(`\ngenerate 失敗: ${err instanceof Error ? err.message : err}`);
    results.push({ name: "generate", status: "failed" });
    printSummary(results);
    process.exit(1);
  }

  // Step 4: validate（新規生成されたアプリのみ）
  const appsAfter = listRequirementApps();
  const newApps = appsAfter.filter((app) => !appsBefore.has(app));

  if (newApps.length > 0) {
    console.log(`[Step 4] validate: ${newApps.join(", ")} を検証...\n`);
    try {
      for (const app of newApps) {
        await runStep("tsx", ["scripts/validate-requirements.ts", app]);
      }
      console.log("");
      results.push({ name: "validate", status: "success" });
    } catch (err) {
      console.error(`\nvalidate 失敗: ${err instanceof Error ? err.message : err}`);
      results.push({ name: "validate", status: "failed" });
    }
  } else {
    console.log("[Step 4] validate: 新規アプリが検出されませんでした（スキップ）\n");
    results.push({ name: "validate", status: "skipped" });
  }

  // サマリー
  printSummary(results, targetDir, newApps);
}

function printSummary(results: StepResult[], targetDir?: string, newApps?: string[]): void {
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

  if (targetDir) {
    const texts = loadAllTexts(targetDir);
    const keywordData = loadJson<{ keywords?: unknown[] }>(targetDir, "keyword.json");
    const articleCount = texts.length;
    const keywordCount = keywordData?.keywords?.length ?? 0;

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
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
