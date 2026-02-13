const http = require("http");
const fs = require("fs");
const path = require("path");

loadDotEnv(path.join(process.cwd(), ".env"));

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();

const SIMSIMI_API_KEY = process.env.SIMSIMI_API_KEY || "";
const SIMSIMI_API_VERSION = process.env.SIMSIMI_API_VERSION || "190410";
const SIMSIMI_API_BASE_URL = process.env.SIMSIMI_API_BASE_URL || "https://wsapi.simsimi.com";
const SIMSIMI_TIMEOUT_MS = Number(process.env.SIMSIMI_TIMEOUT_MS || 10000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] != null) continue;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function resolveCorsOrigin(origin) {
  if (!origin) return "*";
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return "";
}

function safeResolveFile(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const absolutePath = path.resolve(ROOT, "." + relativePath);
  if (!absolutePath.startsWith(ROOT)) return null;
  return absolutePath;
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function requestSimsimiReply({ message, lang, talkKey }) {
  if (!SIMSIMI_API_KEY) {
    return { ok: false, statusCode: 500, error: "SIMSIMI_API_KEY is missing" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIMSIMI_TIMEOUT_MS);

  const endpoint = `${SIMSIMI_API_BASE_URL}/${SIMSIMI_API_VERSION}/talk`;
  const payload = {
    utext: message,
    lang: lang || "ko",
  };
  if (talkKey) payload.talkKey = talkKey;

  try {
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SIMSIMI_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await upstreamRes.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!upstreamRes.ok) {
      return {
        ok: false,
        statusCode: upstreamRes.status,
        error: parsed?.message || parsed?.msg || "simsimi_upstream_error",
        details: parsed,
      };
    }

    const reply =
      parsed?.atext ||
      parsed?.response ||
      parsed?.reply ||
      parsed?.data?.atext ||
      "";

    if (!reply || !String(reply).trim()) {
      return {
        ok: false,
        statusCode: 502,
        error: "empty_reply",
        details: parsed,
      };
    }

    return {
      ok: true,
      statusCode: 200,
      reply: String(reply).trim(),
      talkKey: parsed?.talkKey || parsed?.id || null,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      error: err?.name === "AbortError" ? "upstream_timeout" : "upstream_fetch_failed",
      details: String(err?.message || err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleApiChat(req, res) {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const message = String(body?.message || "").trim();
    const lang = String(body?.lang || "ko").trim();
    const talkKey = body?.talkKey ? String(body.talkKey).trim() : "";

    if (!message) {
      return sendJson(res, 400, { error: "message is required" });
    }

    const result = await requestSimsimiReply({ message, lang, talkKey });
    if (!result.ok) {
      return sendJson(res, result.statusCode || 502, {
        error: result.error || "chat_failed",
        details: result.details || null,
      });
    }

    return sendJson(res, 200, {
      reply: result.reply,
      talkKey: result.talkKey,
    });
  } catch (err) {
    return sendJson(res, 500, {
      error: "server_error",
      details: String(err?.message || err),
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  if (req.url.startsWith("/api/chat")) {
    const corsOrigin = resolveCorsOrigin(req.headers.origin || "");
    if (!corsOrigin) {
      sendJson(res, 403, { error: "origin_not_allowed" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  if (req.method === "POST" && req.url.startsWith("/api/chat")) {
    await handleApiChat(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const filePath = safeResolveFile(req.url);
  if (!filePath) {
    sendJson(res, 403, { error: "forbidden_path" });
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => sendJson(res, 500, { error: "read_failed" }));
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const keyStatus = SIMSIMI_API_KEY ? "configured" : "missing";
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] SIMSIMI_API_KEY: ${keyStatus}`);
});
