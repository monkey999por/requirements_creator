import { type ChildProcess, exec, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Document, isMap, parse, parseDocument } from "yaml";

const execAsync = promisify(exec);

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadRequirementsDir(): string {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "requirements");
  } catch {
    return resolve(projectRoot, "gen", "requirements");
  }
}

const REQUIREMENTS_DIR = loadRequirementsDir();

function loadDatasetsDir(): string {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "datasets");
  } catch {
    return resolve(projectRoot, "gen", "datasets");
  }
}

const DATASETS_DIR = loadDatasetsDir();

function loadDataSourceDir(): string {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "data_source");
  } catch {
    return resolve(projectRoot, "gen", "data_source");
  }
}

const DATA_SOURCE_DIR = loadDataSourceDir();

function loadPipelineQueueDir(): string {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "pipeline_queue");
  } catch {
    return resolve(projectRoot, "gen", "pipeline_queue");
  }
}

const PIPELINE_QUEUE_DIR = loadPipelineQueueDir();

interface QueueItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface DatasetItem {
  appName: string;
  type: "overview" | "feature";
  featureId?: string;
  title?: string;
}

interface FavoriteItem {
  appName: string;
  type: "overview" | "feature" | "diagram";
  featureId?: string;
  diagramId?: string;
  title?: string;
}

function loadFavoritesPath(): string {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "favorite.json");
  } catch {
    return resolve(projectRoot, "gen", "favorite.json");
  }
}

const FAVORITES_PATH = loadFavoritesPath();

function readFavorites(): FavoriteItem[] {
  if (!existsSync(FAVORITES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(FAVORITES_PATH, "utf-8")) as FavoriteItem[];
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteItem[]): void {
  const dir = resolve(FAVORITES_PATH, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FAVORITES_PATH, JSON.stringify(items, null, 2), "utf-8");
}

interface Dataset {
  name: string;
  createdAt: string;
  items: DatasetItem[];
}

const isDev = process.env.NODE_ENV !== "production";
const basePort = Number(process.env.PORT) || 3001;
const MAX_PORT_RETRIES = 10;

// --- API ---
const app = new Hono();
app.use("/api/*", cors());

interface DatasetSourceApp {
  appName: string;
  type: "overview" | "feature";
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

function readSourceInfo(appDir: string): SourceInfoJson | null {
  const sourceInfoPath = join(appDir, "_source_info.json");
  if (!existsSync(sourceInfoPath)) return null;
  try {
    return JSON.parse(readFileSync(sourceInfoPath, "utf-8")) as SourceInfoJson;
  } catch {
    return null;
  }
}

function extractTags(appDir: string): string[] {
  const info = readSourceInfo(appDir);
  return info?.tags ?? [];
}

app.get("/api/apps", (c) => {
  if (!existsSync(REQUIREMENTS_DIR)) return c.json([]);
  const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const appDir = join(REQUIREMENTS_DIR, d.name);
      const tags = extractTags(appDir);
      return {
        name: d.name,
        tags: tags.slice(0, 3),
        mtime: statSync(appDir).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ name, tags }) => ({ name, tags }));
  return c.json(dirs);
});

app.get("/api/apps/:name/overview", (c) => {
  const name = c.req.param("name");
  const filePath = join(REQUIREMENTS_DIR, name, "overview.md");
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  return c.json({ content: readFileSync(filePath, "utf-8") });
});

app.get("/api/apps/:name/features", (c) => {
  const name = c.req.param("name");
  const featuresDir = join(REQUIREMENTS_DIR, name, "features");
  if (!existsSync(featuresDir)) return c.json([]);
  const files = readdirSync(featuresDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const content = readFileSync(join(featuresDir, f), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      const summaryMatch = content.match(/## 概要\s*\n+([\s\S]*?)(?=\n## )/);
      const summary = summaryMatch ? summaryMatch[1].trim().split("\n")[0] : "";
      return {
        id: f.replace(".md", ""),
        filename: f,
        title: titleMatch?.[1] ?? f,
        summary,
      };
    });
  return c.json(files);
});

app.get("/api/apps/:name/features/:featureId", (c) => {
  const { name, featureId } = c.req.param();
  const filePath = join(REQUIREMENTS_DIR, name, "features", `${featureId}.md`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  return c.json({ content: readFileSync(filePath, "utf-8") });
});

app.get("/api/apps/:name/source-info", (c) => {
  const name = c.req.param("name");
  const appDir = join(REQUIREMENTS_DIR, name);
  const info = readSourceInfo(appDir);
  if (!info) return c.json({ error: "Not found" }, 404);
  return c.json(info);
});

app.get("/api/apps/:name/config", (c) => {
  const name = c.req.param("name");
  const configPath = join(REQUIREMENTS_DIR, name, "_config.yaml");
  if (!existsSync(configPath)) return c.json({ error: "Not found" }, 404);
  return c.json({ content: readFileSync(configPath, "utf-8") });
});

app.get("/api/tags", (c) => {
  const tagsPath = resolve(projectRoot, "gen", "tags.json");
  if (!existsSync(tagsPath)) return c.json([]);
  try {
    return c.json(JSON.parse(readFileSync(tagsPath, "utf-8")));
  } catch {
    return c.json([]);
  }
});

app.get("/api/mode", (c) => {
  return c.json({ isDev });
});

app.get("/api/apps/:name/diagrams", (c) => {
  const name = c.req.param("name");
  const diagramsDir = join(REQUIREMENTS_DIR, name, "diagrams");
  if (!existsSync(diagramsDir)) return c.json([]);
  const files = readdirSync(diagramsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const content = readFileSync(join(diagramsDir, f), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      return {
        id: f.replace(".md", ""),
        filename: f,
        title: titleMatch?.[1] ?? f,
        content,
      };
    });
  return c.json(files);
});

app.get("/api/apps/:name/memo", (c) => {
  const name = c.req.param("name");
  const filePath = join(REQUIREMENTS_DIR, name, "memo.md");
  if (!existsSync(filePath)) return c.json({ content: "" });
  return c.json({ content: readFileSync(filePath, "utf-8") });
});

app.post("/api/apps/:name/memo", async (c) => {
  if (!isDev) return c.json({ error: "Editing is only available in dev mode" }, 403);
  const name = c.req.param("name");
  const filePath = join(REQUIREMENTS_DIR, name, "memo.md");
  const body = await c.req.json<{ content: string }>();
  writeFileSync(filePath, body.content, "utf-8");
  return c.json({ success: true });
});

// --- Dataset API ---
app.get("/api/datasets", (c) => {
  if (!existsSync(DATASETS_DIR)) return c.json([]);
  const files = readdirSync(DATASETS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const datasets = files.map((f) => {
    return JSON.parse(readFileSync(join(DATASETS_DIR, f), "utf-8")) as Dataset;
  });
  return c.json(datasets);
});

app.get("/api/datasets/:name", (c) => {
  const name = c.req.param("name");
  const filePath = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  return c.json(JSON.parse(readFileSync(filePath, "utf-8")) as Dataset);
});

app.post("/api/datasets", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const body = await c.req.json<{ name: string }>();
  if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name)) {
    return c.json({ error: "名前は英数字・ハイフン・アンダースコアのみ使用可能です" }, 400);
  }
  if (!existsSync(DATASETS_DIR)) mkdirSync(DATASETS_DIR, { recursive: true });
  const filePath = join(DATASETS_DIR, `${body.name}.json`);
  if (existsSync(filePath)) return c.json({ error: "同名のデータセットが既に存在します" }, 409);
  const dataset: Dataset = { name: body.name, createdAt: new Date().toISOString(), items: [] };
  writeFileSync(filePath, JSON.stringify(dataset, null, 2), "utf-8");
  return c.json({ success: true });
});

app.delete("/api/datasets/:name", (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const name = c.req.param("name");
  const filePath = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  unlinkSync(filePath);
  return c.json({ success: true });
});

app.post("/api/datasets/:name/items", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const name = c.req.param("name");
  const filePath = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const dataset = JSON.parse(readFileSync(filePath, "utf-8")) as Dataset;
  const item = await c.req.json<DatasetItem>();
  const exists = dataset.items.some(
    (i) => i.appName === item.appName && i.type === item.type && i.featureId === item.featureId,
  );
  if (exists) return c.json({ error: "このアイテムは既にデータセットに含まれています" }, 409);
  dataset.items.push(item);
  writeFileSync(filePath, JSON.stringify(dataset, null, 2), "utf-8");
  return c.json({ success: true });
});

app.delete("/api/datasets/:name/items", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const name = c.req.param("name");
  const filePath = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const dataset = JSON.parse(readFileSync(filePath, "utf-8")) as Dataset;
  const item = await c.req.json<DatasetItem>();
  dataset.items = dataset.items.filter(
    (i) => !(i.appName === item.appName && i.type === item.type && i.featureId === item.featureId),
  );
  writeFileSync(filePath, JSON.stringify(dataset, null, 2), "utf-8");
  return c.json({ success: true });
});

app.post("/api/datasets/:name/generate", (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const name = c.req.param("name");
  const filePath = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const dataset = JSON.parse(readFileSync(filePath, "utf-8")) as Dataset;
  if (dataset.items.length === 0) {
    return c.json({ error: "データセットにアイテムがありません" }, 400);
  }
  const child = spawn("tsx", ["scripts/pipeline.ts", "--dataset", name], {
    cwd: projectRoot,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  return c.json({
    success: true,
    message: "パイプラインを開始しました。完了後アプリ一覧を更新してください。",
  });
});

// --- Dataset generated apps lookup ---
app.get("/api/datasets/:name/generated-apps", (c) => {
  const name = c.req.param("name");
  if (!existsSync(REQUIREMENTS_DIR)) return c.json([]);
  const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );
  const generatedApps: string[] = [];
  for (const d of dirs) {
    const info = readSourceInfo(join(REQUIREMENTS_DIR, d.name));
    if (info?.dataset?.name === name) {
      generatedApps.push(d.name);
    }
  }
  return c.json(generatedApps);
});

// --- Search API ---
app.get("/api/apps-with-tags", (c) => {
  if (!existsSync(REQUIREMENTS_DIR)) return c.json([]);
  const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const result = dirs.map((d) => ({
    name: d.name,
    tags: extractTags(join(REQUIREMENTS_DIR, d.name)),
  }));
  return c.json(result);
});

app.get("/api/search", async (c) => {
  const query = c.req.query("q")?.trim() || "";
  const tagsParam = c.req.query("tags")?.trim() || "";
  const selectedTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  if (!query && selectedTags.length === 0) return c.json({ results: [] });
  if (!existsSync(REQUIREMENTS_DIR)) return c.json({ results: [] });

  // タグのみ検索
  if (!query && selectedTags.length > 0) {
    const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );
    const results = dirs
      .map((d) => {
        const tags = extractTags(join(REQUIREMENTS_DIR, d.name));
        const matched = selectedTags.filter((st) => tags.includes(st));
        return matched.length === selectedTags.length
          ? { app: d.name, tags, matchedTags: matched }
          : null;
      })
      .filter(Boolean);
    return c.json({ results, resultType: "tag" });
  }

  // grep検索（タグフィルタ付きの可能性あり）
  const tagFilterApps =
    selectedTags.length > 0
      ? new Set(
          readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .filter((d) => {
              const tags = extractTags(join(REQUIREMENTS_DIR, d.name));
              return selectedTags.every((st) => tags.includes(st));
            })
            .map((d) => d.name),
        )
      : null;

  try {
    const { stdout } = await execAsync(
      `grep -rn --include='*.md' --include='*.json' ${JSON.stringify(query)} ${JSON.stringify(REQUIREMENTS_DIR)}`,
      { maxBuffer: 1024 * 1024 },
    );
    const lines = stdout.trim().split("\n").filter(Boolean);
    const grouped: Record<string, { file: string; matches: { line: number; text: string }[] }[]> =
      {};
    for (const line of lines.slice(0, 200)) {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (!match) continue;
      const [, fullPath, lineNum, text] = match;
      const relPath = fullPath.replace(`${REQUIREMENTS_DIR}/`, "");
      const parts = relPath.split("/");
      const app = parts[0];
      if (tagFilterApps && !tagFilterApps.has(app)) continue;
      const file = parts.slice(1).join("/");
      if (!grouped[app]) grouped[app] = [];
      let entry = grouped[app].find((e) => e.file === file);
      if (!entry) {
        entry = { file, matches: [] };
        grouped[app].push(entry);
      }
      entry.matches.push({ line: Number(lineNum), text: text.trim() });
    }
    const results = Object.entries(grouped).map(([app, files]) => ({ app, files }));
    return c.json({ results, resultType: "grep" });
  } catch {
    return c.json({ results: [], resultType: "grep" });
  }
});

// --- Config API ---
app.get("/api/config", (c) => {
  const configPath = resolve(projectRoot, "app.config.yaml");
  if (!existsSync(configPath)) return c.json({ error: "Not found" }, 404);
  const raw = readFileSync(configPath, "utf-8");
  return c.json(parse(raw));
});

// Document APIでコメントを保持したまま値を差分更新する
function applyToDocument(
  doc: Document,
  incoming: Record<string, unknown>,
  path: (string | number)[] = [],
) {
  const node = path.length === 0 ? doc.contents : doc.getIn(path, true);

  for (const [key, value] of Object.entries(incoming)) {
    const childPath = [...path, key];
    if (value === null || value === undefined) {
      // null/undefined → キーごと削除ではなく null をセット（コメント付きキーを残す）
      doc.setIn(childPath, null);
    } else if (Array.isArray(value)) {
      doc.setIn(childPath, value);
    } else if (typeof value === "object") {
      // 既存ノードがマップなら再帰、なければ丸ごとセット
      const existing = doc.getIn(childPath, true);
      if (isMap(existing)) {
        applyToDocument(doc, value as Record<string, unknown>, childPath);
        // incoming に無いキーを削除
        for (const item of existing.items) {
          const k = typeof item.key === "object" && "value" in item.key ? item.key.value : item.key;
          if (!(String(k) in (value as Record<string, unknown>))) {
            doc.deleteIn([...childPath, String(k)]);
          }
        }
      } else {
        doc.setIn(childPath, value);
      }
    } else {
      doc.setIn(childPath, value);
    }
  }

  // トップレベルで incoming に無いキーを削除
  if (isMap(node)) {
    for (const item of node.items) {
      const k = typeof item.key === "object" && "value" in item.key ? item.key.value : item.key;
      if (!(String(k) in incoming)) {
        doc.deleteIn([...path, String(k)]);
      }
    }
  }
}

app.put("/api/config", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const configPath = resolve(projectRoot, "app.config.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const doc = parseDocument(raw);
  const body = await c.req.json();
  applyToDocument(doc, body);
  writeFileSync(configPath, doc.toString(), "utf-8");
  return c.json({ success: true });
});

// --- Favorites API ---
app.get("/api/favorites", (c) => {
  return c.json(readFavorites());
});

app.post("/api/favorites", async (c) => {
  const item = await c.req.json<FavoriteItem>();
  const favorites = readFavorites();
  const exists = favorites.some(
    (f) =>
      f.appName === item.appName &&
      f.type === item.type &&
      f.featureId === item.featureId &&
      f.diagramId === item.diagramId,
  );
  if (exists) return c.json({ error: "既にお気に入りに登録されています" }, 409);
  favorites.push(item);
  writeFavorites(favorites);
  return c.json({ success: true });
});

app.delete("/api/favorites", async (c) => {
  const item = await c.req.json<FavoriteItem>();
  const favorites = readFavorites();
  const filtered = favorites.filter(
    (f) =>
      !(
        f.appName === item.appName &&
        f.type === item.type &&
        f.featureId === item.featureId &&
        f.diagramId === item.diagramId
      ),
  );
  writeFavorites(filtered);
  return c.json({ success: true });
});

// --- Pipeline Queue API ---

function readQueueItems(): QueueItem[] {
  if (!existsSync(PIPELINE_QUEUE_DIR)) return [];
  return readdirSync(PIPELINE_QUEUE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(PIPELINE_QUEUE_DIR, f), "utf-8")) as QueueItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is QueueItem => item !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

app.get("/api/queue", (c) => {
  return c.json(readQueueItems());
});

app.get("/api/queue/:id", (c) => {
  const id = c.req.param("id");
  const filePath = join(PIPELINE_QUEUE_DIR, `${id}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  return c.json(JSON.parse(readFileSync(filePath, "utf-8")) as QueueItem);
});

app.post("/api/queue", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const body = await c.req.json<{ title: string; content: string }>();
  if (!body.title?.trim()) return c.json({ error: "タイトルは必須です" }, 400);
  if (!body.content?.trim()) return c.json({ error: "内容は必須です" }, 400);

  if (!existsSync(PIPELINE_QUEUE_DIR)) mkdirSync(PIPELINE_QUEUE_DIR, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const item: QueueItem = {
    id,
    title: body.title.trim(),
    content: body.content.trim(),
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(join(PIPELINE_QUEUE_DIR, `${id}.json`), JSON.stringify(item, null, 2), "utf-8");
  return c.json({ success: true, item });
});

app.put("/api/queue/:id", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const id = c.req.param("id");
  const filePath = join(PIPELINE_QUEUE_DIR, `${id}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);

  const existing = JSON.parse(readFileSync(filePath, "utf-8")) as QueueItem;
  const body = await c.req.json<{ title?: string; content?: string }>();

  if (body.title !== undefined) existing.title = body.title.trim();
  if (body.content !== undefined) existing.content = body.content.trim();
  existing.updatedAt = new Date().toISOString();

  writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
  return c.json({ success: true, item: existing });
});

// キュー即時実行（バックグラウンド）
app.post("/api/queue/:id/execute", (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const id = c.req.param("id");
  const filePath = join(PIPELINE_QUEUE_DIR, `${id}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const item = JSON.parse(readFileSync(filePath, "utf-8")) as QueueItem;

  // data_source にディレクトリを作成し user_proposal.md を配置
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
  const sourceDir = join(DATA_SOURCE_DIR, ts);
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, "user_proposal.md"), `# ${item.title}\n\n${item.content}`, "utf-8");

  // バックグラウンドでパイプライン実行（detached + unref）
  const child = spawn("tsx", ["scripts/pipeline.ts", "--skip-collect", "--source", ts], {
    cwd: projectRoot,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  return c.json({
    success: true,
    message: `「${item.title}」のパイプラインをバックグラウンドで開始しました。`,
  });
});

app.delete("/api/queue/:id", (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  const id = c.req.param("id");
  const filePath = join(PIPELINE_QUEUE_DIR, `${id}.json`);
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const rejectedDir = join(PIPELINE_QUEUE_DIR, "..", "pipeline_queue_rejected");
  if (!existsSync(rejectedDir)) mkdirSync(rejectedDir, { recursive: true });
  renameSync(filePath, join(rejectedDir, `${id}.json`));
  return c.json({ success: true });
});

// --- Git API ---
app.post("/api/git/commit-push", async (c) => {
  if (!isDev) return c.json({ error: "Only available in dev mode" }, 403);

  const genDir = resolve(REQUIREMENTS_DIR, "..");
  const logs: string[] = [];

  try {
    await execAsync("git rev-parse --git-dir", { cwd: genDir });
  } catch {
    return c.json({
      success: false,
      output: "Error: gen ディレクトリに git リポジトリが見つかりません",
    });
  }

  try {
    const add = await execAsync("git add .", { cwd: genDir });
    logs.push("$ git add .");
    if (add.stdout.trim()) logs.push(add.stdout.trim());
    if (add.stderr.trim()) logs.push(add.stderr.trim());
  } catch (err: unknown) {
    const e = err as { message: string };
    logs.push("$ git add .", e.message);
    return c.json({ success: false, output: logs.join("\n") });
  }

  try {
    const commit = await execAsync('git commit -m "update"', { cwd: genDir });
    logs.push('$ git commit -m "update"');
    if (commit.stdout.trim()) logs.push(commit.stdout.trim());
    if (commit.stderr.trim()) logs.push(commit.stderr.trim());
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    logs.push('$ git commit -m "update"');
    const output = `${e.stdout || ""}${e.stderr || ""}`.trim();
    if (output.includes("nothing to commit")) {
      logs.push(output);
      return c.json({ success: true, output: logs.join("\n") });
    }
    logs.push(output || e.message);
    return c.json({ success: false, output: logs.join("\n") });
  }

  try {
    const push = await execAsync("git push", { cwd: genDir });
    logs.push("$ git push");
    if (push.stdout.trim()) logs.push(push.stdout.trim());
    if (push.stderr.trim()) logs.push(push.stderr.trim());
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    logs.push("$ git push");
    const output = `${e.stdout || ""}${e.stderr || ""}`.trim();
    logs.push(output || e.message);
    return c.json({ success: false, output: logs.join("\n") });
  }

  return c.json({ success: true, output: logs.join("\n") });
});

app.get("/api/git/branch", async (c) => {
  const genDir = resolve(REQUIREMENTS_DIR, "..");
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: genDir });
    return c.json({ branch: stdout.trim() });
  } catch {
    return c.json({ branch: null });
  }
});

app.post("/api/git/switch-branch", async (c) => {
  if (!isDev) return c.json({ error: "Only available in dev mode" }, 403);

  const genDir = resolve(REQUIREMENTS_DIR, "..");

  // 現在のブランチを取得
  let currentBranch: string;
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: genDir });
    currentBranch = stdout.trim();
  } catch {
    return c.json({
      success: false,
      branch: null,
      output: "Error: gen ディレクトリに git リポジトリが見つかりません",
    });
  }

  const targetBranch = currentBranch === "main" ? "develop" : "main";

  try {
    const { stdout, stderr } = await execAsync(`git checkout ${targetBranch}`, { cwd: genDir });
    const output = [stdout, stderr].filter((s) => s.trim()).join("\n");
    return c.json({
      success: true,
      branch: targetBranch,
      output: output || `${targetBranch} に切り替えました`,
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    const output = `${e.stdout || ""}${e.stderr || ""}`.trim() || e.message;
    // 失敗時も現在ブランチを再取得
    let branch = currentBranch;
    try {
      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: genDir });
      branch = stdout.trim();
    } catch {}
    return c.json({ success: false, branch, output });
  }
});

// --- Commands API (dev mode only) ---

const ALLOWED_COMMANDS: Record<string, { bin: string; baseArgs: string[] }> = {
  collect: { bin: "tsx", baseArgs: ["scripts/collect.ts"] },
  extract: { bin: "bash", baseArgs: ["scripts/extract.sh"] },
  generate: { bin: "bash", baseArgs: ["scripts/generate.sh"] },
  regenerate: { bin: "bash", baseArgs: ["scripts/regenerate.sh"] },
  validate: { bin: "tsx", baseArgs: ["scripts/validate-requirements.ts"] },
  pipeline: { bin: "tsx", baseArgs: ["scripts/pipeline.ts"] },
};

let activeCommandProcess: ChildProcess | null = null;

app.get("/api/commands/data-sources", (c) => {
  if (!existsSync(DATA_SOURCE_DIR)) return c.json([]);
  return c.json(
    readdirSync(DATA_SOURCE_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse(),
  );
});

app.get("/api/commands/apps", (c) => {
  if (!existsSync(REQUIREMENTS_DIR)) return c.json([]);
  return c.json(
    readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort(),
  );
});

app.get("/api/commands/collect-sources", (c) => {
  try {
    const configPath = resolve(projectRoot, "app.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as {
      collect?: { sources?: Record<string, { enabled?: boolean }> };
    };
    return c.json(Object.keys(config.collect?.sources ?? {}));
  } catch {
    return c.json([]);
  }
});

app.get("/api/commands/dataset-names", (c) => {
  if (!existsSync(DATASETS_DIR)) return c.json([]);
  return c.json(
    readdirSync(DATASETS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort(),
  );
});

app.post("/api/commands/execute", async (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);

  const body = await c.req.json<{ command: string; args: string[] }>();
  const cmdDef = ALLOWED_COMMANDS[body.command];
  if (!cmdDef) return c.json({ error: "Unknown command" }, 400);

  // generate コマンドの --dataset 前処理: ソースファイル生成 + args 変換
  let processedArgs = body.args ?? [];
  if (body.command === "generate") {
    const datasetIdx = processedArgs.indexOf("--dataset");
    if (datasetIdx !== -1 && datasetIdx + 1 < processedArgs.length) {
      const dsName = processedArgs[datasetIdx + 1];
      const dsPath = join(DATASETS_DIR, `${dsName}.json`);
      if (!existsSync(dsPath)) {
        return c.json({ error: `データセット ${dsName} が見つかりません` }, 400);
      }
      const ds = JSON.parse(readFileSync(dsPath, "utf-8")) as Dataset;
      if (ds.items.length === 0) {
        return c.json({ error: "データセットにアイテムがありません" }, 400);
      }
      // buildDatasetSource 相当のロジック
      const sections: string[] = [];
      sections.push(`# データセットソース: ${ds.name}\n`);
      sections.push("以下は複数のアプリ要件から選択されたOverviewとFeatureの組み合わせです。");
      sections.push("これらをインスピレーションとして、新しいアプリ要件を生成してください。\n");
      for (const item of ds.items) {
        if (item.type === "overview") {
          const fp = join(REQUIREMENTS_DIR, item.appName, "overview.md");
          if (existsSync(fp)) {
            const content = readFileSync(fp, "utf-8");
            sections.push(`---\n## ${item.appName} - Overview\n\n${content}\n`);
          }
        } else if (item.type === "feature" && item.featureId) {
          const fp = join(REQUIREMENTS_DIR, item.appName, "features", `${item.featureId}.md`);
          if (existsSync(fp)) {
            const content = readFileSync(fp, "utf-8");
            sections.push(
              `---\n## ${item.appName} - Feature: ${item.title ?? item.featureId}\n\n${content}\n`,
            );
          }
        }
      }
      const sourceMd = sections.join("\n");
      if (!existsSync(DATASETS_DIR)) mkdirSync(DATASETS_DIR, { recursive: true });
      const sourceFilePath = join(DATASETS_DIR, `${dsName}_source.md`);
      writeFileSync(sourceFilePath, sourceMd, "utf-8");
      // args を変換: --dataset <name> → --dataset-source <path> --dataset-name <name>
      processedArgs = [
        ...processedArgs.slice(0, datasetIdx),
        ...processedArgs.slice(datasetIdx + 2),
        "--dataset-source",
        sourceFilePath,
        "--dataset-name",
        dsName,
      ];
    }
  }

  const allArgs = [...cmdDef.baseArgs, ...processedArgs];
  const encoder = new TextEncoder();

  const child = spawn(cmdDef.bin, allArgs, {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  activeCommandProcess = child;

  const readable = new ReadableStream({
    start(controller) {
      const send = (type: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type, data })}\n`));
        } catch {}
      };

      send("start", `$ ${body.command}${body.args?.length ? ` ${body.args.join(" ")}` : ""}`);

      child.stdout?.on("data", (chunk: Buffer) => send("stdout", chunk.toString()));
      child.stderr?.on("data", (chunk: Buffer) => send("stderr", chunk.toString()));

      child.on("close", (code) => {
        send("exit", String(code ?? 1));
        activeCommandProcess = null;
        try {
          controller.close();
        } catch {}
      });
      child.on("error", (err) => {
        send("error", err.message);
        activeCommandProcess = null;
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (child.pid) {
        try {
          process.kill(child.pid, "SIGTERM");
        } catch {}
      }
      activeCommandProcess = null;
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

app.post("/api/commands/abort", (c) => {
  if (!isDev) return c.json({ error: "Dev mode only" }, 403);
  if (activeCommandProcess?.pid) {
    try {
      process.kill(activeCommandProcess.pid, "SIGTERM");
    } catch {}
    activeCommandProcess = null;
    return c.json({ success: true });
  }
  return c.json({ success: false, message: "No active command" });
});

// --- Server ---
function tryListen(server: ReturnType<typeof createServer>, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener("listening", onListening);
      if (err.code === "EADDRINUSE") {
        if (port - basePort < MAX_PORT_RETRIES) {
          const next = port + 1;
          console.warn(`Port ${port} is in use, trying ${next}...`);
          resolve(tryListen(server, next));
        } else {
          reject(new Error(`Ports ${basePort}-${port} are all in use.`));
        }
      } else {
        reject(err);
      }
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve(port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

async function start() {
  const { getRequestListener } = await import("@hono/node-server");

  if (isDev) {
    // Dev: Vite middleware + Hono API on single port
    const { createServer: createViteServer } = await import("vite");

    const httpServer = createServer();
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });

    const apiHandler = getRequestListener(app.fetch);

    httpServer.on("request", (req, res) => {
      if (req.url?.startsWith("/api/")) {
        apiHandler(req, res);
      } else {
        vite.middlewares.handle(req, res);
      }
    });

    const actualPort = await tryListen(httpServer, basePort);
    console.log(`Dev server: http://localhost:${actualPort}`);
  } else {
    // Production: Hono serves API + static files
    const { serveStatic } = await import("@hono/node-server/serve-static");
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", (c) => c.html(readFileSync(join(__dirname, "dist", "index.html"), "utf-8")));

    const httpServer = createServer(getRequestListener(app.fetch));
    const actualPort = await tryListen(httpServer, basePort);
    console.log(`Server: http://localhost:${actualPort}`);
  }
}

start();
