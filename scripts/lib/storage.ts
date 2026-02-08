import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DATA_SOURCE_DIR = resolve("data_source");

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("_");
}

export function createOutputDir(date?: Date): string {
  const timestamp = formatTimestamp(date ?? new Date());
  const dir = join(DATA_SOURCE_DIR, timestamp);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveJson(dir: string, filename: string, data: unknown): string {
  const filePath = join(dir, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}
