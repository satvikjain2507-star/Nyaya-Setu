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
    // never cache an empty result — a failed lookup must not stick for hours
    if (value && !(Array.isArray(value) && value.length === 0)) await AsyncStorage.setItem(k, JSON.stringify({ at: Date.now(), value }));
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
export async function findHelpCentersLive({ city, district, state, locality }) {
  const place = [city || district, state].filter(Boolean).join(", ");
  if (!place) throw new Error("Could not detect your city.");
  const near = [locality, city || district].filter(Boolean).join(", ");

  return cached(`help4_${keyOf(near + "|" + place)}`, 24 * 3600 * 1000, async () => {
    const queries = [
      `Common Service Centre CSC ${near} ${state || ""} address phone`,
      `District Legal Services Authority ${district || city} ${state || ""} address phone`,
      `police station ${near} ${state || ""} address phone`,
      `One Stop Centre Sakhi women help ${district || city} ${state || ""} address`,
    ];
    const sets = await Promise.all(queries.map((q) => tinyfishSearch(q, { location: "IN", purpose: `Find the exact address and phone of real offices near ${near}` }).catch(() => [])));
    const all = sets.flatMap((rs, i) => rs.slice(0, 7).map((r) => ({ ...r, bucket: i })));
    if (all.length === 0) return [];

    const extracted = await geminiJSON(
      "You extract real, specific physical offices from web search results. Never invent names, addresses or phone numbers — use only what appears in the results.",
      `User location: ${near}, ${state || ""}\n\nLIVE SEARCH RESULTS (TinyFish):\n${all
        .map((r) => `- [bucket ${r.bucket}] ${r.title} | ${r.snippet || ""} | ${r.url}`)
        .join("\n")}\n\nBuckets: 0=CSC (scheme applications), 1=DLSA (free legal aid), 2=Police station (FIR), 3=One Stop Centre (women's help).\nRULES: Each entry must be ONE specific physical office with a real street/area address taken from the results (e.g. "CSC — Laxmi Nagar", "Shakarpur Police Station", "DLSA East, Karkardooma Courts"). DO NOT return website titles, home pages, directories or lists (e.g. "Welcome to Common Services Centres", "List of CSC", "Homepage | ..."). Skip anything without a usable address. Put the closest to ${near} first.\nReturn JSON: {"centers": [{"name": "", "type": "CSC (Scheme applications) | Legal Aid (DLSA) | Police Station (FIR filing) | One Stop Centre (Women)", "address": "", "phone": "digits only or empty", "url": "source url"}]} — up to 10 entries.`
    );

    const JUNK = /welcome|home ?page|^list of|official (web)?site|portal|directory|e-governance services india|\||\.(pdf|docx?|xlsx?|aspx?|php|html?)\b|^https?:/i;
    const centers = (extracted?.centers || []).filter(
      (c) => c?.name && !JUNK.test(c.name) && c.address && c.address.length > 8 && !/text size|skip to main/i.test(c.address)
    );
    if (centers.length > 0) return centers.map((c, i) => ({ ...c, id: `live-${i}`, live: true }));
    // AI extraction unavailable → still show real offices straight from the live search results
    return heuristicCenters(all, [locality, city, district, state]).map((c, i) => ({ ...c, id: `live-${i}`, live: true }));
  });
}

const CENTER_TYPES = ["CSC (Scheme applications)", "Legal Aid (DLSA)", "Police Station (FIR filing)", "One Stop Centre (Women)"];
const SOCIAL = /facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|scribd\.com|linkedin\.com/i;
const ADDRESS_HINT = /\b\d{6}\b|road|marg|nagar|complex|floor|court|colony|sector|vihar|enclave|market|block|chowk|bazar|lane|gali|near /i;

/** No-AI fallback: pick search results whose snippet reads like a real street address. */
function heuristicCenters(all, placeWords = []) {
  const words = placeWords.filter(Boolean).flatMap((w) => String(w).toLowerCase().split(/[\s,]+/)).filter((w) => w.length > 3);
  const out = [];
  const seen = new Set();
  for (const r of all) {
    if (SOCIAL.test(r.url || "")) continue;
    const snippet = String(r.snippet || "").replace(/\s+/g, " ").trim();
    if (!ADDRESS_HINT.test(snippet)) continue;
    const hay = `${r.title} ${snippet}`.toLowerCase();
    if (words.length && !words.some((w) => hay.includes(w))) continue; // must be in the user's area
    const name = String(r.title || "").split(/ [|\-–:] |, /)[0].trim();
    if (!name || name.length < 4 || /\.(pdf|docx?|xlsx?|aspx?|php|html?)$/i.test(name) || /welcome|home ?page|^list of|^top |^popular |^best |directory|near me|^find |^know |^driving directions|^get directions|centers in|centres in|^police in |services in |^one stop centres?$|^a day |blog|article/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const phone = (snippet.match(/\+91[\s-]?\d{10}|\b0\d{2,4}[\s-]?\d{6,8}\b|\b[6-9]\d{9}\b/) || [""])[0].replace(/[^\d+]/g, "");
    const type = CENTER_TYPES[r.bucket] || "Help Centre";
    const label = /csc|cent(re|er)|police|station|thana|legal|dlsa|authority|court|sakhi|one stop/i.test(name) ? name : `${type.split(" (")[0]} — ${name}`;
    out.push({ name: label, type, address: snippet.slice(0, 160), phone, url: r.url });
    if (out.length >= 8) break;
  }
  return out;
}

// ─────────────────────── 4. LIVE UPDATES FEED ───────────────────────

// Only citizen-useful news: schemes, deadlines, rights, fraud alerts. Never politics, crime or entertainment.
const NEWS_RELEVANT = /scheme|yojana|pension|subsid|kisan|farmer|scholarship|ayushman|ration|aadhaar|\bpan\b|e-?kyc|insurance|\bloan|mudra|awas|housing|ujjwala|\blpg\b|jan dhan|welfare|benefit|apply|registration|deadline|last date|helpline|fraud|scam|cyber|digital arrest|phishing|\botp\b|\bupi\b|advisory|consumer|legal aid|nalsa|lok adalat|\brti\b|e-shram|labour|senior citizen|women|girl|student|ration card|voter id|passport|driving licen|sanchar saathi|ceir|pib fact/i;
const NEWS_BLOCK = /election|\bpoll|\bbjp\b|congress|\baap\b|party|opposition|rally|slams|imran|pakistan|protest|\bwar\b|attack|killed|murder|rape|terror|cricket|\bipl\b|bollywood|film|actor|actress|celebrity|stock|sensex|nifty|share price|\bipo\b|crypto|bitcoin|gold price|horoscope|time magazine|voter deletion|citizenship|\bsir\b|upsc|notes|renames?\b.*name/i;

/** Latest scheme / citizen-rights / fraud-alert news from the last 7 days. Cached for 6 hours. */
export async function getLiveUpdates({ language = "English", force = false } = {}) {
  const key = `updates3_${language}_${new Date().toISOString().slice(0, 10)}`;
  if (force) await AsyncStorage.removeItem(CACHE_PREFIX + key).catch(() => {});

  return cached(key, 6 * 3600 * 1000, async () => {
    const week = 7 * 24 * 60;
    const sets = await Promise.all([
      tinyfishSearch("government scheme yojana launched apply citizens India", { location: "IN", domainType: "news", recencyMinutes: week }).catch(() => []),
      tinyfishSearch("scheme deadline extended registration last date India", { location: "IN", domainType: "news", recencyMinutes: week }).catch(() => []),
      tinyfishSearch("cyber fraud scam alert advisory citizens India", { location: "IN", domainType: "news", recencyMinutes: week }).catch(() => []),
      tinyfishSearch("scheme yojana citizens", { location: "IN", includeDomains: ["pib.gov.in"], recencyMinutes: week }).catch(() => []),
    ]);
    let items = rankOfficialFirst(sets.flat()).filter((x) => x.title && NEWS_RELEVANT.test(`${x.title} ${x.snippet || ""}`) && !NEWS_BLOCK.test(x.title));
    // keep a mix: at most 4 scheme items + 2 fraud alerts
    const fraud = items.filter((x) => /fraud|scam|cyber|digital arrest|phishing/i.test(x.title));
    const rest = items.filter((x) => !fraud.includes(x));
    items = [...rest.slice(0, 4), ...fraud.slice(0, 2)].slice(0, 6);
    if (items.length === 0) return [];

    if (language !== "English") {
      const tr = await geminiJSON(
        "You translate news headlines for rural Indian citizens. Keep it simple.",
        `Translate each headline into simple ${language}, written only in the ${scriptOf(language)} script. Return JSON {"titles": [..same order..]}\n${items.map((x, i) => `${i + 1}. ${x.title}`).join("\n")}`
      );
      if (tr?.titles?.length === items.length) items = items.map((x, i) => ({ ...x, title: tr.titles[i] }));
    }
    return items.map((x) => ({
      title: x.title,
      url: x.url,
      site: x.publisher || hostnameOf(x.url),
      date: x.date || "",
      official: isOfficialSite(x.url),
      fraud: /fraud|scam|cyber|धोखा|साइबर/i.test(x.title),
    }));
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

// any official government website is allowed; only the few that refuse cloud browsers are skipped
const isReachable = (url) => !isCloudBlocked(url) && (isOfficialSite(url) || REACHABLE_HOSTS.some((r) => hostnameOf(url || "").endsWith(r)));
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
    "The citizen is WATCHING you live and waiting, so be FAST and focused: finish in about 10 actions or fewer. Do not explore unrelated pages.",
    deep
      ? "You are on the official page for this task."
      : `You are on the official website's home page. Suggested route: ${plan.steps || "use the site search or menu to open the most relevant page."}`,
    "1. If a pop-up, cookie banner or language selector appears, close it.",
    "2. Scroll through this page and open only the sections that answer the task (Benefits, Eligibility, Documents Required, Application Process). Skip FAQs and unrelated tabs.",
    "3. Open ONE more official page only if the documents or how-to-apply steps are missing here. As soon as you have eligibility, documents and how to apply, stop and return the answer.",
    "4. Never log in, never type personal details, never submit forms, never pay, and never leave official .gov.in / .nic.in websites.",
    "Copy the Documents Required list exactly as written on the official page.",
    'Return JSON with keys "title", "summary", "eligibility", "benefits", "documents" (array), "steps" (array of how to apply / what to do), "fees" (if shown), "helpline" (if shown), "official_link" (the official URL where the citizen should apply or act).',
    'If the page shows 403 / Forbidden / Access Denied / cannot be reached / a captcha / stays blank, stop at once and return {"blocked": true}.',
  ].join("\n");
}

const EXPLAIN_SYSTEM =
  "You explain government information to Indian citizens in very simple, spoken-style language. Use only the provided live data. Never invent amounts, dates, fees or links.";

async function explainData({ request, raw, siteName, language, extra, previous }) {
  const cross = previous
    ? `\n\nAN INSTANT ANSWER was given earlier from AI memory (NOT verified): """${String(previous).slice(0, 1500)}"""\nCompare it with the LIVE DATA and add to the JSON: "crossCheck": {"status": "confirmed" if the instant answer agrees with the official data, or "corrected" if any amount, eligibility rule, document or step was wrong or missing, "note": "one short sentence in ${language} saying what the official page confirmed or corrected"}.`
    : "";
  return geminiJSON(
    EXPLAIN_SYSTEM,
    `Citizen request: """${request}"""${cross}\nLIVE DATA collected just now from ${siteName} (official sources, via TinyFish):\n${typeof raw === "string" ? raw : JSON.stringify(raw, null, 1).slice(0, 12000)}${extra ? `\n\nEXTRA CONTEXT from other official pages (use only if the live data above lacks it):\n${extra.slice(0, 3000)}` : ""}\n\n${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{"answer": "5-7 simple spoken sentences: what the scheme/service gives (exact amounts if in the data), who is eligible, the main documents needed, and how to apply", "eligibility": ["who can get it — up to 5 short points"], "documents": ["EVERY document listed as required in the data, one per item, short names"], "keyFacts": ["up to 4 other short facts (benefit amount, fees, deadlines, helpline)"], "nextSteps": ["up to 5 short numbered action steps to apply / act"], "officialLink": "official URL from the data or empty string"}
If the citizen asked about a scheme or service, "documents" must NOT be empty: use the documents in the data; only if the data has none, list the documents normally asked for this scheme and make the first item "Confirm the final list on the official website".`
  );
}

/**
 * Instant answer (~3-6 s): Gemini answers straight away so the citizen hears something useful
 * while the TinyFish cloud browser is still starting. Replaced by the verified answers later.
 */
async function instantAnswer({ request, language }) {
  const out = await geminiJSON(
    "You are Nyaya Setu, a helpful assistant for Indian citizens on government schemes, documents and legal help. Answer from your knowledge in very simple spoken language. Be accurate; if unsure of an exact amount or date, say it should be confirmed on the official website. Never invent website links.",
    `Citizen request: """${request}"""\n\n${languageRule(language)} All text values in the JSON must follow this rule. Return JSON:\n{"answer": "5-7 simple spoken sentences: what it is, who can get it, then ONE sentence that names every required document (e.g. 'You will need: Aadhaar card, income certificate, bank passbook and a photo.'), then how to apply", "eligibility": ["up to 4 short points"], "documents": ["every document usually required, short names"], "documentsSentence": "one spoken sentence naming all the required documents", "nextSteps": ["up to 4 short steps"]}\nThe answer MUST include the required documents whenever the request is about a scheme, card, certificate, application or government service.`,
    { maxOutputTokens: 1500, timeout: 20000 }
  );
  if (!out?.answer) return null;
  const docs = Array.isArray(out.documents) ? out.documents : [];
  let answer = out.answer;
  // guarantee the spoken answer names the documents
  if (docs.length && !docs.slice(0, 2).some((d) => answer.includes(String(d).split(/[ (/]/)[0]))) {
    answer = `${answer} ${out.documentsSentence || docs.join(", ")}`;
  }
  return { mode: "instant", answer, eligibility: out.eligibility || [], documents: out.documents || [], keyFacts: [], nextSteps: out.nextSteps || [], officialLink: "", sources: [] };
}

/** Fast path (~10-20 s): TinyFish Search + Fetch of official pages, explained by Gemini. */
async function quickAnswer({ request, plan, language, startPagesP, instantP }) {
  const [found, startPages] = await Promise.all([
    tinyfishSearch(`${plan.searchQuery || request} eligibility documents required how to apply`, { location: "IN", purpose: `${request} — eligibility, documents required and how to apply` }).catch(() => []),
    startPagesP ? startPagesP.catch(() => []) : Promise.resolve([]),
  ]);
  const results = rankOfficialFirst(found);
  const deep = startPages.filter((u) => isDeepPage(u) && !/myscheme\.gov\.in/.test(u)).slice(0, 1);
  if (results.length === 0 && deep.length === 0) return null;
  const toRead = [...new Set([...deep, ...results.filter((r) => isOfficialSite(r.url) && !isCloudBlocked(r.url) && !/myscheme\.gov\.in/.test(r.url)).map((r) => r.url)])].slice(0, 4);
  const { results: pages } = toRead.length
    ? await tinyfishFetch(toRead, { purpose: request, perUrlTimeoutMs: 15000 }).catch(() => ({ results: [] }))
    : { results: [] };
  const raw = pagesToContext(pages.filter((pg) => (pg.text || "").length > 400), results.slice(0, 8));
  const previous = instantP ? (await Promise.race([instantP, sleepMs(4000).then(() => null)]))?.answer : null;
  const explained = await explainData({ request, raw, siteName: "official websites", language, previous });
  if (!explained?.answer) return null;
  return {
    mode: "search",
    answer: explained.answer,
    keyFacts: explained.keyFacts || [],
    nextSteps: explained.nextSteps || [],
    documents: explained.documents || [],
    eligibility: explained.eligibility || [],
    officialLink: explained.officialLink || results.find((r) => isOfficialSite(r.url))?.url || "",
    sources: toSources([...pages, ...results], 4),
    crossCheck: normCross(explained.crossCheck),
    pagesRead: pages.length,
    rawContext: raw,
    demo: !hasTinyFishKey(),
  };
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function normCross(c) {
  if (!c || !c.status) return null;
  return { status: /correct/i.test(c.status) ? "corrected" : "confirmed", note: String(c.note || "") };
}

const asList = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : typeof v === "string" && v ? [v] : []);
function agentAnswer(raw) {
  if (!raw) return "";
  const parts = [raw.summary || raw.title || ""];
  const docs = asList(raw.documents);
  if (docs.length) parts.push(`Documents needed: ${docs.slice(0, 6).join(", ")}.`);
  const steps = asList(raw.steps);
  if (steps.length) parts.push(`How to apply: ${steps.slice(0, 3).join(" ")}`);
  if (raw.official_link) parts.push(`Official link: ${raw.official_link}`);
  return parts.filter(Boolean).join("\n\n") || JSON.stringify(raw, null, 2).slice(0, 800);
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
export async function runSahayakTask({ request, language = "English", onPlan, onUpdate, onQuick, onInstant, onStage, shouldStop }) {
  // Pipeline stages shown to the citizen: Gemini understands → TinyFish finds → TinyFish browses → Gemini verifies
  const stage = (key, status, detail) => {
    try {
      onStage?.(key, status, detail);
    } catch (_) {}
  };
  stage("understand", "active");
  // start speaking at once — runs in parallel with planning and the browser start-up
  const instantP = instantAnswer({ request, language })
    .then((a) => {
      if (a && !shouldStop?.()) onInstant?.(a);
      return a;
    })
    .catch(() => null);
  const plan = await planAgentTask({ request });
  onPlan?.(plan);
  stage("understand", "done", plan.taskTitle);
  stage("find", "active");

  // search for the exact official page once; both the quick answer and the live agent use it
  const startPagesP = findStartPages(plan);
  const quickP = quickAnswer({ request, plan, language, startPagesP, instantP })
    .then((q) => {
      if (q && !shouldStop?.()) onQuick?.({ ...q, plan });
      return q;
    })
    .catch(() => null);

  const candidates = await startPagesP;
  if (shouldStop?.()) return { cancelled: true, plan };
  stage("find", "done", candidates[0] ? hostnameOf(candidates[0]) : "");
  stage("browse", "active");

  const started = Date.now();
  const TOTAL_BUDGET = 150000; // tested 22 Oct: thorough browsing took 3-4.5 min — the citizen already has a quick answer, so cap the live agent at 2.5 min
  let history = []; // steps from earlier attempts, shown in the timeline
  let agentRaw = null;
  let usedUrl = candidates[0];
  let streamingUrl = null;
  let retriedStuck = false;

  for (let i = 0; i < Math.min(candidates.length, 3) && !agentRaw; i++) {
    const url = candidates[i];
    const remaining = TOTAL_BUDGET - (Date.now() - started);
    if (remaining < 40000) break;
    usedUrl = url;
    const current = { ...plan, url, siteName: siteLabel(url) };
    onPlan?.(current);
    if (i > 0) history = [...history, { action: `Opening another official page: ${hostnameOf(url)}`, status: "COMPLETED" }];

    let switchTo = false;
    let stuck = false;
    const attemptStarted = Date.now();
    const watch = (u) => {
      if (u.streamingUrl) streamingUrl = u.streamingUrl;
      // a cloud browser that hasn't taken a single step in 55 s is stuck — open a fresh one
      if (!stuck && (u.steps || []).length === 0 && Date.now() - attemptStarted > 55000) {
        stuck = true;
        switchTo = true;
      }
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
      if (stuck && !retriedStuck) {
        retriedStuck = true;
        history = [...history, { action: "Browser was slow to start — opening a fresh one", status: "COMPLETED" }];
        i--; // same page again in a new browser
        continue;
      }
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
  stage("browse", agentRaw ? "done" : "skipped", agentRaw ? siteLabel(usedUrl) : "");
  stage("verify", "active");

  if (!agentRaw) {
    onUpdate?.({ status: "FALLBACK", streamingUrl, steps: [...history, { action: "Answer prepared from official government pages ✓", status: "COMPLETED" }], elapsed: Date.now() - started });
    if (q) {
      stage("verify", "done", `${q.pagesRead || q.sources?.length || 0} official pages`);
      return { ...q, plan: finalPlan, steps: history };
    }
    stage("verify", "error");
    throw new Error("Couldn't reach the official websites right now. Please check your internet and try again.");
  }

  onUpdate?.({ status: "COMPLETED", streamingUrl, steps: [...history, { action: `Finished on ${hostnameOf(usedUrl)} ✓`, status: "COMPLETED" }], elapsed: Date.now() - started });
  const instant = await Promise.race([instantP, sleepMs(1000).then(() => null)]);
  const explained = await explainData({ request, raw: agentRaw, siteName: finalPlan.siteName, language, extra: q?.rawContext, previous: instant?.answer });
  stage("verify", "done", finalPlan.siteName);
  return {
    plan: finalPlan,
    mode: "agent",
    crossCheck: normCross(explained?.crossCheck) || q?.crossCheck || null,
    steps: history,
    answer: explained?.answer || q?.answer || agentAnswer(agentRaw),
    keyFacts: explained?.keyFacts?.length ? explained.keyFacts : q?.keyFacts?.length ? q.keyFacts : asList(agentRaw?.benefits).slice(0, 4),
    nextSteps: explained?.nextSteps?.length ? explained.nextSteps : q?.nextSteps?.length ? q.nextSteps : asList(agentRaw?.steps).slice(0, 6),
    documents: explained?.documents?.length ? explained.documents : q?.documents || (Array.isArray(agentRaw?.documents) ? agentRaw.documents : []),
    eligibility: explained?.eligibility?.length ? explained.eligibility : q?.eligibility?.length ? q.eligibility : asList(agentRaw?.eligibility).slice(0, 6),
    officialLink: explained?.officialLink || agentRaw?.official_link || usedUrl,
    sources: [
      { title: finalPlan.siteName, url: usedUrl, site: hostnameOf(usedUrl), official: isOfficialSite(usedUrl) },
      ...(q?.sources || []).filter((s) => hostnameOf(s.url) !== hostnameOf(usedUrl)),
    ].slice(0, 4),
    demo: !hasTinyFishKey(),
  };
}
