import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Cron } from "croner";
import { parse as parseYaml } from "yaml";

const __dirname = new URL(".", import.meta.url).pathname;
const projectRoot = resolve(__dirname, "..");

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface ScheduleConfig {
  days: string[];
  times: string[];
  timezone: string;
}

interface SchedulerEntry {
  enabled: boolean;
  schedule: ScheduleConfig;
}

interface SchedulerState {
  pipeline: SchedulerEntry;
  selfHealing: SchedulerEntry;
}

type SchedulerType = "pipeline" | "selfHealing";

/** デフォルトスケジュール（初回起動時に使用） */
const DEFAULT_STATE: SchedulerState = {
  pipeline: {
    enabled: false,
    schedule: {
      days: [...ALL_DAYS],
      times: ["02:00", "02:30", "03:00", "03:30", "04:00", "04:27", "05:00", "05:27"],
      timezone: "Asia/Tokyo",
    },
  },
  selfHealing: {
    enabled: false,
    schedule: {
      days: [...ALL_DAYS],
      times: ["06:00"],
      timezone: "Asia/Tokyo",
    },
  },
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
    return structuredClone(DEFAULT_STATE);
  }
  try {
    const saved = JSON.parse(readFileSync(statePath, "utf-8")) as Partial<SchedulerState>;
    // 保存データとデフォルトをマージ（schedule が欠落していた場合の互換性）
    return {
      pipeline: {
        enabled: saved.pipeline?.enabled ?? DEFAULT_STATE.pipeline.enabled,
        schedule: saved.pipeline?.schedule ?? structuredClone(DEFAULT_STATE.pipeline.schedule),
      },
      selfHealing: {
        enabled: saved.selfHealing?.enabled ?? DEFAULT_STATE.selfHealing.enabled,
        schedule:
          saved.selfHealing?.schedule ?? structuredClone(DEFAULT_STATE.selfHealing.schedule),
      },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(state: SchedulerState): void {
  const statePath = getStatePath();
  const dir = dirname(statePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/** days + times → cron式の配列に変換 */
function toCronExpressions(schedule: ScheduleConfig): string[] {
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };

  const isAllDays =
    schedule.days.length === ALL_DAYS.length && ALL_DAYS.every((d) => schedule.days.includes(d));
  const cronDays = isAllDays ? "*" : schedule.days.map((d) => dayMap[d] ?? 0).join(",");

  return schedule.times.map((time) => {
    const [hh, mm] = time.split(":");
    return `${mm} ${hh} * * ${cronDays}`;
  });
}

class SchedulerManager {
  private jobs: Map<string, Cron[]> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();

  /** 初期化: 保存状態に基づいてジョブを復元 */
  init(): void {
    const state = loadState();
    if (state.pipeline.enabled) this.startJobs("pipeline", state.pipeline.schedule);
    if (state.selfHealing.enabled) this.startJobs("selfHealing", state.selfHealing.schedule);
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
    this.startJobs(type, state[type].schedule);
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
    const state = loadState();
    const { days, times } = state[type].schedule;
    return { days, times };
  }

  updateSchedule(type: SchedulerType, days: string[], times: string[]): void {
    const state = loadState();
    state[type].schedule.days = days;
    state[type].schedule.times = [...times].sort();
    saveState(state);
    if (state[type].enabled) {
      this.stopJobs(type);
      this.startJobs(type, state[type].schedule);
    }
    console.log(`[scheduler-manager] ${type} のスケジュールを更新しました`);
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

  /** スケジュール変更後にジョブを再登録 */
  reloadSchedule(type: SchedulerType): void {
    if (!this.isActive(type)) return;
    const state = loadState();
    this.stopJobs(type);
    this.startJobs(type, state[type].schedule);
    console.log(`[scheduler-manager] ${type} のスケジュールをリロードしました`);
  }

  shutdown(): void {
    for (const type of ["pipeline", "selfHealing"] as SchedulerType[]) {
      this.stopJobs(type);
    }
  }

  private startJobs(type: SchedulerType, schedule: ScheduleConfig): void {
    this.stopJobs(type);
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
export { ALL_DAYS };
export type { SchedulerType };
