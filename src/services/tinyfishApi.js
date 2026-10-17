/**
 * TinyFish API client for Nyaya Setu.
 *
 * TinyFish gives the app "eyes and hands" on the live web:
 *   - Search API  → structured web results (free daily allowance)
 *   - Fetch API   → clean text from any URL (free daily allowance)
 *   - Agent API   → a real cloud browser that navigates a website and completes
 *                   a plain-English goal, with a LIVE view we can embed in the app.
 *
 * Docs: https://docs.tinyfish.ai/
 *
 * All calls use plain `fetch` + the X-API-Key header, so they work inside
 * React Native / Expo without the Node-only SDK.
 *
 * If no key is configured the client switches to DEMO MODE: it returns
 * realistic sample data so the app never breaks during a presentation.
 */

const TINYFISH_API_KEY = process.env.EXPO_PUBLIC_TINYFISH_API_KEY;

const AGENT_BASE = "https://agent.tinyfish.ai/v1";
const SEARCH_URL = "https://api.search.tinyfish.ai/";
const FETCH_URL = "https://api.fetch.tinyfish.ai/";

// Suggested client timeouts from the TinyFish docs
const TIMEOUTS = { search: 15000, fetch: 150000, agentStart: 30000, poll: 20000 };

export const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function hasTinyFishKey() {
  return Boolean(TINYFISH_API_KEY && TINYFISH_API_KEY !== "your_tinyfish_api_key_here");
}

export class TinyFishError extends Error {
  constructor(message, { status, code, category } = {}) {
    super(message);
    this.name = "TinyFishError";
    this.status = status;
    this.code = code;
    this.category = category;
  }
}

async function tfRequest(url, { method = "GET", body, timeout = 20000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener?.("abort", onAbort);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": TINYFISH_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const err = data?.error || {};
      const friendly =
        res.status === 401
          ? "TinyFish API key is invalid or missing."
          : res.status === 402
          ? "TinyFish wallet balance is too low to start the live browser. Top up at agent.tinyfish.ai."
          : res.status === 403
          ? "TinyFish credits are exhausted or the plan is inactive."
          : res.status === 429
          ? "TinyFish is rate-limiting requests. Please wait a few seconds and try again."
          : err.message || `TinyFish request failed (HTTP ${res.status}).`;
      throw new TinyFishError(friendly, { status: res.status, code: err.code, category: err.category });
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new TinyFishError("TinyFish request timed out.", { code: "timeout" });
    if (e instanceof TinyFishError) throw e;
    throw new TinyFishError(e.message || "Network error while contacting TinyFish.");
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener?.("abort", onAbort);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function hostnameOf(url) {
  try {
    return url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  } catch (_) {
    return url;
  }
}

export function isOfficialSite(url) {
  const h = hostnameOf(url || "");
  return /(\.gov\.in|\.nic\.in|\.gov|india\.gov\.in)$/.test(h) || h.endsWith(".gov.in") || h.endsWith(".nic.in");
}

// ───────────────────────────── SEARCH API ─────────────────────────────

/**
 * Search the live web.
 * @returns {Promise<Array<{title,url,snippet,site_name,date?,publisher?}>>}
 */
export async function tinyfishSearch(
  query,
  { location = "IN", language = "en", domainType, recencyMinutes, purpose, includeDomains, page } = {}
) {
  if (!hasTinyFishKey()) return mockSearch(query, domainType);

  const params = new URLSearchParams({ query: query.slice(0, 1900), location, language });
  if (domainType) params.append("domain_type", domainType);
  if (recencyMinutes) params.append("recency_minutes", String(recencyMinutes));
  if (purpose) params.append("purpose", purpose.slice(0, 1900));
  if (includeDomains?.length) params.append("include_domains", includeDomains.join(","));
  if (page) params.append("page", String(page));

  const data = await tfRequest(`${SEARCH_URL}?${params.toString()}`, { timeout: TIMEOUTS.search });
  return data?.results || [];
}

// ───────────────────────────── FETCH API ─────────────────────────────

/**
 * Fetch clean, readable content (markdown) from up to 10 URLs in parallel.
 * @returns {Promise<{results: Array<{url,final_url,title,description,text}>, errors: Array}>}
 */
export async function tinyfishFetch(urls, { purpose, perUrlTimeoutMs = 40000, maxChars = 7000 } = {}) {
  const list = (urls || []).filter(Boolean).slice(0, 10);
  if (list.length === 0) return { results: [], errors: [] };
  if (!hasTinyFishKey()) return mockFetch(list);

  const body = {
    urls: list,
    format: "markdown",
    per_url_timeout_ms: perUrlTimeoutMs,
    exclude_selectors: ["nav", "footer", "header", ".cookie-banner"],
  };
  if (purpose) body.purpose = purpose.slice(0, 1900);

  const data = await tfRequest(FETCH_URL, { method: "POST", body, timeout: TIMEOUTS.fetch });
  const results = (data?.results || []).map((r) => ({
    ...r,
    text: (r.text || "").slice(0, maxChars),
  }));
  return { results, errors: data?.errors || [] };
}

// ───────────────────────────── AGENT API ─────────────────────────────

/** Start a browser-agent run. Returns the run_id immediately. */
export async function startAgentRun({ url, goal, browserProfile = "lite", maxSteps = 25 }) {
  if (!hasTinyFishKey()) return `demo-${Date.now()}`;

  const start = (body) => tfRequest(`${AGENT_BASE}/automation/run-async`, { method: "POST", timeout: TIMEOUTS.agentStart, body });
  let data;
  try {
    // NOTE: custom agent_config (max_steps etc.) needs TinyFish beta access — sending it
    // returns 403 FORBIDDEN on normal accounts, so we keep the request minimal.
    // The app itself cancels the run after maxWaitMs, so it can't run forever.
    data = await start({ url, goal, browser_profile: browserProfile });
  } catch (e) {
    // Some accounts/plans reject optional fields — retry with only the required ones.
    if ([400, 403, 422].includes(e.status) && e.code !== "INSUFFICIENT_CREDITS") data = await start({ url, goal });
    else throw e;
  }
  if (!data?.run_id) throw new TinyFishError(data?.error?.message || "TinyFish did not return a run id.");
  return data.run_id;
}

/** Get a run's current state: status, steps, streaming_url, result, error. */
export async function getAgentRun(runId) {
  if (String(runId).startsWith("demo-")) return mockRunState(runId);
  return tfRequest(`${AGENT_BASE}/runs/${runId}?screenshots=none&html=none`, { timeout: TIMEOUTS.poll });
}

export async function cancelAgentRun(runId) {
  if (!runId || String(runId).startsWith("demo-")) return;
  try {
    await tfRequest(`${AGENT_BASE}/runs/${runId}/cancel`, { method: "POST", timeout: 10000 });
  } catch (e) {
    console.warn("TinyFish cancel failed:", e.message);
  }
}

/**
 * Start a run and poll it until it finishes.
 * `onUpdate` is called on every poll with
 *   { runId, status, streamingUrl, steps: [{action,status}], elapsed }
 * so the UI can show the live browser + a step timeline.
 */
export async function runAgentWithLiveUpdates({ url, goal, onUpdate, shouldStop, maxWaitMs = 150000, pollMs = 2000 }) {
  const runId = await startAgentRun({ url, goal });
  const started = Date.now();
  let streamingUrl = null;
  let lastRun = null;
  let consecutiveErrors = 0;

  onUpdate?.({ runId, status: "PENDING", streamingUrl: null, steps: [], elapsed: 0 });

  while (Date.now() - started < maxWaitMs) {
    if (shouldStop?.()) {
      await cancelAgentRun(runId);
      return { runId, status: "CANCELLED", result: null, steps: lastRun?.steps || [] };
    }
    await sleep(pollMs);
    try {
      const run = await getAgentRun(runId);
      consecutiveErrors = 0;
      lastRun = run;
      if (run.streaming_url) streamingUrl = run.streaming_url;
      const steps = (run.steps || []).filter((s) => s.action);
      onUpdate?.({ runId, status: run.status, streamingUrl, steps, elapsed: Date.now() - started });

      if (TERMINAL_STATUSES.includes(run.status)) {
        return {
          runId,
          status: run.status,
          result: normaliseResult(run.result),
          steps,
          error: run.error
            ? { ...run.error, message: run.error.category === "BILLING_FAILURE" ? "TinyFish wallet is out of credits" : run.error.message }
            : null,
          videoUrl: run.video_url,
        };
      }
    } catch (e) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 4) throw e;
    }
  }

  await cancelAgentRun(runId);
  throw new TinyFishError("The website took too long to respond. Please try again.", { code: "timeout" });
}

function normaliseResult(result) {
  if (result == null) return null;
  if (typeof result === "object" && Object.keys(result).length === 1 && "result" in result) return result.result;
  return result;
}

/**
 * TinyFish marks a run COMPLETED when the browser finished, even if the site
 * blocked it. This checks the result for typical failure signals.
 */
export function looksBlocked(result) {
  const s = JSON.stringify(result || "").toLowerCase();
  return /captcha|access denied|blocked|forbidden|403|could not access|unable to access|cloudflare/.test(s);
}

/** Lightweight connectivity test used by the Settings screen. */
export async function testTinyFishConnection() {
  if (!hasTinyFishKey()) return { ok: false, demo: true, message: "No TinyFish key found — running in demo mode." };
  try {
    const results = await tinyfishSearch("myscheme government schemes India", { location: "IN" });
    return { ok: true, message: `Connected ✓ — live search returned ${results.length} results.` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ───────────────────────────── DEMO MODE ─────────────────────────────
// Realistic fallbacks so the app is always presentable without a key.

function mockSearch(query, domainType) {
  if (domainType === "news") {
    return [
      { title: "Centre extends PM-KISAN e-KYC deadline; farmers urged to update Aadhaar seeding", url: "https://pib.gov.in/", snippet: "Farmers can complete e-KYC through the PM-KISAN portal or nearest CSC.", site_name: "pib.gov.in", date: "Demo" },
      { title: "New guidelines for Ayushman Bharat cards for senior citizens aged 70+", url: "https://pmjay.gov.in/", snippet: "All citizens aged 70 and above eligible regardless of income.", site_name: "pmjay.gov.in", date: "Demo" },
      { title: "Cyber fraud helpline 1930: how to report UPI scams within the golden hour", url: "https://cybercrime.gov.in/", snippet: "Reporting within the first hour improves chances of freezing the money.", site_name: "cybercrime.gov.in", date: "Demo" },
      { title: "PM Awas Yojana Urban 2.0 opens applications for EWS/LIG families", url: "https://pmay-urban.gov.in/", snippet: "Eligible families can apply online or through urban local bodies.", site_name: "pmay-urban.gov.in", date: "Demo" },
    ];
  }
  return [
    { title: `${query} — myScheme`, url: "https://www.myscheme.gov.in/", snippet: "One-stop platform to discover government schemes you are eligible for.", site_name: "myscheme.gov.in" },
    { title: "National Portal of India", url: "https://www.india.gov.in/", snippet: "Official information on citizen services and schemes.", site_name: "india.gov.in" },
    { title: "National Legal Services Authority", url: "https://nalsa.gov.in/", snippet: "Free legal aid for eligible citizens through DLSA offices.", site_name: "nalsa.gov.in" },
  ];
}

function mockFetch(urls) {
  return {
    results: urls.map((u) => ({
      url: u,
      final_url: u,
      title: hostnameOf(u),
      description: "Demo content",
      text: "(Demo mode — add EXPO_PUBLIC_TINYFISH_API_KEY to .env to read the live page.)",
    })),
    errors: [],
  };
}

const DEMO_STEPS = [
  "Opening the official government website",
  "Closing the language / cookie pop-up",
  "Searching for the requested scheme",
  "Opening the scheme details page",
  "Reading the eligibility section",
  "Reading the benefits and documents required",
  "Collecting the official application link",
];

function mockRunState(runId) {
  const startedAt = Number(String(runId).replace("demo-", ""));
  const elapsed = Date.now() - startedAt;
  const n = Math.min(DEMO_STEPS.length, Math.floor(elapsed / 2500));
  const done = n >= DEMO_STEPS.length;
  return {
    run_id: runId,
    status: done ? "COMPLETED" : "RUNNING",
    streaming_url: null,
    steps: DEMO_STEPS.slice(0, n).map((a) => ({ action: a, status: "COMPLETED" })),
    result: done
      ? {
          demo: true,
          note: "Demo mode — add EXPO_PUBLIC_TINYFISH_API_KEY to .env for a real live run.",
          scheme_name: "PM-KISAN Samman Nidhi",
          benefit: "₹6,000 per year in three instalments of ₹2,000",
          eligibility: "Landholding farmer families (with exclusions for income-tax payers, government employees, etc.)",
          documents: ["Aadhaar", "Land records", "Bank account linked to Aadhaar"],
          apply_link: "https://pmkisan.gov.in/",
        }
      : null,
    error: null,
  };
}
