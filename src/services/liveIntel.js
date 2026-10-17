/**
 * Live Intelligence layer: TinyFish (live web) + Gemini (understanding & language).
 *
 * TinyFish fetches what is TRUE TODAY on official websites; Gemini turns it into
 * a short answer in the citizen's own language. Every feature here degrades
 * gracefully: if the agent is blocked we fall back to Search + Fetch, and if
 * Gemini is unavailable we still show the raw sources.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  tinyfishSearch,
  tinyfishFetch,
  runAgentWithLiveUpdates,
  looksBlocked,
  isOfficialSite,
  hostnameOf,
  hasTinyFishKey,
} from "./tinyfishApi";
import { geminiJSON } from "./geminiApi";
import { languageRule, scriptOf } from "../utils/language";

// ───────────────────────────── helpers ─────────────────────────────

const CACHE_PREFIX = "tf_cache_";

async function cached(key, ttlMs, producer) {
  const k = CACHE_PREFIX + key;
  try {
    const raw = await AsyncStorage.getItem(k);
    if (raw) {
      const { at, value } = JSON.parse(raw);
      if (Date.now() - at < ttlMs) return value;
    }
  } catch (_) {}
  const value = await producer();
  try {
    if (value) await AsyncStorage.setItem(k, JSON.stringify({ at: Date.now(), value }));
  } catch (_) {}
  return value;
}

const keyOf = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);

/** Prefer official (.gov.in / .nic.in) results, then the rest, de-duplicated by host+path. */
function rankOfficialFirst(results) {
  const seen = new Set();
  const uniq = results.filter((r) => {
    if (!r?.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  return [...uniq.filter((r) => isOfficialSite(r.url)), ...uniq.filter((r) => !isOfficialSite(r.url))];
}

function toSources(items, max = 4) {
  const seen = new Set();
  const all = items
    .map((r) => ({
      title: r.title || hostnameOf(r.final_url || r.url),
      url: r.final_url || r.url,
      site: hostnameOf(r.final_url || r.url),
      official: isOfficialSite(r.final_url || r.url),
    }))
    .filter((x) => x.url && !seen.has(x.site) && seen.add(x.site));
  const official = all.filter((x) => x.official);
  // show official sources only when we have at least two; otherwise top up with the best others
  return (official.length >= 2 ? official : [...official, ...all.filter((x) => !x.official)]).slice(0, max);
}

// Government sites that block or time out for TinyFish's cloud browser (tested Oct 2026).
// The agent is never sent here, and the quick answer skips fetching them (snippets are used instead).
const CLOUD_BLOCKED = ["beneficiary.nha.gov.in", "dashboard.nha.gov.in", "pmjay.gov.in", "nfsa.gov.in", "sarathi.parivahan.gov.in", "cybercrime.gov.in", "agmarknet.gov.in"];
const isCloudBlocked = (url) => CLOUD_BLOCKED.some((h) => hostnameOf(url || "").endsWith(h));

function pagesToContext(pages, snippets) {
  const pageText = pages
    .map((p, i) => `### SOURCE ${i + 1}: ${p.title || ""} (${p.final_url || p.url})\n${p.text}`)
    .join("\n\n");
  const snippetText = snippets
    .map((r, i) => `- [${hostnameOf(r.url)}] ${r.title}: ${r.snippet || ""} (${r.url})`)
    .join("\n");
  return `FULL PAGES:\n${pageText || "(none)"}\n\nSEARCH SNIPPETS:\n${snippetText || "(none)"}`;
}

// ─────────────────────── 1. VERIFY LIVE (schemes & legal) ───────────────────────

/**
 * Cross-check an AI answer against live official websites.
 * mode: "scheme" | "legal"
 * Returns { verdict, headline, summary, keyFacts[], officialLink, sources[], checkedAt }
 */
export async function verifyLive({ question, answer, mode = "scheme", language = "English" }) {
  const topicHint = mode === "legal" ? "legal procedure / complaint process in India" : "Indian government welfare scheme";

  // Step 1 — Gemini writes precise search queries.
  const plan = await geminiJSON(
    "You write web search queries to verify information on official Indian government websites.",
    `A citizen asked: """${question}"""\nAn assistant replied: """${answer}"""\n\nTopic type: ${topicHint}.\nReturn JSON: {"queries": [2 short English search queries that would find the OFFICIAL page (prefer gov.in / nic.in / myscheme.gov.in / india.gov.in / nalsa.gov.in / cybercrime.gov.in) confirming the key facts], "topic": "3-6 word topic name"}`
  );
  const queries = plan?.queries?.length ? plan.queries.slice(0, 2) : [`${question} official site gov.in`];
  const topic = plan?.topic || question.slice(0, 60);

  // Step 2 — TinyFish Search (both queries in parallel).
  const searchSets = await Promise.all(
    queries.map((q) =>
      tinyfishSearch(q, { location: "IN", language: "en", purpose: `Verify: ${topic}` }).catch(() => [])
    )
  );
  const ranked = rankOfficialFirst(searchSets.flat());
  if (ranked.length === 0) throw new Error("No live sources found. Please check your internet and try again.");

  // Step 3 — TinyFish Fetch the top 2 pages (official first).
  const toRead = ranked.slice(0, 2).map((r) => r.url);
  const { results: pages } = await tinyfishFetch(toRead, { purpose: `Facts about ${topic}: eligibility, benefits, documents, process, deadlines, official link` }).catch(() => ({ results: [] }));

  // Step 4 — Gemini compares the answer with what the live pages say.
  const verdict = await geminiJSON(
    "You are a careful fact-checker for Indian citizens. You ONLY trust the provided live web content. Never invent facts or links.",
    `Citizen question: """${question}"""\nAssistant's earlier answer: """${answer}"""\n\nLIVE WEB CONTENT (fetched just now by TinyFish):\n${pagesToContext(pages, ranked.slice(0, 6))}\n\nCompare the earlier answer with the live content. ${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{\n "verdict": "confirmed" | "updated" | "unclear",\n "headline": "one short line in ${language}",\n "summary": "2-3 simple sentences in ${language} with what is true today",\n "keyFacts": ["up to 4 short facts in ${language} (amounts, eligibility, documents, deadlines)"],\n "officialLink": "the single best official URL from the content, or empty string"\n}`
  );

  const usedSources = toSources([...pages, ...ranked.filter((r) => !toRead.includes(r.url))], 4);

  return {
    kind: "verify",
    verdict: verdict?.verdict || "unclear",
    headline: verdict?.headline || `Live sources found for: ${topic}`,
    summary: verdict?.summary || ranked[0]?.snippet || "",
    keyFacts: verdict?.keyFacts || [],
    officialLink: verdict?.officialLink || usedSources.find((s) => s.official)?.url || "",
    sources: usedSources,
    checkedAt: new Date().toISOString(),
    demo: !hasTinyFishKey(),
  };
}

// ─────────────────────── 2. SCAM SHIELD (documents / SMS) ───────────────────────

/**
 * Check whether a notice / SMS / letter is likely genuine, using live searches
 * for official sources and fraud alerts (PIB Fact Check, cybercrime.gov.in, news).
 */
export async function scamCheck({ content, language = "English" }) {
  const plan = await geminiJSON(
    "You help Indian citizens detect fake government notices, fake SMS and scams.",
    `Here is the content of a notice/message (or a summary of it):\n"""${content}"""\n\nReturn JSON: {"claim": "the core claim in one English line (who is asking for what)", "sender": "claimed sender/organisation", "queries": ["English query to find the OFFICIAL source for this", "English query to find fraud alerts / PIB fact check / scam reports about this"]}`
  );
  const queries = plan?.queries?.length ? plan.queries.slice(0, 2) : [`${content.slice(0, 120)} fake scam alert`];

  const [web, news] = await Promise.all([
    tinyfishSearch(queries[0], { location: "IN" }).catch(() => []),
    tinyfishSearch(queries[1] || queries[0], { location: "IN", domainType: "news" }).catch(() => []),
  ]);
  const ranked = rankOfficialFirst([...web, ...news]);

  const verdict = await geminiJSON(
    "You are a scam-detection expert for India. Base your decision on the message itself AND the live web results. Common red flags: urgency, payment via UPI/gift cards, links not on gov.in, requests for OTP/PIN, threats of arrest ('digital arrest'), lottery/prize claims.",
    `MESSAGE/NOTICE:\n"""${content}"""\n\nLIVE WEB RESULTS (TinyFish, just now):\n${pagesToContext([], ranked.slice(0, 8))}\n\n${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{\n "verdict": "likely_genuine" | "suspicious" | "likely_scam",\n "headline": "one short line in ${language}",\n "reasons": ["up to 4 short reasons in ${language}"],\n "whatToDo": ["up to 3 short safe next steps in ${language} — mention 1930 cyber helpline / cybercrime.gov.in if it may be a scam"],\n "officialLink": "best official URL from the results or empty string"\n}`
  );

  return {
    kind: "scam",
    verdict: verdict?.verdict || "suspicious",
    headline: verdict?.headline || "Could not fully verify — treat with caution.",
    reasons: verdict?.reasons || [],
    whatToDo: verdict?.whatToDo || ["Do not share OTP, PIN or pay any money.", "Call 1930 or visit cybercrime.gov.in if money was lost."],
    officialLink: verdict?.officialLink || "",
    sources: toSources(ranked, 4),
    checkedAt: new Date().toISOString(),
    demo: !hasTinyFishKey(),
  };
}

// ─────────────────────── 3. REAL HELP CENTERS NEAR ME ───────────────────────

/**
 * Find real help centres (CSC, DLSA, police, one-stop centre) for the user's city.
 * Returns [{ name, type, address, phone, url }]
 */
export async function findHelpCentersLive({ city, district, state }) {
  const place = [city || district, state].filter(Boolean).join(", ");
  if (!place) throw new Error("Could not detect your city.");

  return cached(`help_${keyOf(place)}`, 24 * 3600 * 1000, async () => {
    const queries = [
      `Common Service Centre CSC in ${place} address`,
      `District Legal Services Authority ${district || city} ${state || ""} address phone`,
      `police station ${city || district} ${state || ""} address phone`,
      `One Stop Centre Sakhi women help ${district || city} address`,
    ];
    const sets = await Promise.all(queries.map((q) => tinyfishSearch(q, { location: "IN" }).catch(() => [])));
    const all = sets.flatMap((rs, i) => rs.slice(0, 6).map((r) => ({ ...r, bucket: i })));

    const extracted = await geminiJSON(
      "You extract real, specific places from web search results. Never invent names, addresses or phone numbers — use only what appears in the results.",
      `Location: ${place}\n\nLIVE SEARCH RESULTS (TinyFish):\n${all
        .map((r) => `- [bucket ${r.bucket}] ${r.title} | ${r.snippet || ""} | ${r.url}`)
        .join("\n")}\n\nBuckets: 0=CSC (scheme applications), 1=DLSA (free legal aid), 2=Police station (FIR), 3=One Stop Centre (women's help).\nReturn JSON: {"centers": [{"name": "", "type": "CSC (Scheme applications) | Legal Aid (DLSA) | Police Station (FIR filing) | One Stop Centre (Women)", "address": "", "phone": "or empty", "url": "source url"}]} — up to 10 entries, only places located in or near ${place}.`
    );

    let centers = extracted?.centers || [];
    if (centers.length === 0) {
      // No Gemini? show the raw official results instead
      centers = rankOfficialFirst(all)
        .slice(0, 8)
        .map((r) => ({ name: r.title, type: ["CSC", "Legal Aid (DLSA)", "Police Station", "One Stop Centre"][r.bucket], address: r.snippet || "", phone: "", url: r.url }));
    }
    return centers.map((c, i) => ({ ...c, id: `live-${i}`, live: true }));
  });
}

// ─────────────────────── 4. LIVE UPDATES FEED ───────────────────────

/** Latest scheme / citizen-rights news from the last 7 days. Cached for 6 hours. */
export async function getLiveUpdates({ language = "English", force = false } = {}) {
  const key = `updates_${language}_${new Date().toISOString().slice(0, 10)}`;
  if (force) await AsyncStorage.removeItem(CACHE_PREFIX + key).catch(() => {});

  return cached(key, 6 * 3600 * 1000, async () => {
    const [a, b] = await Promise.all([
      tinyfishSearch("government scheme India launched OR extended OR deadline citizens", {
        location: "IN",
        domainType: "news",
        recencyMinutes: 7 * 24 * 60,
      }).catch(() => []),
      tinyfishSearch("cyber fraud alert India citizens advisory", {
        location: "IN",
        domainType: "news",
        recencyMinutes: 7 * 24 * 60,
      }).catch(() => []),
    ]);
    let items = rankOfficialFirst([...a.slice(0, 5), ...b.slice(0, 3)]).slice(0, 6);
    if (items.length === 0) return [];

    if (language !== "English") {
      const tr = await geminiJSON(
        "You translate news headlines for rural Indian citizens. Keep it simple.",
        `Translate each headline into simple ${language}, written only in the ${scriptOf(language)} script. Return JSON {"titles": [..same order..]}\n${items.map((x, i) => `${i + 1}. ${x.title}`).join("\n")}`
      );
      if (tr?.titles?.length === items.length) items = items.map((x, i) => ({ ...x, title: tr.titles[i] }));
    }
    return items.map((x) => ({ title: x.title, url: x.url, site: x.publisher || hostnameOf(x.url), date: x.date || "", official: isOfficialSite(x.url) }));
  });
}

// ─────────────────────── 5. SAHAYAK LIVE (browser agent) ───────────────────────

// Official websites the TinyFish cloud browser can open reliably (tested Oct 2026).
const REACHABLE_HOSTS = [
  "myscheme.gov.in",
  "pmkisan.gov.in",
  "parivahan.gov.in",
  "passportindia.gov.in",
  "uidai.gov.in",
  "pmay-urban.gov.in",
  "pmaymis.gov.in",
  "scholarships.gov.in",
  "ceir.gov.in",
  "sancharsaathi.gov.in",
  "rtionline.gov.in",
  "consumerhelpline.gov.in",
  "nalsa.gov.in",
  "india.gov.in",
  "services.india.gov.in",
];

const TRUSTED_SITES = `
- https://www.myscheme.gov.in/schemes/ab-pmjay  (Ayushman Bharat PM-JAY / Ayushman card, incl. senior citizens 70+)
- https://www.myscheme.gov.in/schemes/pm-kisan  (PM-KISAN farmer income support)
- https://www.myscheme.gov.in/schemes/pmay-u-2  (PM Awas Yojana Urban 2.0 housing)
- https://www.myscheme.gov.in/search  (search ANY other central/state scheme: pensions, ration card, scholarships, loans)
- https://pmkisan.gov.in  (PM-KISAN status / eKYC)
- https://parivahan.gov.in  (driving licence, vehicle services)
- https://www.passportindia.gov.in  (passport)
- https://uidai.gov.in  (Aadhaar update / services)
- https://scholarships.gov.in  (National Scholarship Portal)
- https://www.sancharsaathi.gov.in  (block a lost or stolen mobile phone (CEIR), check mobile connections in your name, report fraud calls)
- https://rtionline.gov.in  (file RTI)
- https://consumerhelpline.gov.in  (consumer complaints)
- https://nalsa.gov.in  (free legal aid)
- https://www.india.gov.in  (general citizen services, cyber fraud, ration card — use if nothing above fits)
NEVER use these (they block the cloud browser): beneficiary.nha.gov.in, pmjay.gov.in, nfsa.gov.in, sarathi.parivahan.gov.in, cybercrime.gov.in, agmarknet.gov.in
`;

const isReachable = (url) => {
  const h = hostnameOf(url || "");
  return !isCloudBlocked(url) && REACHABLE_HOSTS.some((r) => h === r || h.endsWith("." + r));
};
const isDeepPage = (url) => {
  const path = String(url || "").replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");
  return path.replace(/\/+$/, "").length > 1 && !/\/search\/?$/.test(path);
};
const siteLabel = (url) => {
  const h = hostnameOf(url || "");
  if (h.includes("myscheme")) return "myScheme";
  return h.replace(/\.(gov|nic)\.in$/, "").replace(/^services\./, "");
};

/** Gemini turns a citizen's request (any language) into a precise browser task. */
export async function planAgentTask({ request }) {
  const plan = await geminiJSON(
    "You plan short, fast web-browsing tasks for an AI browser agent that helps Indian citizens. The agent can read pages, click, scroll and type. It must NEVER log in, enter personal data (Aadhaar, phone, bank, OTP), pay money, or submit applications.",
    `Citizen request (may be in any Indian language): """${request}"""\n\nPick the MOST SPECIFIC official starting page from this list (a deep page is better than a home page):\n${TRUSTED_SITES}\n\nReturn JSON: {"url": "starting URL from the list", "siteName": "short site name", "taskTitle": "short title of the task in English", "searchQuery": "short English web search query that finds the exact official page for this request", "focus": "one English sentence: exactly what information the citizen needs (e.g. eligibility for age 70+, documents, how to apply)", "steps": "up to 4 short numbered browsing steps in English to use ONLY if the starting page is a home page"}`
  );

  const fallback = {
    url: "https://www.myscheme.gov.in/search",
    siteName: "myScheme",
    taskTitle: request.slice(0, 60),
    searchQuery: `${request} official`,
    focus: request,
    steps: `1. Type the task into the search box and press Enter. 2. Open the most relevant result.`,
  };
  const p = plan?.url ? { ...fallback, ...plan } : fallback;
  if (!isReachable(p.url)) {
    p.url = fallback.url;
    p.siteName = "myScheme";
  }
  return p;
}

/**
 * Find the exact official page to start the agent on — a deep page means the agent
 * reads instead of clicking around (≈50 s instead of ≈95 s in our tests).
 * Returns an ordered list of candidate start URLs (best first, never blocked sites).
 */
async function findStartPages(plan) {
  const candidates = [];
  const add = (u) => {
    if (u && isReachable(u) && !candidates.some((c) => c.replace(/\/+$/, "") === u.replace(/\/+$/, ""))) candidates.push(u);
  };
  if (isDeepPage(plan.url)) add(plan.url);

  const host = hostnameOf(plan.url);
  const [onSite, onMyScheme] = await Promise.all([
    host.includes("myscheme") ? Promise.resolve([]) : tinyfishSearch(plan.searchQuery, { includeDomains: [host], purpose: plan.focus }).catch(() => []),
    tinyfishSearch(plan.searchQuery, { includeDomains: ["myscheme.gov.in"], purpose: plan.focus }).catch(() => []),
  ]);
  onSite.filter((r) => isDeepPage(r.url)).slice(0, 2).forEach((r) => add(r.url));
  onMyScheme.filter((r) => /\/schemes\//.test(r.url)).slice(0, 1).forEach((r) => add(r.url));
  add(plan.url); // the site Gemini chose (may be a home page)
  add("https://www.myscheme.gov.in/search");
  return candidates;
}

function buildGoal({ request, plan, url }) {
  const deep = isDeepPage(url);
  return [
    `Citizen's task: "${plan.taskTitle}". They need: ${plan.focus}. (Original request: "${String(request).slice(0, 200)}")`,
    deep
      ? "You are already on the official page that should contain the answer. Work fast:"
      : `You are on the official website's home page. Work fast. Suggested route: ${plan.steps || "use the site search or menu to open the most relevant page."}`,
    "1. If a pop-up, cookie banner or language selector appears, close it.",
    "2. Read the page. Scroll down to see all of it. If it has tabs or sections (Details, Benefits, Eligibility, Exclusions, Application Process, Documents Required, FAQ), click each relevant tab and read it.",
    "3. Only if this page does not answer the task, click at most ONE clearly relevant link on the same official website and read that page.",
    "4. Never log in, never type personal details, never submit forms, never pay, and never leave official .gov.in / .nic.in websites.",
    'Return JSON with keys "title", "summary", "eligibility", "benefits", "documents" (array), "steps" (array of how to apply / what to do), "fees" (if shown), "helpline" (if shown), "official_link" (the official URL where the citizen should apply or act).',
    'If the page shows 403 / Forbidden / Access Denied / cannot be reached / a captcha / stays blank, stop at once and return {"blocked": true}.',
  ].join("\n");
}

const EXPLAIN_SYSTEM =
  "You explain government information to Indian citizens in very simple, spoken-style language. Use only the provided live data. Never invent amounts, dates, fees or links.";

async function explainData({ request, raw, siteName, language, extra }) {
  return geminiJSON(
    EXPLAIN_SYSTEM,
    `Citizen request: """${request}"""\nLIVE DATA collected just now from ${siteName} (official sources, via TinyFish):\n${typeof raw === "string" ? raw : JSON.stringify(raw, null, 1).slice(0, 12000)}${extra ? `\n\nEXTRA CONTEXT from other official pages (use only if the live data above lacks it):\n${extra.slice(0, 3000)}` : ""}\n\n${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{"answer": "4-6 simple sentences that can be read aloud", "keyFacts": ["up to 5 short facts"], "nextSteps": ["up to 4 short action steps"], "officialLink": "official URL from the data or empty string"}`
  );
}

/** Fast path (~10-20 s): TinyFish Search + Fetch of official pages, explained by Gemini. */
async function quickAnswer({ request, plan, language }) {
  const results = rankOfficialFirst(
    await tinyfishSearch(plan.searchQuery || request, { location: "IN", purpose: request }).catch(() => [])
  );
  if (results.length === 0) return null;
  const toRead = results.filter((r) => isOfficialSite(r.url) && !isCloudBlocked(r.url)).slice(0, 3).map((r) => r.url);
  const { results: pages } = toRead.length
    ? await tinyfishFetch(toRead, { purpose: request, perUrlTimeoutMs: 15000 }).catch(() => ({ results: [] }))
    : { results: [] };
  const raw = pagesToContext(pages, results.slice(0, 6));
  const explained = await explainData({ request, raw, siteName: "official websites", language });
  if (!explained?.answer) return null;
  return {
    mode: "search",
    answer: explained.answer,
    keyFacts: explained.keyFacts || [],
    nextSteps: explained.nextSteps || [],
    officialLink: explained.officialLink || results.find((r) => isOfficialSite(r.url))?.url || "",
    sources: toSources([...pages, ...results], 4),
    rawContext: raw,
    demo: !hasTinyFishKey(),
  };
}

const BLOCK_RE = /\b403\b|forbidden|access denied|can.?t be reached|cannot be reached|captcha|err_|site is blocked|page is blocked/i;

/**
 * Sahayak Live:
 *  1. Gemini plans the task; TinyFish Search finds the EXACT official page (deep link).
 *  2. The live TinyFish browser opens that page and does the work while the citizen watches.
 *  3. In parallel a quick answer (Search + Fetch) appears within seconds.
 *  4. If a page blocks the cloud browser, the agent quietly moves to the next official page.
 *  The agent is never cut off for being "slow" — it gets up to ~2.5 min in total.
 */
export async function runSahayakTask({ request, language = "English", onPlan, onUpdate, onQuick, shouldStop }) {
  const plan = await planAgentTask({ request });
  onPlan?.(plan);

  const quickP = quickAnswer({ request, plan, language })
    .then((q) => {
      if (q && !shouldStop?.()) onQuick?.({ ...q, plan });
      return q;
    })
    .catch(() => null);

  const candidates = await findStartPages(plan);
  if (shouldStop?.()) return { cancelled: true, plan };

  const started = Date.now();
  const TOTAL_BUDGET = 160000;
  let history = []; // steps from earlier attempts, shown in the timeline
  let agentRaw = null;
  let usedUrl = candidates[0];
  let streamingUrl = null;

  for (let i = 0; i < Math.min(candidates.length, 3) && !agentRaw; i++) {
    const url = candidates[i];
    const remaining = TOTAL_BUDGET - (Date.now() - started);
    if (remaining < 40000) break;
    usedUrl = url;
    const current = { ...plan, url, siteName: siteLabel(url) };
    onPlan?.(current);
    if (i > 0) history = [...history, { action: `Opening another official page: ${hostnameOf(url)}`, status: "COMPLETED" }];

    let switchTo = false;
    const watch = (u) => {
      if (u.streamingUrl) streamingUrl = u.streamingUrl;
      // only the first few steps can mean "this site blocks us"; later steps may mention a captcha on a form
      const st = u.steps || [];
      if (st.length <= 4 && BLOCK_RE.test(st.slice(-2).map((x) => x.action || "").join(" "))) switchTo = true;
      onUpdate?.({ ...u, streamingUrl: u.streamingUrl || null, steps: [...history, ...(u.steps || [])], elapsed: Date.now() - started });
    };

    try {
      const run = await runAgentWithLiveUpdates({
        url,
        goal: buildGoal({ request, plan, url }),
        onUpdate: watch,
        shouldStop: () => shouldStop?.() || switchTo,
        maxWaitMs: remaining,
      });
      if (shouldStop?.()) return { cancelled: true, plan };
      history = [...history, ...(run.steps || [])];
      if (run.status === "COMPLETED" && run.result && !run.result?.blocked && !looksBlocked(run.result)) agentRaw = run.result;
    } catch (e) {
      if (shouldStop?.()) return { cancelled: true, plan };
      // credits / auth problems won't be fixed by another page — stop trying
      if (e?.status && [401, 402, 403].includes(e.status)) break;
    }
  }
  if (shouldStop?.()) return { cancelled: true, plan };

  const q = await quickP;
  const finalPlan = { ...plan, url: usedUrl, siteName: siteLabel(usedUrl) };

  if (!agentRaw) {
    onUpdate?.({ status: "FALLBACK", streamingUrl, steps: [...history, { action: "Answer prepared from official government pages ✓", status: "COMPLETED" }], elapsed: Date.now() - started });
    if (q) return { ...q, plan: finalPlan, steps: history };
    throw new Error("Couldn't reach the official websites right now. Please check your internet and try again.");
  }

  onUpdate?.({ status: "COMPLETED", streamingUrl, steps: [...history, { action: `Finished on ${hostnameOf(usedUrl)} ✓`, status: "COMPLETED" }], elapsed: Date.now() - started });
  const explained = await explainData({ request, raw: agentRaw, siteName: finalPlan.siteName, language, extra: q?.rawContext });
  return {
    plan: finalPlan,
    mode: "agent",
    steps: history,
    answer: explained?.answer || q?.answer || agentRaw.summary || JSON.stringify(agentRaw, null, 2).slice(0, 800),
    keyFacts: explained?.keyFacts?.length ? explained.keyFacts : q?.keyFacts || [],
    nextSteps: explained?.nextSteps?.length ? explained.nextSteps : q?.nextSteps || [],
    officialLink: explained?.officialLink || agentRaw?.official_link || usedUrl,
    sources: [
      { title: finalPlan.siteName, url: usedUrl, site: hostnameOf(usedUrl), official: isOfficialSite(usedUrl) },
      ...(q?.sources || []).filter((s) => hostnameOf(s.url) !== hostnameOf(usedUrl)),
    ].slice(0, 4),
    demo: !hasTinyFishKey(),
  };
}
