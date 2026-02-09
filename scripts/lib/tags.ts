import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAGS_JSON_PATH = resolve("gen", "tags.json");

function loadTags(): string[] {
  if (!existsSync(TAGS_JSON_PATH)) {
    console.warn(`警告: ${TAGS_JSON_PATH} が見つかりません。空のタグ一覧を使用します。`);
    return [];
  }
  try {
    return JSON.parse(readFileSync(TAGS_JSON_PATH, "utf-8")) as string[];
  } catch (e) {
    console.warn(`警告: ${TAGS_JSON_PATH} の読み込みに失敗しました: ${e}`);
    return [];
  }
}

/** gen/tags.json から読み込んだタグ一覧 */
export const TAG_VALUES: readonly string[] = loadTags();

export function isValidTag(value: string): boolean {
  return TAG_VALUES.includes(value);
}

export function validateTags(tags: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(tags)) {
    errors.push("tagsが配列ではありません");
    return errors;
  }
  if (tags.length === 0) {
    errors.push("tagsが空です（1つ以上必要）");
    return errors;
  }
  for (const tag of tags) {
    if (typeof tag !== "string" || !isValidTag(tag)) {
      errors.push(`無効なタグ値: "${tag}"（許可値: ${TAG_VALUES.join(", ")}）`);
    }
  }
  return errors;
}
