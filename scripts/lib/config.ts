import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import "dotenv/config";

export interface SourceConfig {
  enabled: boolean;
  api_key_env: string;
  endpoint: string;
  params: Record<string, string | number>;
  output_file: string;
}

export type CollectConfig = Record<string, SourceConfig>;

export function loadConfig(configPath?: string): CollectConfig {
  const filePath = resolve(configPath ?? "collect.config.yaml");
  const raw = readFileSync(filePath, "utf-8");
  return parse(raw) as CollectConfig;
}

export function getApiKey(source: SourceConfig): string | undefined {
  return process.env[source.api_key_env];
}
