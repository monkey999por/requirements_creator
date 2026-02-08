export interface Feature {
  id: string;
  filename: string;
  title: string;
  summary: string;
}

export interface MarkdownContent {
  content: string;
}

const BASE = "/api";

export async function fetchApps(): Promise<string[]> {
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

export async function fetchSourceInfo(appName: string): Promise<MarkdownContent> {
  const res = await fetch(`${BASE}/apps/${appName}/source-info`);
  return res.json();
}
