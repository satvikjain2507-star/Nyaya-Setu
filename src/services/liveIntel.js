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
  return items.slice(0, max).map((r) => ({
    title: r.title || hostnameOf(r.url),
    url: r.final_url || r.url,
    site: hostnameOf(r.final_url || r.url),
    official: isOfficialSite(r.final_url || r.url),
  }));
}

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

const TRUSTED_SITES = `
- https://www.myscheme.gov.in/search  (search ANY central/state scheme: eligibility, benefits, documents)
- https://pmkisan.gov.in  (PM-KISAN farmer income support)
- https://beneficiary.nha.gov.in  (Ayushman Bharat card) · https://pmjay.gov.in
- https://nfsa.gov.in  (ration card / food security)
- https://sarathi.parivahan.gov.in  (driving licence) · https://parivahan.gov.in (vehicle services)
- https://www.passportindia.gov.in  (passport)
- https://uidai.gov.in  (Aadhaar update / services)
- https://pmaymis.gov.in · https://pmay-urban.gov.in  (housing)
- https://scholarships.gov.in  (National Scholarship Portal)
- https://cybercrime.gov.in  (report cyber fraud, helpline 1930)
- https://rtionline.gov.in  (file RTI)
- https://consumerhelpline.gov.in · https://edaakhil.nic.in  (consumer complaints)
- https://nalsa.gov.in  (free legal aid)
- https://agmarknet.gov.in  (mandi / crop prices)
- https://www.india.gov.in  (general citizen services — use only if nothing above fits)
`;

/** Gemini turns a citizen's request (any language) into a precise, FAST browser task. */
export async function planAgentTask({ request }) {
  const plan = await geminiJSON(
    "You plan short, fast web-browsing tasks for an AI browser agent that helps Indian citizens. The agent can read pages, click, scroll and type. It must NEVER log in, enter personal data (Aadhaar, phone, bank, OTP), pay money, or submit applications.",
    `Citizen request (may be in any Indian language): """${request}"""\n\nPick the MOST SPECIFIC official starting page from this list (a deep page is better than a home page):\n${TRUSTED_SITES}\n\nWrite a short numbered goal (max 6 steps) for the agent. Speed matters: the agent must extract information from the first relevant page instead of exploring many pages. It must close pop-ups / language selectors if they appear. The goal must end with: Return JSON with keys "title", "summary", "eligibility", "benefits", "documents" (array), "steps" (array), "official_link", "fees" (if shown). If the page is blocked or shows a captcha, return {"blocked": true}.\n\nReturn JSON: {"url": "starting URL", "siteName": "short site name", "goal": "the numbered goal in English", "searchQuery": "English web search query to find the official page for this request", "taskTitle": "short title of the task in English"}`
  );

  if (plan?.url && plan?.goal) return plan;
  return {
    url: "https://www.myscheme.gov.in/search",
    siteName: "myScheme",
    taskTitle: request.slice(0, 60),
    searchQuery: `${request} official site gov.in`,
    goal: `1. Close any pop-up. 2. Search for: "${request}". 3. Open the most relevant result. 4. Extract eligibility, benefits, documents required and how to apply. Return JSON with keys "title", "summary", "eligibility", "benefits", "documents", "steps", "official_link". If blocked, return {"blocked": true}.`,
  };
}

const EXPLAIN_SYSTEM =
  "You explain government information to Indian citizens in very simple, spoken-style language. Use only the provided live data. Never invent amounts, dates, fees or links.";

async function explainData({ request, raw, siteName, language }) {
  return geminiJSON(
    EXPLAIN_SYSTEM,
    `Citizen request: """${request}"""\nLIVE DATA collected just now from ${siteName} (official sources, via TinyFish):\n${typeof raw === "string" ? raw : JSON.stringify(raw, null, 1).slice(0, 12000)}\n\n${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{"answer": "4-6 simple sentences that can be read aloud", "keyFacts": ["up to 5 short facts"], "nextSteps": ["up to 3 short action steps"], "officialLink": "official URL from the data or empty string"}`
  );
}

/** Fast path (~10-20 s): TinyFish Search + Fetch of official pages, explained by Gemini. */
async function quickAnswer({ request, plan, language }) {
  const results = rankOfficialFirst(
    await tinyfishSearch(plan.searchQuery || request, { location: "IN", purpose: request }).catch(() => [])
  );
  if (results.length === 0) return null;
  const { results: pages } = await tinyfishFetch(results.slice(0, 2).map((r) => r.url), { purpose: request }).catch(() => ({ results: [] }));
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
    demo: !hasTinyFishKey(),
  };
}

/**
 * Sahayak Live: plan → (in parallel) quick answer from official pages + live TinyFish
 * browser agent that the citizen can watch. The quick answer appears within seconds;
 * the agent's result upgrades it when ready. If the agent is slow or blocked, the
 * quick answer is kept — the citizen is never left waiting with nothing.
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

  let agentRaw = null;
  let steps = [];
  let agentErr = null;
  try {
    const run = await runAgentWithLiveUpdates({ url: plan.url, goal: plan.goal, onUpdate, shouldStop, maxWaitMs: 150000 });
    steps = run.steps || [];
    if (run.status === "CANCELLED") return { cancelled: true, plan };
    if (run.status === "COMPLETED" && run.result && !run.result?.blocked && !looksBlocked(run.result)) agentRaw = run.result;
    else agentErr = run.error?.message || "the website did not respond in time";
  } catch (e) {
    agentErr = e.message;
  }
  if (shouldStop?.()) return { cancelled: true, plan };

  if (!agentRaw) {
    onUpdate?.({ status: "FALLBACK", steps: [...steps, { action: `Live browser: ${agentErr} — answer taken from official pages instead`, status: "COMPLETED" }] });
    const q = await quickP;
    if (q) return { ...q, plan, steps };
    throw new Error(agentErr || "Could not fetch information right now. Please try again.");
  }

  const explained = await explainData({ request, raw: agentRaw, siteName: plan.siteName, language });
  const q = await Promise.race([quickP, new Promise((r) => setTimeout(() => r(null), 100))]);
  return {
    plan,
    mode: "agent",
    steps,
    answer: explained?.answer || q?.answer || JSON.stringify(agentRaw, null, 2).slice(0, 800),
    keyFacts: explained?.keyFacts || q?.keyFacts || [],
    nextSteps: explained?.nextSteps || q?.nextSteps || [],
    officialLink: explained?.officialLink || agentRaw?.official_link || plan.url,
    sources: [
      { title: plan.siteName, url: plan.url, site: hostnameOf(plan.url), official: isOfficialSite(plan.url) },
      ...(q?.sources || []).filter((s) => hostnameOf(s.url) !== hostnameOf(plan.url)),
    ].slice(0, 4),
    demo: !hasTinyFishKey(),
  };
}
