import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIREMENTS_DIR } from "./lib/paths.js";
import { validateTags } from "./lib/tags.js";

// --- 必須セクション定義 ---
const OVERVIEW_REQUIRED_SECTIONS = [
  "コンセプト",
  "ターゲットユーザー",
  "機能一覧",
  "マネタイズ",
  "技術スタック",
  "運用方針",
];

const FEATURE_REQUIRED_SECTIONS = [
  "概要",
  "画面構成",
  "ユーザーフロー",
  "データモデル",
  "API設計",
  "非機能要件",
];

interface DatasetSourceApp {
  appName?: string;
  type?: string;
  featureId?: string;
  title?: string;
}

interface SourceInfoJson {
  source?: { directory?: string; collected_at?: string };
  dataset?: { name?: string; sourceApps?: DatasetSourceApp[] };
  keywords?: { word?: string; relevance?: number }[];
  tags?: string[];
  description?: string;
}

// --- ヘルパー ---
interface ValidationError {
  file: string;
  message: string;
}

function checkSections(content: string, requiredSections: string[]): string[] {
  const missing: string[] = [];
  for (const section of requiredSections) {
    // "## セクション名" または "## セクション名（...）" にマッチ
    const pattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m");
    if (!pattern.test(content)) {
      missing.push(section);
    }
  }
  return missing;
}

function extractFeatureTableIds(overviewContent: string): string[] {
  // "| 01 | ..." のような行からIDを抽出
  const tableRowPattern = /^\|\s*(\d{2})\s*\|/gm;
  const ids: string[] = [];
  for (const match of overviewContent.matchAll(tableRowPattern)) {
    if (match[1] !== "ID" && /^\d{2}$/.test(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

// --- メイン ---
function validate(appName: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const appDir = join(REQUIREMENTS_DIR, appName);

  // 1. ディレクトリ存在チェック
  if (!existsSync(appDir)) {
    errors.push({ file: appDir, message: "ディレクトリが存在しません" });
    return errors;
  }

  // 2. app_name命名規則チェック（kebab-case）
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(appName)) {
    errors.push({
      file: appName,
      message: "app_nameがkebab-caseではありません（英小文字・数字・ハイフンのみ）",
    });
  }

  // 3. 必須ファイル存在チェック
  const requiredFiles = ["_source_info.json", "overview.md"];
  for (const file of requiredFiles) {
    if (!existsSync(join(appDir, file))) {
      errors.push({ file, message: "必須ファイルが存在しません" });
    }
  }

  // 4. featuresディレクトリ存在チェック
  const featuresDir = join(appDir, "features");
  if (!existsSync(featuresDir)) {
    errors.push({ file: "features/", message: "featuresディレクトリが存在しません" });
    return errors;
  }

  // 5. _source_info.json スキーマバリデーション
  const sourceInfoPath = join(appDir, "_source_info.json");
  if (existsSync(sourceInfoPath)) {
    try {
      const raw = readFileSync(sourceInfoPath, "utf-8");
      const data = JSON.parse(raw) as SourceInfoJson;

      if (!data.source?.directory) {
        errors.push({ file: "_source_info.json", message: "source.directoryが未設定です" });
      }
      if (!data.source?.collected_at) {
        errors.push({ file: "_source_info.json", message: "source.collected_atが未設定です" });
      }
      if (!Array.isArray(data.keywords) || data.keywords.length === 0) {
        errors.push({ file: "_source_info.json", message: "keywordsが空または未設定です" });
      }
      if (!data.description) {
        errors.push({ file: "_source_info.json", message: "descriptionが未設定です" });
      }

      const tagErrors = validateTags(data.tags);
      for (const te of tagErrors) {
        errors.push({ file: "_source_info.json", message: te });
      }

      // dataset フィールドのオプショナル検証
      if (data.dataset) {
        if (!data.dataset.name) {
          errors.push({ file: "_source_info.json", message: "dataset.nameが未設定です" });
        }
        if (!Array.isArray(data.dataset.sourceApps) || data.dataset.sourceApps.length === 0) {
          errors.push({
            file: "_source_info.json",
            message: "dataset.sourceAppsが空または未設定です",
          });
        } else {
          for (const [i, sa] of data.dataset.sourceApps.entries()) {
            if (!sa.appName) {
              errors.push({
                file: "_source_info.json",
                message: `dataset.sourceApps[${i}].appNameが未設定です`,
              });
            }
            if (sa.type !== "overview" && sa.type !== "feature") {
              errors.push({
                file: "_source_info.json",
                message: `dataset.sourceApps[${i}].typeが不正です（"overview"または"feature"のみ）`,
              });
            }
          }
        }
      }
    } catch (e) {
      errors.push({
        file: "_source_info.json",
        message: `JSONパースエラー: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // 6. overview.md セクションチェック
  const overviewPath = join(appDir, "overview.md");
  let featureIdsFromTable: string[] = [];
  if (existsSync(overviewPath)) {
    const content = readFileSync(overviewPath, "utf-8");
    const missing = checkSections(content, OVERVIEW_REQUIRED_SECTIONS);
    for (const section of missing) {
      errors.push({ file: "overview.md", message: `必須セクション「${section}」がありません` });
    }

    // 機能一覧テーブルからIDを抽出
    featureIdsFromTable = extractFeatureTableIds(content);
    if (featureIdsFromTable.length === 0) {
      errors.push({ file: "overview.md", message: "機能一覧テーブルから機能IDを検出できません" });
    }
  }

  // 7. featureファイルのチェック
  const featureFiles = readdirSync(featuresDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (featureFiles.length === 0) {
    errors.push({ file: "features/", message: "featureファイルが1つもありません" });
    return errors;
  }

  // 7a. ファイル命名規則チェック（{nn}_{snake_case}.md）
  const featureFilePattern = /^(\d{2})_([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.md$/;
  const featureIdsFromFiles: string[] = [];

  for (const file of featureFiles) {
    const match = file.match(featureFilePattern);
    if (!match) {
      errors.push({
        file: `features/${file}`,
        message: "ファイル名が命名規則（{nn}_{snake_case}.md）に従っていません",
      });
    } else {
      featureIdsFromFiles.push(match[1]);
    }
  }

  // 7b. 連番チェック（01から連続）
  for (let i = 0; i < featureIdsFromFiles.length; i++) {
    const expected = String(i + 1).padStart(2, "0");
    if (featureIdsFromFiles[i] !== expected) {
      errors.push({
        file: "features/",
        message: `連番が不連続です: ${expected}が期待されますが${featureIdsFromFiles[i]}があります`,
      });
      break;
    }
  }

  // 7c. overview.mdの機能数とfeatureファイル数の一致チェック
  if (featureIdsFromTable.length > 0 && featureIdsFromTable.length !== featureFiles.length) {
    errors.push({
      file: "features/",
      message: `overview.mdの機能数(${featureIdsFromTable.length})とfeatureファイル数(${featureFiles.length})が一致しません`,
    });
  }

  // 7d. 各featureファイルのセクションチェック
  for (const file of featureFiles) {
    const content = readFileSync(join(featuresDir, file), "utf-8");
    const missing = checkSections(content, FEATURE_REQUIRED_SECTIONS);
    for (const section of missing) {
      errors.push({
        file: `features/${file}`,
        message: `必須セクション「${section}」がありません`,
      });
    }
  }

  return errors;
}

// --- エントリポイント ---
function main() {
  const appName = process.argv[2];

  if (!appName) {
    // 引数なし: requirements/ 配下の全アプリを検証
    if (!existsSync(REQUIREMENTS_DIR)) {
      console.error(`${REQUIREMENTS_DIR} ディレクトリが存在しません。`);
      process.exit(1);
    }

    const apps = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (apps.length === 0) {
      console.error(`${REQUIREMENTS_DIR} にアプリがありません。`);
      process.exit(1);
    }

    let totalErrors = 0;
    for (const app of apps) {
      console.log(`\n--- ${app} ---`);
      const errors = validate(app);
      totalErrors += errors.length;
      printResult(app, errors);
    }

    console.log(`\n========================================`);
    console.log(`検証完了: ${apps.length} アプリ, ${totalErrors} エラー`);
    process.exit(totalErrors > 0 ? 1 : 0);
  }

  // 引数あり: 指定アプリを検証
  const errors = validate(appName);
  printResult(appName, errors);
  process.exit(errors.length > 0 ? 1 : 0);
}

function printResult(appName: string, errors: ValidationError[]) {
  if (errors.length === 0) {
    console.log(`✓ ${appName}: 全チェック通過`);
    return;
  }

  console.error(`✗ ${appName}: ${errors.length} 件のエラー`);
  for (const err of errors) {
    console.error(`  - [${err.file}] ${err.message}`);
  }
}

main();
