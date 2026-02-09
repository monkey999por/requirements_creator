import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { parse } from "yaml";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadRequirementsDir(): string {
  try {
    const configPath = resolve(projectRoot, "collect.config.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const config = parse(raw) as { output_base_dir?: string };
    const base = config.output_base_dir ?? "gen";
    return resolve(projectRoot, base, "requirements");
  } catch {
    return resolve(projectRoot, "gen", "requirements");
  }
}

const REQUIREMENTS_DIR = loadRequirementsDir();
const isDev = process.env.NODE_ENV !== "production";
const basePort = Number(process.env.PORT) || 3001;
const MAX_PORT_RETRIES = 10;

// --- API ---
const app = new Hono();
app.use("/api/*", cors());

app.get("/api/apps", (c) => {
  if (!existsSync(REQUIREMENTS_DIR)) return c.json([]);
  const dirs = readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
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
  const filePath = join(REQUIREMENTS_DIR, name, "_source_info.md");
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  return c.json({ content: readFileSync(filePath, "utf-8") });
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
