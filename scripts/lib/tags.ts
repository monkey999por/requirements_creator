export const TAG_VALUES = [
  "AI",
  "Web3",
  "ヘルスケア",
  "教育",
  "金融",
  "モビリティ",
  "サステナビリティ",
  "エンタメ",
] as const;

export type Tag = (typeof TAG_VALUES)[number];

export function isValidTag(value: string): value is Tag {
  return (TAG_VALUES as readonly string[]).includes(value);
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
