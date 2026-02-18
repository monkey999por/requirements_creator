import { parseArgs } from "./lib/cli.js";
import { getApiKey, loadAppConfig } from "./lib/config.js";
import { getFetcher } from "./lib/fetchers.js";
import { PipelineLogger } from "./lib/logger.js";
import { createOutputDir, saveJson } from "./lib/storage.js";
import { formatError } from "./lib/utils.js";

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const appConfig = loadAppConfig(opts.config);

  // パイプラインモード時はログファイルパスを環境変数から取得、それ以外は新規作成
  const logger = new PipelineLogger(process.env.PIPELINE_LOG_FILE);
  if (!process.env.PIPELINE_LOG_FILE) {
    logger.startStep("collect");
  }

  // 有効ソースの設定情報をログに記録
  const enabledSources = Object.entries(appConfig.collect.sources)
    .filter(([, src]) => src.enabled)
    .map(([name, src]) => ({ name, endpoint: src.endpoint, apiKeyEnv: src.api_key_env }));
  logger.logConfig("collect", {
    enabledSources,
    onlyFilter: opts.only ?? null,
  });

  const sources = Object.entries(appConfig.collect.sources).filter(([name, src]) => {
    if (!src.enabled) return false;
    if (opts.only && name !== opts.only) return false;
    return true;
  });

  if (sources.length === 0) {
    console.log("有効なデータソースがありません。app.config.yaml を確認してください。");
    logger.warn("collect", "有効なデータソースがありません");
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
  logger.info("collect", `出力先: ${outputDir}`, {
    targetSources: sources.map(([n]) => n),
  });

  let successCount = 0;
  const sourceResults: Record<string, string> = {};

  for (const [name, sourceConfig] of sources) {
    const apiKey = getApiKey(sourceConfig);
    if (!apiKey) {
      console.warn(
        `[${name}] ⚠ 環境変数 ${sourceConfig.api_key_env} が未設定です。スキップします。`,
      );
      logger.warn("collect", `APIキー未設定: ${sourceConfig.api_key_env}`, { source: name });
      sourceResults[name] = "skipped:api_key_missing";
      continue;
    }

    const fetcher = getFetcher(sourceConfig.type ?? name);
    if (!fetcher) {
      console.warn(`[${name}] ⚠ 未対応のデータソースです。スキップします。`);
      logger.warn("collect", `未対応のデータソース`, { source: name });
      sourceResults[name] = "skipped:unsupported";
      continue;
    }

    try {
      console.log(`[${name}] データ取得中...`);
      logger.logCommand("collect", "fetch", [name, sourceConfig.endpoint]);
      const result = await fetcher(sourceConfig, apiKey);
      const filePath = saveJson(outputDir, sourceConfig.output_file, result);
      console.log(`[${name}] ✓ 保存完了: ${filePath}`);
      logger.info("collect", `${name} 取得成功`, { source: name, outputFile: filePath });
      sourceResults[name] = "success";
      successCount++;
    } catch (err) {
      console.error(`[${name}] ✗ エラー: ${formatError(err)}`);
      logger.error("collect", `${name} 取得失敗: ${formatError(err)}`, { source: name });
      sourceResults[name] = `failed:${formatError(err)}`;
    }
  }

  console.log(`\n完了: ${successCount}/${sources.length} ソースを取得しました。`);
  logger.info("collect", `完了: ${successCount}/${sources.length}`, {
    successCount,
    totalCount: sources.length,
    sourceResults,
  });

  if (!process.env.PIPELINE_LOG_FILE) {
    logger.endStep("collect", successCount > 0 ? "success" : "failed");
  }

  // 全ソース失敗時はパイプラインを停止させるため非ゼロ終了
  if (successCount === 0) {
    console.error("全データソースの取得に失敗しました。");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
