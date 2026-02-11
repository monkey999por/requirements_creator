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

export type Platform =
  | "frontend-only"
  | "fullstack"
  | "mobile-android"
  | "mobile-ios"
  | "mobile-cross";
export type Budget = "free" | "low" | "moderate" | "high";
export type Difficulty = "easy" | "medium" | "hard";
export type TeamSize = "solo" | "small" | "medium" | "large";

export interface TechStackConstraints {
  frontend?: string;
  backend?: string;
  database?: string;
  hosting?: string;
  auth?: string;
  other?: string[];
}

export interface GenerateConstraints {
  platform?: Platform;
  budget?: Budget;
  difficulty?: Difficulty;
  team_size?: TeamSize;
  tech_stack?: TechStackConstraints;
}

export interface AppConfig {
  output_base_dir?: string;
  collect: {
    sources: Record<string, SourceConfig>;
  };
  generate?: {
    constraints?: GenerateConstraints;
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
