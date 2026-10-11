#!/usr/bin/env node
// Standalone static server + /jev proxy for the Relay experimental demo.
// Reuses the .env parsing approach from scripts/gen-config.mjs so JEV_API_KEY
// never reaches the browser — the browser only ever talks to this local server.
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const port = Number(process.env.PORT) || 8787;

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let env = {};
try {
  env = parseEnv(readFileSync(join(repoRoot, ".env"), "utf8"));
} catch {
  console.error(`No .env found at ${join(repoRoot, ".env")}. Create one with JEV_API_KEY=...`);
}

const JEV_API_KEY = env.JEV_API_KEY || "";
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

if (!JEV_API_KEY) {
  console.warn("Warning: JEV_API_KEY is empty — /jev requests will fail with 500.");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = normalize(join(here, urlPath));
  if (!filePath.startsWith(here) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  const type = MIME[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

function proxyJev(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (!JEV_API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "server missing JEV_API_KEY" }));
      return;
    }

    const url = new URL(JEV_ENDPOINT);
    const upstream = httpsRequest(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${JEV_API_KEY}`,
        },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, {
          "Content-Type": upstreamRes.headers["content-type"] || "application/json",
        });
        upstreamRes.pipe(res);
      }
    );
    upstream.on("error", (err) => {
      console.error("jev proxy error:", err.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream request failed" }));
    });
    upstream.end(body);
  });
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/jev") {
    proxyJev(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Relay demo running at http://localhost:${port}`);
});
