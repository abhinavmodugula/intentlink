// Service worker: owns the API keys, runs rank(), applies the 4s timeout + fallback,
// caches responses for replay/demo mode, and captures #ll-intent per tab as a redirect backup (F3).
importScripts(
  "lib/filters.js",
  "config.local.js",
  "engines/heuristic.js",
  "engines/llm.js",
  "engines/jev.js"
);

const RANK_TIMEOUT_MS = 4000;
const replayCache = new Map(); // hash(intent + pageUrl) -> plan
const capturedIntents = new Map(); // tabId -> intent (F3 redirect backup)

function hashKey(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function stripHash(url) {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

function decodeIntentFromUrl(url) {
  const m = url.match(/#ll-intent=([^&]*)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1]; // tolerant decode: fall back to raw text rather than dropping it
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rank timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// F6: deterministic re-check — drop any kept item that violates the plan's own filters,
// so a model mistake can never highlight a constraint violator.
function reCheckPlan(plan, items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const keep = plan.keep.filter((k) => {
    const item = byId.get(k.id);
    return item && self.LL_FILTERS.passesFilters(item, plan.filters);
  });
  return { ...plan, keep };
}

async function rank(intent, items, pageUrl) {
  const cacheKey = hashKey(intent + "|" + stripHash(pageUrl || ""));
  const config = self.LL_CONFIG || { RANK_ENGINE: "heuristic", DEMO_MODE: false };

  if (config.DEMO_MODE) {
    if (replayCache.has(cacheKey)) return replayCache.get(cacheKey);
    // Demo mode never touches the network — heuristic is pure JS.
    const plan = reCheckPlan(await self.LL_ENGINES.heuristic(intent, items), items);
    replayCache.set(cacheKey, plan);
    return plan;
  }

  if (replayCache.has(cacheKey)) return replayCache.get(cacheKey);

  const engineName = config.RANK_ENGINE || "llm";
  const engine = self.LL_ENGINES[engineName] || self.LL_ENGINES.heuristic;

  let plan;
  try {
    plan = await withTimeout(engine(intent, items), RANK_TIMEOUT_MS);
  } catch (err) {
    console.warn(`IntentLink: ${engineName} engine failed (${err.message}), falling back to heuristic`);
    plan = await self.LL_ENGINES.heuristic(intent, items);
  }

  plan = reCheckPlan(plan, items);
  replayCache.set(cacheKey, plan);
  return plan;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "rank") {
    rank(message.intent, message.items, sender.tab?.url)
      .then((plan) => sendResponse({ ok: true, plan }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }

  if (message?.type === "getCapturedIntent") {
    const tabId = sender.tab?.id;
    sendResponse({ intent: tabId != null ? capturedIntents.get(tabId) || null : null });
    return false;
  }

  return false;
});

// F3: capture #ll-intent per tab via webNavigation, in case a redirect drops the fragment
// before content.js ever sees it. Content.js only consults this if its own location.hash read
// comes up empty.
function captureFromDetails(details) {
  if (details.frameId !== 0) return;
  const intent = decodeIntentFromUrl(details.url || "");
  if (intent) capturedIntents.set(details.tabId, intent);
}

chrome.webNavigation.onCommitted.addListener(captureFromDetails);
chrome.webNavigation.onHistoryStateUpdated.addListener(captureFromDetails);
