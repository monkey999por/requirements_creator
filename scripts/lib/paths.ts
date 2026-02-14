import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

interface ConfigWithPaths {
  output_base_dir?: string;
}

function loadOutputBaseDir(): string {
  try {
    const configPath = resolve("app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as ConfigWithPaths;
    return config.output_base_dir ?? "gen";
  } catch {
    return "gen";
  }
}

const OUTPUT_BASE_DIR = loadOutputBaseDir();

/** data_source ディレクトリのフルパス */
export const DATA_SOURCE_DIR = resolve(OUTPUT_BASE_DIR, "data_source");

/** requirements ディレクトリのフルパス */
export const REQUIREMENTS_DIR = resolve(OUTPUT_BASE_DIR, "requirements");

/** datasets ディレクトリのフルパス */
export const DATASETS_DIR = resolve(OUTPUT_BASE_DIR, "datasets");

/** pipeline_queue ディレクトリのフルパス */
export const PIPELINE_QUEUE_DIR = resolve(OUTPUT_BASE_DIR, "pipeline_queue");

/** pipeline_queue_rejected ディレクトリのフルパス（論理削除先） */
export const PIPELINE_QUEUE_REJECTED_DIR = resolve(OUTPUT_BASE_DIR, "pipeline_queue_rejected");
