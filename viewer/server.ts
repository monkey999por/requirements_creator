import { exec, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
import { parse } from "yaml";

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

interface DatasetItem {
  appName: string;
  type: "overview" | "feature";
  featureId?: string;
  title?: string;
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

interface SourceInfoJson {
  source?: { directory?: string; collected_at?: string };
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
        tags: tags.slice(0, 2),
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

app.get("/api/mode", (c) => {
  return c.json({ isDev });
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
  const query = c.req.query("q")?.trim();
  const type = c.req.query("type") || "grep";
  if (!query) return c.json({ results: [] });
  if (!existsSync(REQUIREMENTS_DIR)) return c.json({ results: [] });

  if (type === "tag") {
    const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );
    const results = dirs
      .map((d) => {
        const tags = extractTags(join(REQUIREMENTS_DIR, d.name));
        const matched = tags.filter((t) => t.includes(query));
        return matched.length > 0 ? { app: d.name, tags, matchedTags: matched } : null;
      })
      .filter(Boolean);
    return c.json({ results });
  }

  // grep search
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
    return c.json({ results });
  } catch {
    return c.json({ results: [] });
  }
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
