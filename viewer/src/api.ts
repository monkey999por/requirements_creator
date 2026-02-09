export interface Feature {
  id: string;
  filename: string;
  title: string;
  summary: string;
}

export interface MarkdownContent {
  content: string;
}

export interface AppInfo {
  name: string;
  tags: string[];
}

export interface DatasetSourceApp {
  appName: string;
  type: "overview" | "feature";
  featureId?: string;
  title?: string;
}

export interface SourceInfo {
  source?: { directory?: string; collected_at?: string };
  dataset?: { name?: string; sourceApps?: DatasetSourceApp[] };
  keywords?: { word?: string; relevance?: number }[];
  tags?: string[];
  description?: string;
}

const BASE = "/api";

export async function fetchApps(): Promise<AppInfo[]> {
  const res = await fetch(`${BASE}/apps`);
  return res.json();
}

export async function fetchOverview(appName: string): Promise<MarkdownContent> {
  const res = await fetch(`${BASE}/apps/${appName}/overview`);
  return res.json();
}

export async function fetchFeatures(appName: string): Promise<Feature[]> {
  const res = await fetch(`${BASE}/apps/${appName}/features`);
  return res.json();
}

export async function fetchFeatureDetail(
  appName: string,
  featureId: string,
): Promise<MarkdownContent> {
  const res = await fetch(`${BASE}/apps/${appName}/features/${featureId}`);
  return res.json();
}

export async function fetchSourceInfo(appName: string): Promise<SourceInfo> {
  const res = await fetch(`${BASE}/apps/${appName}/source-info`);
  return res.json();
}

export async function fetchMode(): Promise<{ isDev: boolean }> {
  const res = await fetch(`${BASE}/mode`);
  return res.json();
}

export async function fetchDiagrams(appName: string): Promise<MarkdownContent> {
  const res = await fetch(`${BASE}/apps/${appName}/diagrams`);
  return res.json();
}

export async function fetchMemo(appName: string): Promise<MarkdownContent> {
  const res = await fetch(`${BASE}/apps/${appName}/memo`);
  return res.json();
}

export async function saveMemo(appName: string, content: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/apps/${appName}/memo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

// --- Dataset API ---

export interface DatasetItem {
  appName: string;
  type: "overview" | "feature";
  featureId?: string;
  title?: string;
}

export interface Dataset {
  name: string;
  createdAt: string;
  items: DatasetItem[];
}

export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(`${BASE}/datasets`);
  return res.json();
}

export async function fetchDataset(name: string): Promise<Dataset> {
  const res = await fetch(`${BASE}/datasets/${name}`);
  return res.json();
}

export async function createDataset(name: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/datasets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteDataset(name: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/datasets/${name}`, { method: "DELETE" });
  return res.json();
}

export async function addDatasetItem(
  datasetName: string,
  item: DatasetItem,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/datasets/${datasetName}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  return res.json();
}

export async function removeDatasetItem(
  datasetName: string,
  item: DatasetItem,
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/datasets/${datasetName}/items`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  return res.json();
}

export async function fetchGeneratedAppsFromDataset(datasetName: string): Promise<string[]> {
  const res = await fetch(`${BASE}/datasets/${datasetName}/generated-apps`);
  return res.json();
}

export async function generateFromDataset(
  name: string,
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${BASE}/datasets/${name}/generate`, { method: "POST" });
  return res.json();
}

// --- Search API ---

export interface AppWithTags {
  name: string;
  tags: string[];
}

export interface GrepMatch {
  line: number;
  text: string;
}

export interface GrepFileResult {
  file: string;
  matches: GrepMatch[];
}

export interface GrepSearchResult {
  app: string;
  files: GrepFileResult[];
}

export interface TagSearchResult {
  app: string;
  tags: string[];
  matchedTags: string[];
}

export async function fetchAppsWithTags(): Promise<AppWithTags[]> {
  const res = await fetch(`${BASE}/apps-with-tags`);
  return res.json();
}

export async function searchGrep(query: string): Promise<GrepSearchResult[]> {
  const res = await fetch(`${BASE}/search?type=grep&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results;
}

export async function searchByTag(tag: string): Promise<TagSearchResult[]> {
  const res = await fetch(`${BASE}/search?type=tag&q=${encodeURIComponent(tag)}`);
  const data = await res.json();
  return data.results;
}

// --- Git API ---

export interface GitResult {
  success: boolean;
  output: string;
}

export async function commitAndPush(): Promise<GitResult> {
  const res = await fetch(`${BASE}/git/commit-push`, { method: "POST" });
  return res.json();
}
