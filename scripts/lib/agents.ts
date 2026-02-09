import type { AgentConfig } from "./config.js";
import { loadAppConfig } from "./config.js";

/** 定義済みロール */
export type AgentRole = "researcher" | "designer" | "reviewer" | "enhancer";

const VALID_ROLES: readonly AgentRole[] = ["researcher", "designer", "reviewer", "enhancer"];

/**
 * app.config.yaml から generate.agents を読み込む。
 * 未設定の場合は空オブジェクトを返す。
 */
export function loadAgentConfigs(): Record<string, AgentConfig> {
  const config = loadAppConfig();
  return config.generate?.agents ?? {};
}

/**
 * 指定ロールを持つ有効なエージェント一覧を返す。
 */
export function getAgentsWithRole(
  role: AgentRole,
  agents?: Record<string, AgentConfig>,
): Array<{ name: string; config: AgentConfig }> {
  const configs = agents ?? loadAgentConfigs();
  return Object.entries(configs)
    .filter(([, cfg]) => cfg.enabled && cfg.roles.includes(role))
    .map(([name, config]) => ({ name, config }));
}

/**
 * 指定エージェントが有効かどうかを返す。
 */
export function isAgentEnabled(name: string, agents?: Record<string, AgentConfig>): boolean {
  const configs = agents ?? loadAgentConfigs();
  return configs[name]?.enabled ?? false;
}

/**
 * ロール値が有効かどうかを検証する。
 */
export function isValidRole(role: string): role is AgentRole {
  return (VALID_ROLES as readonly string[]).includes(role);
}
