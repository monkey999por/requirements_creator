import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REQUIREMENTS_DIR = resolve(__dirname, "..", "requirements");
const isDev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3001;

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

// --- Server ---
function handleServerError(err: NodeJS.ErrnoException) {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    console.error(`Run: lsof -ti :${port} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
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

    httpServer.on("error", handleServerError);
    httpServer.listen(port, () => {
      console.log(`Dev server: http://localhost:${port}`);
    });
  } else {
    // Production: Hono serves API + static files
    const { serveStatic } = await import("@hono/node-server/serve-static");
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", (c) => c.html(readFileSync(join(__dirname, "dist", "index.html"), "utf-8")));

    const { serve } = await import("@hono/node-server");
    const server = serve({ fetch: app.fetch, port });
    server.on("listening", () => console.log(`Server: http://localhost:${port}`));
    server.on("error", handleServerError);
  }
}

start();
