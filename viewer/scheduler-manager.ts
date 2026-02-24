import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Cron } from "croner";
import { parse as parseYaml } from "yaml";
import { parseTimerFile, toCronExpressions } from "./timer-parser.js";

const __dirname = new URL(".", import.meta.url).pathname;
const projectRoot = resolve(__dirname, "..");

interface SchedulerState {
  pipeline: { enabled: boolean };
  selfHealing: { enabled: boolean };
}

type SchedulerType = "pipeline" | "selfHealing";

const TIMER_FILES: Record<SchedulerType, string> = {
  pipeline: resolve(projectRoot, "systemd", "pipeline.timer"),
  selfHealing: resolve(projectRoot, "systemd", "self-healing.timer"),
};

const RUN_SCRIPTS: Record<SchedulerType, string> = {
  pipeline: resolve(projectRoot, "scripts", "scheduler-run.sh"),
  selfHealing: resolve(projectRoot, "scripts", "self-healing-run.sh"),
};

function getStatePath(): string {
  const configPath = resolve(projectRoot, "app.config.yaml");
  let base = "gen";
  try {
    const raw = readFileSync(configPath, "utf-8");
    const config = parseYaml(raw) as { output_base_dir?: string };
    base = config.output_base_dir ?? "gen";
  } catch {
    // デフォルト
  }
  return resolve(projectRoot, base, ".scheduler-state.json");
}

function loadState(): SchedulerState {
  const statePath = getStatePath();
  if (!existsSync(statePath)) {
    return { pipeline: { enabled: false }, selfHealing: { enabled: false } };
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf-8")) as SchedulerState;
  } catch {
    return { pipeline: { enabled: false }, selfHealing: { enabled: false } };
  }
}

function saveState(state: SchedulerState): void {
  const statePath = getStatePath();
  const dir = dirname(statePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

class SchedulerManager {
  private jobs: Map<string, Cron[]> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();

  /** 初期化: 保存状態に基づいてジョブを復元 */
  init(): void {
    const state = loadState();
    if (state.pipeline.enabled) this.startJobs("pipeline");
    if (state.selfHealing.enabled) this.startJobs("selfHealing");
    const types: string[] = [];
    if (state.pipeline.enabled) types.push("pipeline");
    if (state.selfHealing.enabled) types.push("selfHealing");
    if (types.length > 0) {
      console.log(`[scheduler-manager] 復元: ${types.join(", ")}`);
    }
  }

  enable(type: SchedulerType): void {
    const state = loadState();
    state[type].enabled = true;
    saveState(state);
    this.startJobs(type);
    console.log(`[scheduler-manager] ${type} を有効化しました`);
  }

  disable(type: SchedulerType): void {
    const state = loadState();
    state[type].enabled = false;
    saveState(state);
    this.stopJobs(type);
    console.log(`[scheduler-manager] ${type} を無効化しました`);
  }

  isActive(type: SchedulerType): boolean {
    const state = loadState();
    return state[type].enabled;
  }

  getSchedule(type: SchedulerType): { days: string[]; times: string[] } {
    const timerPath = TIMER_FILES[type];
    const schedule = parseTimerFile(timerPath);
    return { days: schedule.days, times: schedule.times };
  }

  getNextRun(type: SchedulerType): string | null {
    const jobs = this.jobs.get(type);
    if (!jobs || jobs.length === 0) return null;

    let earliest: Date | null = null;
    for (const job of jobs) {
      const next = job.nextRun();
      if (next && (!earliest || next < earliest)) {
        earliest = next;
      }
    }
    return earliest?.toISOString() ?? null;
  }

  /** timer ファイル書き換え後にジョブを再登録 */
  reloadSchedule(type: SchedulerType): void {
    if (!this.isActive(type)) return;
    this.stopJobs(type);
    this.startJobs(type);
    console.log(`[scheduler-manager] ${type} のスケジュールをリロードしました`);
  }

  shutdown(): void {
    for (const type of ["pipeline", "selfHealing"] as SchedulerType[]) {
      this.stopJobs(type);
    }
  }

  private startJobs(type: SchedulerType): void {
    this.stopJobs(type);
    const timerPath = TIMER_FILES[type];
    const schedule = parseTimerFile(timerPath);
    const cronExprs = toCronExpressions(schedule);

    const jobs: Cron[] = [];
    for (const expr of cronExprs) {
      const job = new Cron(expr, { timezone: schedule.timezone }, () => {
        this.executeScript(type);
      });
      jobs.push(job);
    }
    this.jobs.set(type, jobs);
  }

  private stopJobs(type: SchedulerType): void {
    const jobs = this.jobs.get(type);
    if (jobs) {
      for (const job of jobs) job.stop();
      this.jobs.delete(type);
    }
  }

  private executeScript(type: SchedulerType): void {
    if (this.runningProcesses.has(type)) {
      console.log(`[scheduler-manager] ${type} は既に実行中です。スキップします`);
      return;
    }

    const script = RUN_SCRIPTS[type];
    console.log(`[scheduler-manager] ${type} を実行: ${script}`);

    const child = spawn("bash", [script], {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env },
    });

    this.runningProcesses.set(type, child);

    child.on("close", (code) => {
      this.runningProcesses.delete(type);
      console.log(`[scheduler-manager] ${type} 完了 (exit code: ${code})`);
    });

    child.on("error", (err) => {
      this.runningProcesses.delete(type);
      console.error(`[scheduler-manager] ${type} エラー:`, err.message);
    });
  }
}

export const schedulerManager = new SchedulerManager();
export type { SchedulerType };
