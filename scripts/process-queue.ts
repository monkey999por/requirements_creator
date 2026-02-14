import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DATA_SOURCE_DIR, PIPELINE_QUEUE_DIR, PIPELINE_QUEUE_REJECTED_DIR } from "./lib/paths.js";

interface QueueItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
}

function loadQueueItems(): QueueItem[] {
  if (!existsSync(PIPELINE_QUEUE_DIR)) return [];
  return readdirSync(PIPELINE_QUEUE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(PIPELINE_QUEUE_DIR, f), "utf-8")) as QueueItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is QueueItem => item !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function main() {
  const items = loadQueueItems();

  if (items.length === 0) {
    console.log("キューにアイテムがありません。");
    process.exit(0);
  }

  console.log(`キューに ${items.length} 件のアイテムがあります。`);

  for (const item of items) {
    console.log(`\n--- 処理中: ${item.title} (${item.id}) ---`);

    // data_source にディレクトリを作成し user_proposal.md を配置
    const ts = timestamp();
    const sourceDir = join(DATA_SOURCE_DIR, ts);
    mkdirSync(sourceDir, { recursive: true });

    const proposalContent = `# ${item.title}\n\n${item.content}`;
    writeFileSync(join(sourceDir, "user_proposal.md"), proposalContent, "utf-8");
    console.log(`data_source/${ts}/user_proposal.md を作成しました。`);

    // パイプライン実行（skip-collect）
    try {
      console.log(`pnpm pipeline --skip-collect --source ${ts} を実行中...`);
      execSync(`pnpm pipeline --skip-collect --source ${ts}`, {
        stdio: "inherit",
        cwd: join(import.meta.dirname, ".."),
      });
      console.log("パイプライン完了（成功）");

      // 成功したらキューアイテムを処理済みディレクトリに移動
      const queueFilePath = join(PIPELINE_QUEUE_DIR, `${item.id}.json`);
      if (existsSync(queueFilePath)) {
        if (!existsSync(PIPELINE_QUEUE_REJECTED_DIR)) {
          mkdirSync(PIPELINE_QUEUE_REJECTED_DIR, { recursive: true });
        }
        renameSync(queueFilePath, join(PIPELINE_QUEUE_REJECTED_DIR, `${item.id}.json`));
        console.log(`キューアイテムを処理済みに移動しました: ${item.id}`);
      }
    } catch (err) {
      console.error(`パイプライン失敗: ${item.title} (${item.id})`);
      console.error(err);
      // 失敗してもキューには残す（次回再実行される）
    }
  }

  console.log("\nキュー処理完了。");
}

main();
