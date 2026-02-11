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

export interface AgentConfig {
  enabled: boolean;
  model: string;
  sandbox?: string;
  roles: string[];
}

export interface PipelineConfig {
  default_source?: string;
}

export interface AppConfig {
  output_base_dir?: string;
  pipeline?: PipelineConfig;
  collect: {
    sources: Record<string, SourceConfig>;
  };
  generate?: {
    agents?: Record<string, AgentConfig>;
  };
}

export function loadAppConfig(configPath?: string): AppConfig {
  const filePath = resolve(configPath ?? "app.config.yaml");
  const raw = readFileSync(filePath, "utf-8");
  return parse(raw) as AppConfig;
}

export function getApiKey(source: SourceConfig): string | undefined {
  return process.env[source.api_key_env];
}
