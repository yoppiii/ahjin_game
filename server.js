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
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const XAI_MODEL = process.env.XAI_MODEL || "grok-2-latest";
const XAI_API_BASE_URL = process.env.XAI_API_BASE_URL || "https://api.x.ai/v1";
const XAI_TIMEOUT_MS = Number(process.env.XAI_TIMEOUT_MS || 12000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 12000);
const SESSION_MAX_TURNS = Number(process.env.SESSION_MAX_TURNS || 8);
const DEFAULT_PERSONA = String(process.env.DEFAULT_PERSONA || "ahjin").trim() || "ahjin";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const chatSessions = new Map();
const RABBIT_TV_CHANNEL_URL =
  process.env.RABBIT_TV_CHANNEL_URL ||
  "https://www.youtube.com/@%EB%94%B8%EC%B4%88%EA%B5%AC%EB%A6%84";
const YOUTUBE_TIMEOUT_MS = Number(process.env.YOUTUBE_TIMEOUT_MS || 8000);

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

const PERSONA_PRESETS = {
  ahjin: {
    label: "토끼봇 (기본)",
    ko: "너는 아진이 게임 방송 채팅 도우미 '토끼봇'이다. 밝고 귀엽고 친근하게 답해. 답변은 1~3문장으로 짧게. 모르면 솔직히 모른다고 말해.",
    en: "You are Tokkibot for Ahjin Game livestream chat. Friendly, upbeat, concise (1-3 short sentences), and honest when unsure.",
  },
  luna: {
    label: "루나 (새 페르소나)",
    ko: "너는 아진이 게임 전용 페르소나 '루나'다. 말투는 차분하고 다정한 언니 느낌. 짧지만 센스 있게 답하고, 응원·공감·가벼운 유머를 섞어라. 과장이나 사실 단정은 피하라.",
    en: "You are 'Luna', a calm and warm persona for Ahjin Game chat. Keep replies concise, empathetic, lightly witty, and avoid confident claims without basis.",
  },
  coach: {
    label: "코치", 
    ko: "너는 게임 채팅 코치다. 핵심만 빠르게 알려주고 실용적인 다음 행동 1개를 제안해. 군더더기 없이 1~2문장으로 답해.",
    en: "You are a practical game chat coach. Give concise, actionable advice with one clear next step in 1-2 sentences.",
  },
};

function normalizePersona(input) {
  const key = String(input || "").trim().toLowerCase();
  if (key && PERSONA_PRESETS[key]) return key;
  if (PERSONA_PRESETS[DEFAULT_PERSONA]) return DEFAULT_PERSONA;
  return "ahjin";
}

function getSystemInstruction({ lang, persona }) {
  const key = normalizePersona(persona);
  const preset = PERSONA_PRESETS[key] || PERSONA_PRESETS.ahjin;
  return lang === "ko" ? preset.ko : preset.en;
}

function listPersonas() {
  return Object.entries(PERSONA_PRESETS).map(([id, v]) => ({ id, label: v.label }));
}

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

async function fetchTextWithTimeout(url, timeoutMs = YOUTUBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`upstream_${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sampleOne(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items[Math.floor(Math.random() * items.length)] || "";
}

function uniqueVideoIds(list) {
  const valid = new Set();
  for (const id of list || []) {
    const v = String(id || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(v)) valid.add(v);
  }
  return [...valid];
}

function extractVideoIdsFromHtml(html) {
  const all = [];
  const watchRe = /\/watch\?v=([A-Za-z0-9_-]{11})/g;
  const idRe = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  const shortRe = /\/shorts\/([A-Za-z0-9_-]{11})/g;
  let m;
  while ((m = watchRe.exec(html))) all.push(m[1]);
  while ((m = idRe.exec(html))) all.push(m[1]);
  while ((m = shortRe.exec(html))) all.push(m[1]);
  return uniqueVideoIds(all);
}

function extractChannelIdFromHtml(html) {
  const m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/);
  return m ? m[1] : "";
}

function extractVideoIdsFromFeedXml(xml) {
  const ids = [];
  const re = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g;
  let m;
  while ((m = re.exec(xml))) ids.push(m[1]);
  return uniqueVideoIds(ids);
}

async function pickRandomRabbitVideoId() {
  const base = RABBIT_TV_CHANNEL_URL.replace(/\/+$/, "");
  const videosPageUrl = `${base}/videos`;
  const mainHtml = await fetchTextWithTimeout(videosPageUrl);
  let ids = extractVideoIdsFromHtml(mainHtml);
  if (ids.length > 0) return sampleOne(ids);

  const channelId = extractChannelIdFromHtml(mainHtml);
  if (channelId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feedXml = await fetchTextWithTimeout(feedUrl);
    ids = extractVideoIdsFromFeedXml(feedXml);
    if (ids.length > 0) return sampleOne(ids);
  }

  const fallbackHtml = await fetchTextWithTimeout(base);
  ids = extractVideoIdsFromHtml(fallbackHtml);
  if (ids.length > 0) return sampleOne(ids);

  throw new Error("no_video_found");
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

function getSessionHistory(sessionId) {
  if (!sessionId) return [];
  return chatSessions.get(sessionId) || [];
}

function saveSessionTurn(sessionId, userText, botText) {
  if (!sessionId) return;
  const history = chatSessions.get(sessionId) || [];
  history.push({ user: userText, assistant: botText });
  while (history.length > SESSION_MAX_TURNS) history.shift();
  chatSessions.set(sessionId, history);
}

async function requestGeminiReply({ message, history, lang, persona }) {
  if (!GEMINI_API_KEY) {
    return { ok: false, statusCode: 500, error: "GEMINI_API_KEY is missing" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  const endpoint =
    `${GEMINI_API_BASE_URL}/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}` +
    `:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const contents = [];
  for (const turn of history || []) {
    if (turn?.user) contents.push({ role: "user", parts: [{ text: String(turn.user) }] });
    if (turn?.assistant) {
      contents.push({ role: "model", parts: [{ text: String(turn.assistant) }] });
    }
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const systemInstruction = getSystemInstruction({ lang, persona });

  try {
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
          maxOutputTokens: 240,
        },
      }),
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
        error: parsed?.error?.message || "gemini_upstream_error",
        details: parsed,
      };
    }

    const reply =
      parsed?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim() || "";
    if (!reply) {
      return {
        ok: false,
        statusCode: 502,
        error: "empty_gemini_reply",
        details: parsed,
      };
    }

    return {
      ok: true,
      statusCode: 200,
      reply,
      provider: "gemini",
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      error: err?.name === "AbortError" ? "llm_timeout" : "llm_fetch_failed",
      details: String(err?.message || err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestXaiReply({ message, history, lang, persona }) {
  if (!XAI_API_KEY) {
    return { ok: false, statusCode: 500, error: "XAI_API_KEY is missing" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), XAI_TIMEOUT_MS);
  const endpoint = `${XAI_API_BASE_URL}/chat/completions`;

  const messages = [
    {
      role: "system",
      content: getSystemInstruction({ lang, persona }),
    },
  ];
  for (const turn of history || []) {
    if (turn?.user) messages.push({ role: "user", content: String(turn.user) });
    if (turn?.assistant) messages.push({ role: "assistant", content: String(turn.assistant) });
  }
  messages.push({ role: "user", content: message });

  try {
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 240,
      }),
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
        error:
          parsed?.error?.message ||
          parsed?.message ||
          parsed?.error ||
          "xai_upstream_error",
        details: parsed,
      };
    }

    const reply = String(parsed?.choices?.[0]?.message?.content || "").trim();
    if (!reply) {
      return {
        ok: false,
        statusCode: 502,
        error: "empty_xai_reply",
        details: parsed,
      };
    }

    return {
      ok: true,
      statusCode: 200,
      reply,
      provider: "xai",
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      error: err?.name === "AbortError" ? "xai_timeout" : "xai_fetch_failed",
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
    const sessionId = body?.sessionId ? String(body.sessionId).trim() : "";
    const persona = normalizePersona(body?.persona);

    if (!message) {
      return sendJson(res, 400, { error: "message is required" });
    }

    let result = null;
    if (XAI_API_KEY) {
      const history = getSessionHistory(sessionId);
      result = await requestXaiReply({ message, history, lang, persona });
      if (result.ok) {
        saveSessionTurn(sessionId, message, result.reply);
        return sendJson(res, 200, {
          reply: result.reply,
          provider: result.provider,
          talkKey: null,
          persona,
        });
      }
    }

    if (GEMINI_API_KEY) {
      const history = getSessionHistory(sessionId);
      result = await requestGeminiReply({ message, history, lang, persona });
      if (result.ok) {
        saveSessionTurn(sessionId, message, result.reply);
        return sendJson(res, 200, {
          reply: result.reply,
          provider: result.provider,
          talkKey: null,
          persona,
        });
      }
    }

    result = await requestSimsimiReply({ message, lang, talkKey });
    if (!result.ok) {
      return sendJson(res, result.statusCode || 502, {
        error: result.error || "chat_failed",
        details: result.details || null,
      });
    }

    return sendJson(res, 200, {
      reply: result.reply,
      talkKey: result.talkKey,
      provider: "simsimi",
      persona,
    });
  } catch (err) {
    return sendJson(res, 500, {
      error: "server_error",
      details: String(err?.message || err),
    });
  }
}

async function handleRabbitTvRandom(_req, res) {
  try {
    const videoId = await pickRandomRabbitVideoId();
    return sendJson(res, 200, {
      channelUrl: RABBIT_TV_CHANNEL_URL,
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: "rabbit_tv_fetch_failed",
      details: String(err?.message || err),
      channelUrl: RABBIT_TV_CHANNEL_URL,
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

  if (req.method === "GET" && req.url.startsWith("/api/rabbit-tv/random")) {
    await handleRabbitTvRandom(req, res);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/personas")) {
    return sendJson(res, 200, {
      defaultPersona: normalizePersona(DEFAULT_PERSONA),
      personas: listPersonas(),
    });
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
  const xaiStatus = XAI_API_KEY ? "configured" : "missing";
  const llmStatus = GEMINI_API_KEY ? "configured" : "missing";
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] SIMSIMI_API_KEY: ${keyStatus}`);
  console.log(`[server] XAI_API_KEY: ${xaiStatus}`);
  console.log(`[server] GEMINI_API_KEY: ${llmStatus}`);
  console.log(`[server] DEFAULT_PERSONA: ${normalizePersona(DEFAULT_PERSONA)}`);
});
