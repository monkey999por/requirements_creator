import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DATA_SOURCE_DIR = resolve("data_source");

/** data_source配下のサブディレクトリ一覧を新しい順で返す */
export function listDataSources(): string[] {
  if (!existsSync(DATA_SOURCE_DIR)) return [];
  return readdirSync(DATA_SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
}

/** 最新のdata_sourceサブディレクトリ名を返す */
export function getLatestDataSource(): string | undefined {
  return listDataSources()[0];
}

/** 指定ディレクトリのJSONファイルを読み込む */
export function loadJson<T = unknown>(dirName: string, filename: string): T | undefined {
  const filePath = join(DATA_SOURCE_DIR, dirName, filename);
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

/** data_sourceのフルパスを返す */
export function getDataSourcePath(dirName: string): string {
  return join(DATA_SOURCE_DIR, dirName);
}

export interface ArticleText {
  title: string;
  description: string;
}

/** NewsAPIのデータからテキスト要素を抽出 */
export function extractNewsApiTexts(data: unknown): ArticleText[] {
  const d = data as { data?: { articles?: Array<{ title?: string; description?: string }> } };
  const articles = d?.data?.articles;
  if (!Array.isArray(articles)) return [];
  return articles
    .filter((a) => a.title || a.description)
    .map((a) => ({
      title: a.title ?? "",
      description: a.description ?? "",
    }));
}

/** YouTubeのデータからテキスト要素を抽出 */
export function extractYoutubeTexts(data: unknown): ArticleText[] {
  const d = data as {
    data?: { items?: Array<{ snippet?: { title?: string; description?: string } }> };
  };
  const items = d?.data?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i.snippet?.title || i.snippet?.description)
    .map((i) => ({
      title: i.snippet?.title ?? "",
      description: i.snippet?.description ?? "",
    }));
}

/** 指定ディレクトリ内の全データソースからテキストを統合取得 */
export function loadAllTexts(dirName: string): ArticleText[] {
  const texts: ArticleText[] = [];

  const news = loadJson(dirName, "news.json");
  if (news) texts.push(...extractNewsApiTexts(news));

  const youtube = loadJson(dirName, "youtube.json");
  if (youtube) texts.push(...extractYoutubeTexts(youtube));

  return texts;
}
