/**
 * 一時的な移行スクリプト: _source_info.md → _source_info.json
 * 使用後に削除すること（commitしない）
 *
 * 実行: npx tsx scripts/migrate-source-info.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIREMENTS_DIR } from "./lib/paths.js";
import { TAG_VALUES } from "./lib/tags.js";

// タグ推定用のキーワードマッピング
const TAG_HINTS: Record<string, string[]> = {
  AI: ["AI", "エージェント", "機械学習", "自律", "LLM", "生成AI"],
  Web3: ["Web3", "ブロックチェーン", "暗号資産", "NFT", "分散"],
  ヘルスケア: ["ヘルス", "医療", "健康", "ヘルステック"],
  教育: ["教育", "リテラシー", "学習", "メンタリング", "世代間"],
  金融: ["金融", "投資", "資産", "経済", "ボラティリティ", "リスク管理", "フィンテック"],
  モビリティ: ["モビリティ", "ライドシェア", "交通", "移動"],
  サステナビリティ: ["サステナ", "エシカル", "倫理", "環境", "脱プラ"],
  エンタメ: ["エンタメ", "ゲーム", "動画", "音楽", "コンテンツ"],
};

function inferTags(content: string): string[] {
  const scores = new Map<string, number>();
  for (const [tag, hints] of Object.entries(TAG_HINTS)) {
    let score = 0;
    for (const hint of hints) {
      const regex = new RegExp(hint, "gi");
      const matches = content.match(regex);
      if (matches) score += matches.length;
    }
    if (score > 0) scores.set(tag, score);
  }
  // スコア降順で上位2つ（最低2つ）
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const tags = sorted.slice(0, Math.max(2, sorted.length)).map(([tag]) => tag);
  // 2つに満たない場合はAIをデフォルトで追加
  if (tags.length < 2) {
    for (const fallback of TAG_VALUES) {
      if (!tags.includes(fallback)) {
        tags.push(fallback);
        if (tags.length >= 2) break;
      }
    }
  }
  return tags.slice(0, 3);
}

function parseSourceInfoMd(content: string): {
  directory: string;
  collectedAt: string;
  keywords: { word: string; relevance: number }[];
  description: string;
} {
  // ディレクトリ
  const dirMatch = content.match(/ディレクトリ:\s*`([^`]+)`/);
  const directory = dirMatch?.[1] ?? "";

  // 収集日時（複数形式対応）
  const dateMatch = content.match(/収集日時:\s*(.+)/);
  let collectedAt = dateMatch?.[1]?.trim() ?? "";
  // "2026年2月8日 20:01:54" → "2026-02-08 20:01:54" に正規化
  const jpDateMatch = collectedAt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{2}:\d{2}:\d{2})/);
  if (jpDateMatch) {
    const [, y, m, d, t] = jpDateMatch;
    collectedAt = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")} ${t}`;
  }

  // キーワード（"- キーワード名（relevance: 0.95）" 形式）
  const keywordSection = content.match(/## 使用キーワード\s*\n+([\s\S]*?)(?=\n## |$)/);
  const keywords: { word: string; relevance: number }[] = [];
  if (keywordSection) {
    const lines = keywordSection[1].split("\n").filter((l) => l.trim().startsWith("-"));
    for (const line of lines) {
      const m = line.match(/^-\s*(.+?)(?:[（(]relevance:\s*([\d.]+)[)）])?$/);
      if (m) {
        keywords.push({
          word: m[1].trim(),
          relevance: m[2] ? Number.parseFloat(m[2]) : 0.5,
        });
      }
    }
  }

  // 生成の経緯
  const descSection = content.match(/## 生成の経緯\s*\n+([\s\S]*?)(?=\n## |$)/);
  const description = descSection?.[1]?.trim() ?? "";

  return { directory, collectedAt, keywords, description };
}

function migrate() {
  if (!existsSync(REQUIREMENTS_DIR)) {
    console.error(`${REQUIREMENTS_DIR} が存在しません`);
    process.exit(1);
  }

  const apps = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let converted = 0;
  let skipped = 0;

  for (const app of apps) {
    const appDir = join(REQUIREMENTS_DIR, app);
    const mdPath = join(appDir, "_source_info.md");
    const jsonPath = join(appDir, "_source_info.json");

    if (existsSync(jsonPath)) {
      console.log(`⏭ ${app}: _source_info.json が既に存在 → スキップ`);
      skipped++;
      continue;
    }

    if (!existsSync(mdPath)) {
      console.log(`⏭ ${app}: _source_info.md がない → スキップ`);
      skipped++;
      continue;
    }

    const mdContent = readFileSync(mdPath, "utf-8");
    const parsed = parseSourceInfoMd(mdContent);
    const tags = inferTags(mdContent);

    const json = {
      source: {
        directory: parsed.directory,
        collected_at: parsed.collectedAt,
      },
      keywords: parsed.keywords,
      tags,
      description: parsed.description,
    };

    writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");
    console.log(`✓ ${app}: 変換完了 → tags: [${tags.join(", ")}]`);
    converted++;
  }

  console.log(`\n========================================`);
  console.log(`完了: ${converted} 件変換, ${skipped} 件スキップ`);
}

migrate();
