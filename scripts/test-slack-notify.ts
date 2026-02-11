import { notifyPipelineResult, notifyGenerateResult } from "./lib/slack.js";

async function testPipelineSuccess() {
  console.log("[Test 1] パイプライン成功通知...");
  const result = await notifyPipelineResult(
    [
      { name: "collect", status: "success" },
      { name: "extract", status: "success" },
      { name: "generate", status: "success" },
      { name: "validate", status: "success" },
    ],
    {
      newApps: ["test-awesome-app"],
      articleCount: 20,
      keywordCount: 15,
    },
  );
  console.log(result.success ? "  → 送信成功" : `  → 失敗: ${result.error}`);
  return result.success;
}

async function testGenerateComplete() {
  console.log("[Test 2] 要件生成完了通知...");
  const result = await notifyGenerateResult(["test-app-alpha", "test-app-beta"]);
  console.log(result.success ? "  → 送信成功" : `  → 失敗: ${result.error}`);
  return result.success;
}

async function main() {
  console.log("=== Slack通知テスト ===\n");

  const r1 = await testPipelineSuccess();
  const r2 = await testGenerateComplete();

  console.log(`\n結果: ${[r1, r2].filter(Boolean).length}/2 成功`);
  process.exit(r1 && r2 ? 0 : 1);
}

main();
