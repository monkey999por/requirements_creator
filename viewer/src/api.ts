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

export async function fetchAppGenerationConfig(appName: string): Promise<MarkdownContent | null> {
  const res = await fetch(`${BASE}/apps/${appName}/config`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchTags(): Promise<string[]> {
  const res = await fetch(`${BASE}/tags`);
  return res.json();
}

export async function fetchMode(): Promise<{ isDev: boolean }> {
  const res = await fetch(`${BASE}/mode`);
  return res.json();
}

export interface DiagramFile {
  id: string;
  filename: string;
  title: string;
  content: string;
}

export async function fetchDiagrams(appName: string): Promise<DiagramFile[]> {
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
  type: "overview" | "feature" | "diagram";
  featureId?: string;
  diagramId?: string;
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

export async function search(
  query: string,
  tags: string[],
): Promise<{ results: GrepSearchResult[] | TagSearchResult[]; resultType: "grep" | "tag" }> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tags.length > 0) params.set("tags", tags.join(","));
  const res = await fetch(`${BASE}/search?${params.toString()}`);
  return res.json();
}

// --- Scheduler API ---

export interface SchedulerSchedule {
  days: string[];
  times: string[];
}

export interface SchedulerStatus {
  timerActive: boolean;
  nextRun: string | null;
  schedule: SchedulerSchedule;
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const res = await fetch(`${BASE}/scheduler/status`);
  return res.json();
}

export async function enableScheduler(): Promise<{ success: boolean; output: string }> {
  const res = await fetch(`${BASE}/scheduler/enable`, { method: "POST" });
  return res.json();
}

export async function disableScheduler(): Promise<{ success: boolean; output: string }> {
  const res = await fetch(`${BASE}/scheduler/disable`, { method: "POST" });
  return res.json();
}

export async function saveSchedule(
  schedule: SchedulerSchedule,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/scheduler/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  });
  return res.json();
}

// --- Config API ---

export interface AppConfig {
  output_base_dir?: string;
  collect?: {
    sources?: Record<
      string,
      {
        type?: string;
        enabled?: boolean;
        api_key_env?: string;
        endpoint?: string;
        params?: Record<string, string | number>;
        output_file?: string;
      }
    >;
  };
  extract?: {
    association?: {
      enabled?: boolean;
      depth?: string;
    };
  };
  pipeline?: {
    default_source?: string;
  };
  generate?: {
    constraints?: Record<string, string>;
    perspectives?: {
      mode?: string;
      items?: string[];
    };
    agents?: Record<
      string,
      {
        enabled?: boolean;
        model?: string;
        sandbox?: string;
        roles?: string[];
      }
    >;
  };
  notifications?: {
    slack?: {
      enabled?: boolean;
      token_env?: string;
      viewer_host?: string;
      mention?: string;
    };
  };
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/config`);
  return res.json();
}

export async function saveConfig(config: AppConfig): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

// --- Commands API ---

export async function fetchDataSources(): Promise<string[]> {
  const res = await fetch(`${BASE}/commands/data-sources`);
  return res.json();
}

export async function fetchRequirementApps(): Promise<string[]> {
  const res = await fetch(`${BASE}/commands/apps`);
  return res.json();
}

export async function fetchCollectSources(): Promise<string[]> {
  const res = await fetch(`${BASE}/commands/collect-sources`);
  return res.json();
}

export async function fetchDatasetNames(): Promise<string[]> {
  const res = await fetch(`${BASE}/commands/dataset-names`);
  return res.json();
}

export interface CommandEvent {
  type: "start" | "stdout" | "stderr" | "exit" | "error";
  data: string;
}

export async function executeCommand(
  command: string,
  args: string[],
  onEvent: (event: CommandEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/commands/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Unknown error");
  }

  if (!res.body) throw new Error("Response body is null");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        try {
          onEvent(JSON.parse(line) as CommandEvent);
        } catch {}
      }
    }
  }

  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as CommandEvent);
    } catch {}
  }
}

export async function abortCommand(): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/commands/abort`, { method: "POST" });
  return res.json();
}

// --- Pipeline Queue API ---

export interface QueueItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchQueueItems(): Promise<QueueItem[]> {
  const res = await fetch(`${BASE}/queue`);
  return res.json();
}

export async function fetchQueueItem(id: string): Promise<QueueItem> {
  const res = await fetch(`${BASE}/queue/${id}`);
  return res.json();
}

export async function createQueueItem(
  title: string,
  content: string,
): Promise<{ success: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(`${BASE}/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

export async function updateQueueItem(
  id: string,
  data: { title?: string; content?: string },
): Promise<{ success: boolean; item?: QueueItem; error?: string }> {
  const res = await fetch(`${BASE}/queue/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteQueueItem(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/queue/${id}`, { method: "DELETE" });
  return res.json();
}

export async function executeQueueItem(
  id: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${BASE}/queue/${id}/execute`, { method: "POST" });
  return res.json();
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

export async function getGenBranch(): Promise<{ branch: string | null }> {
  const res = await fetch(`${BASE}/git/branch`);
  return res.json();
}

export interface SwitchBranchResult {
  success: boolean;
  branch: string | null;
  output: string;
}

export async function switchGenBranch(): Promise<SwitchBranchResult> {
  const res = await fetch(`${BASE}/git/switch-branch`, { method: "POST" });
  return res.json();
}
