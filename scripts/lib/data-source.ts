import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_SOURCE_DIR } from "./paths.js";

/** user_proposal.md のファイル名 */
export const USER_PROPOSAL_FILE = "user_proposal.md";

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

/**
 * 直近7件のdata_sourceをキー操作（↑↓/j/k + Enter）で対話選択させる。
 * tmux互換: ANSI escape sequence を使用し、escape-time の遅延を考慮。
 * 非TTY環境では最新を自動選択する。
 */
export async function selectDataSource(): Promise<string | undefined> {
  const maxItems = 7;
  const sources = listDataSources().slice(0, maxItems);

  if (sources.length === 0) return undefined;
  if (sources.length === 1) {
    console.log(`データソース: ${sources[0]}`);
    return sources[0];
  }

  // 非対話環境では最新を自動選択
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(`データソース: ${sources[0]}（自動選択）`);
    return sources[0];
  }

  let selected = 0;
  const count = sources.length;

  const drawMenu = (firstTime: boolean) => {
    if (!firstTime) {
      process.stdout.write(`\x1b[${count}A`); // カーソルをメニュー先頭へ
    }
    for (let i = 0; i < count; i++) {
      process.stdout.write("\x1b[2K"); // 行クリア
      const latest = i === 0 ? "  <- 最新" : "";
      if (i === selected) {
        process.stdout.write(`  \x1b[7m> ${sources[i]}${latest}\x1b[0m\n`);
      } else {
        process.stdout.write(`    ${sources[i]}${latest}\n`);
      }
    }
  };

  console.log("データソースを選択してください（↑↓/j/k: 移動  Enter: 決定  q: キャンセル）:");
  process.stdout.write("\x1b[?25l"); // カーソル非表示
  drawMenu(true);

  return new Promise<string | undefined>((resolve) => {
    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\x1b[?25h"); // カーソル復帰
    };

    const onData = (data: Buffer) => {
      const key = data.toString();

      if (key === "\r" || key === "\n") {
        cleanup();
        console.log(`\n選択: ${sources[selected]}`);
        resolve(sources[selected]);
        return;
      }

      if (key === "\x1b[A" || key === "k") {
        if (selected > 0) selected--;
      } else if (key === "\x1b[B" || key === "j") {
        if (selected < count - 1) selected++;
      } else if (key === "q") {
        cleanup();
        console.log("\nキャンセルしました。");
        resolve(undefined);
        return;
      } else if (key === "\x03") {
        // Ctrl+C
        cleanup();
        process.exit(130);
      }

      drawMenu(false);
    };

    stdin.on("data", onData);
  });
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

/** user_proposal.md からテキスト要素を抽出 */
export function extractUserProposalTexts(dirName: string): ArticleText[] {
  const filePath = join(DATA_SOURCE_DIR, dirName, USER_PROPOSAL_FILE);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return [];

  // Markdownの見出し(##)単位でセクションに分割
  const sections = content.split(/^## /m).filter(Boolean);
  if (sections.length <= 1) {
    // 見出しがないか1セクションのみの場合はそのまま1エントリとして返す
    return [{ title: "ユーザー提案", description: content }];
  }
  return sections.map((section) => {
    const lines = section.split("\n");
    const title = lines[0]?.trim() || "ユーザー提案";
    const description = lines.slice(1).join("\n").trim();
    return { title, description };
  });
}

/** 指定ディレクトリ内の全データソースからテキストを統合取得 */
export function loadAllTexts(dirName: string): ArticleText[] {
  const texts: ArticleText[] = [];

  const news = loadJson(dirName, "news.json");
  if (news) texts.push(...extractNewsApiTexts(news));

  const youtube = loadJson(dirName, "youtube.json");
  if (youtube) texts.push(...extractYoutubeTexts(youtube));

  texts.push(...extractUserProposalTexts(dirName));

  return texts;
}

/** 指定ディレクトリに user_proposal.md が存在するか */
export function hasUserProposal(dirName: string): boolean {
  return existsSync(join(DATA_SOURCE_DIR, dirName, USER_PROPOSAL_FILE));
}
