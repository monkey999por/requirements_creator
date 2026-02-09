import { parseArgs } from "./lib/cli.js";
import { getApiKey, loadAppConfig } from "./lib/config.js";
import { getFetcher } from "./lib/fetchers.js";
import { createOutputDir, saveJson } from "./lib/storage.js";

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const appConfig = loadAppConfig(opts.config);

  const sources = Object.entries(appConfig.collect.sources).filter(([name, src]) => {
    if (!src.enabled) return false;
    if (opts.only && name !== opts.only) return false;
    return true;
  });

  if (sources.length === 0) {
    console.log("有効なデータソースがありません。app.config.yaml を確認してください。");
    return;
  }

  if (opts.dryRun) {
    console.log(`対象ソース: ${sources.map(([n]) => n).join(", ")}\n`);
    for (const [name, sourceConfig] of sources) {
      console.log(`[${name}] (dry-run) ${sourceConfig.endpoint} にリクエスト予定`);
      console.log(`  params: ${JSON.stringify(sourceConfig.params)}`);
    }
    console.log(`\n完了: 0/${sources.length} ソースを取得しました。(dry-run)`);
    return;
  }

  const outputDir = createOutputDir();
  console.log(`出力先: ${outputDir}`);
  console.log(`対象ソース: ${sources.map(([n]) => n).join(", ")}\n`);

  let successCount = 0;

  for (const [name, sourceConfig] of sources) {
    const apiKey = getApiKey(sourceConfig);
    if (!apiKey) {
      console.warn(
        `[${name}] ⚠ 環境変数 ${sourceConfig.api_key_env} が未設定です。スキップします。`,
      );
      continue;
    }

    const fetcher = getFetcher(name);
    if (!fetcher) {
      console.warn(`[${name}] ⚠ 未対応のデータソースです。スキップします。`);
      continue;
    }

    try {
      console.log(`[${name}] データ取得中...`);
      const result = await fetcher(sourceConfig, apiKey);
      const filePath = saveJson(outputDir, sourceConfig.output_file, result);
      console.log(`[${name}] ✓ 保存完了: ${filePath}`);
      successCount++;
    } catch (err) {
      console.error(`[${name}] ✗ エラー: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n完了: ${successCount}/${sources.length} ソースを取得しました。`);
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
