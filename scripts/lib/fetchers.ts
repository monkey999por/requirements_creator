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

export async function fetchXPopularPosts(
  config: SourceConfig,
  apiKey: string,
): Promise<FetchResult> {
  const query = String(
    config.params.query ??
      "(話題 OR トレンド OR 注目 OR ニュース OR 最新) lang:ja -is:retweet -is:reply",
  );
  const maxResults = Number(config.params.maxResults ?? 20);
  const sortOrder = String(config.params.sort_order ?? "relevancy");

  const url = new URL(config.endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("sort_order", sortOrder);
  url.searchParams.set(
    "tweet.fields",
    "text,public_metrics,created_at,author_id,conversation_id,lang,note_tweet",
  );
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "name,username");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    fetched_at: new Date().toISOString(),
    source: "x_popular_posts",
    params: { query, maxResults, sort_order: sortOrder },
    data,
  };
}

export async function fetchThreads(config: SourceConfig, apiKey: string): Promise<FetchResult> {
  const query = String(config.params.q ?? "トレンド");
  const searchType = String(config.params.search_type ?? "TOP");
  const mediaType = config.params.media_type ? String(config.params.media_type) : undefined;
  const limit = config.params.limit ? Number(config.params.limit) : undefined;

  const url = new URL(config.endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("search_type", searchType);
  if (mediaType) url.searchParams.set("media_type", mediaType);
  if (limit) url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "id,text,media_type,permalink,timestamp,username");
  url.searchParams.set("access_token", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Threads API error (${res.status}): ${body}`);
  }

  const params: Record<string, string | number> = { q: query, search_type: searchType };
  if (mediaType) params.media_type = mediaType;
  if (limit) params.limit = limit;

  const data = await res.json();
  return {
    fetched_at: new Date().toISOString(),
    source: "threads",
    params,
    data,
  };
}

const fetcherMap: Record<string, (config: SourceConfig, apiKey: string) => Promise<FetchResult>> = {
  newsapi: fetchNewsApi,
  youtube: fetchYoutube,
  x: fetchXTrends,
  x_popular_posts: fetchXPopularPosts,
  threads: fetchThreads,
};

export function getFetcher(
  type: string,
): ((config: SourceConfig, apiKey: string) => Promise<FetchResult>) | undefined {
  return fetcherMap[type];
}
