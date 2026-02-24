import { existsSync, readFileSync } from "node:fs";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface TimerSchedule {
  days: string[];
  times: string[];
  timezone: string;
}

/**
 * systemd timer ファイルから OnCalendar / TimezoneOfTimer を解析する
 */
export function parseTimerFile(timerPath: string): TimerSchedule {
  if (!existsSync(timerPath)) return { days: [...ALL_DAYS], times: [], timezone: "Asia/Tokyo" };
  const content = readFileSync(timerPath, "utf-8");
  return parseTimerContent(content);
}

export function parseTimerContent(content: string): TimerSchedule {
  const lines = content.split("\n");
  const times: string[] = [];
  let days: string[] | null = null;
  let timezone = "Asia/Tokyo";

  for (const line of lines) {
    const tzMatch = line.match(/^TimezoneOfTimer=(.+)$/);
    if (tzMatch) {
      timezone = tzMatch[1].trim();
      continue;
    }

    const m = line.match(/^OnCalendar=(.+)$/);
    if (!m) continue;
    const spec = m[1].trim();
    // "Mon,Tue *-*-* HH:MM:SS" or "*-*-* HH:MM:SS"
    const parts = spec.split(/\s+/);
    if (parts.length === 2) {
      // No day spec: *-*-* HH:MM:SS
      const time = parts[1].slice(0, 5); // HH:MM
      if (!times.includes(time)) times.push(time);
      if (days === null) days = [...ALL_DAYS];
    } else if (parts.length === 3) {
      // Day spec: Mon,Tue *-*-* HH:MM:SS
      const daySpec = parts[0].replace(/,/g, ",");
      if (days === null) days = daySpec.split(",").filter((d) => ALL_DAYS.includes(d));
      const time = parts[2].slice(0, 5);
      if (!times.includes(time)) times.push(time);
    }
  }

  times.sort();
  return { days: days ?? [...ALL_DAYS], times, timezone };
}

/**
 * OnCalendar の days + times を cron 式に変換する
 * systemd の "Mon,Tue *-*-* 02:00:00" → "0 2 * * 1,2" (cron format)
 */
export function toCronExpressions(schedule: TimerSchedule): string[] {
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

export { ALL_DAYS };
