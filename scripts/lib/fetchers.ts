import type { SourceConfig } from "./config.js";

export interface FetchResult {
  fetched_at: string;
  source: string;
  params: Record<string, string | number>;
  data: unknown;
}

async function fetchFromApi(
  sourceName: string,
  config: SourceConfig,
  apiKey: string,
): Promise<FetchResult> {
  const url = new URL(config.endpoint);
  for (const [key, value] of Object.entries(config.params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${sourceName} API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    fetched_at: new Date().toISOString(),
    source: sourceName,
    params: config.params,
    data,
  };
}

export async function fetchNewsApi(config: SourceConfig, apiKey: string): Promise<FetchResult> {
  return fetchFromApi("newsapi", config, apiKey);
}

export async function fetchYoutube(config: SourceConfig, apiKey: string): Promise<FetchResult> {
  const url = new URL(config.endpoint);
  for (const [key, value] of Object.entries(config.params)) {
    // videoCategoryIdが空文字・"0"・未定義の場合はパラメータを送らない
    if (key === "videoCategoryId" && (!value || String(value) === "0")) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    fetched_at: new Date().toISOString(),
    source: "youtube",
    params: config.params,
    data,
  };
}

export async function fetchXTrends(config: SourceConfig, apiKey: string): Promise<FetchResult> {
  const woeid = config.params.woeid ?? 23424856;
  const url = `${config.endpoint}/${woeid}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    fetched_at: new Date().toISOString(),
    source: "x",
    params: config.params,
    data,
  };
}

const fetcherMap: Record<string, (config: SourceConfig, apiKey: string) => Promise<FetchResult>> = {
  newsapi: fetchNewsApi,
  youtube: fetchYoutube,
  x: fetchXTrends,
};

export function getFetcher(
  type: string,
): ((config: SourceConfig, apiKey: string) => Promise<FetchResult>) | undefined {
  return fetcherMap[type];
}
