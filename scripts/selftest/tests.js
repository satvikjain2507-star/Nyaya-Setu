/* Live end-to-end self-test for Nyaya Setu — runs the REAL app services (Gemini + TinyFish) in Node. */
import axios from "axios";
import { tinyfishSearch, tinyfishFetch, startAgentRun, getAgentRun, cancelAgentRun, hasTinyFishKey } from "../../src/services/tinyfishApi";
import { geminiJSON, geminiChat, geminiTranslate, hasGeminiKey, lastGeminiError } from "../../src/services/geminiApi";
import { planAgentTask, runSahayakTask, scamCheck, findHelpCentersLive, getLiveUpdates, verifyLive } from "../../src/services/liveIntel";

const QUICK = process.argv.includes("--quick");
const ONLY_SAHAYAK = process.argv.includes("--sahayak");
const results = [];
const t0 = () => Date.now();
const secs = (s) => ((Date.now() - s) / 1000).toFixed(1) + "s";
const log = (...a) => console.log(...a);

async function test(name, fn) {
  const s = t0();
  process.stdout.write(`… ${name}\n`);
  try {
    const detail = await fn();
    results.push({ name, ok: true, time: secs(s), detail });
    log(`  ✅ PASS ${name} (${secs(s)}) ${detail ? "— " + String(detail).slice(0, 220) : ""}`);
  } catch (e) {
    results.push({ name, ok: false, time: secs(s), detail: e?.message || String(e) });
    log(`  ❌ FAIL ${name} (${secs(s)}) — ${e?.message || e}`);
  }
}
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.8-flash"];

async function main() {
  log(`\nNyaya Setu live self-test · ${new Date().toLocaleString()} · ${QUICK ? "quick" : "full"}\n`);
  must(hasGeminiKey(), "No Gemini key in .env");
  must(hasTinyFishKey(), "No TinyFish key in .env");

  if (!ONLY_SAHAYAK) {
  // ── 1. Gemini models (each has its own free quota) ──
  for (const m of MODELS) {
    await test(`Gemini model ${m}`, async () => {
      const r = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: "Reply with the single word OK" }] }] },
        { timeout: 30000, validateStatus: () => true }
      );
      must(r.status === 200, `HTTP ${r.status} ${r.data?.error?.message || ""}`.slice(0, 160));
      return r.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    });
  }
  await test("Gemini JSON mode (app client with failover)", async () => {
    const j = await geminiJSON("Return JSON only.", 'Return {"ok": true, "lang": "Hindi word for water"}');
    must(j?.ok === true, `bad JSON reply (${lastGeminiError})`);
    return JSON.stringify(j);
  });
  await test("Gemini translate English → Tamil", async () => {
    const out = await geminiTranslate("Your Ayushman card is ready.", "English", "Tamil");
    must(/[஀-௿]/.test(out), `not Tamil script: ${out}`);
    return out;
  });

  // ── 2. TinyFish Search + Fetch ──
  await test("TinyFish Search (India, official first)", async () => {
    const r = await tinyfishSearch("PM-KISAN eligibility documents", { location: "IN" });
    must(r.length > 0, "0 results");
    return `${r.length} results · top: ${r[0].url}`;
  });
  await test("TinyFish Fetch (PM-KISAN official page)", async () => {
    const { results: pages, errors } = await tinyfishFetch(["https://pmkisan.gov.in/"], { perUrlTimeoutMs: 30000 });
    const len = pages[0]?.text?.length || 0;
    must(len > 300, `page text too short (${len}) ${JSON.stringify(errors).slice(0, 120)}`);
    return `${len} chars · "${pages[0].title}"`;
  });

  // ── 3. Gemini → TinyFish coordination: planning ──
  for (const req of ["मेरे पिता 72 साल के हैं, उनका आयुष्मान कार्ड कैसे बनेगा?", "My phone was stolen today. How do I block it?", "How to file an RTI application online"]) {
    await test(`Gemini plans agent task: "${req.slice(0, 40)}"`, async () => {
      const p = await planAgentTask({ request: req });
      must(p?.url?.startsWith("https://"), "no start URL");
      must(!/pmjay\.gov\.in|cybercrime\.gov\.in|nfsa\.gov\.in/.test(p.url), `planned a blocked site ${p.url}`);
      return `${p.siteName} → ${p.url} · search: "${p.searchQuery}"`;
    });
  }

  // ── 4. TinyFish Agent API: start, stream URL, cancel ──
  await test("TinyFish Agent run starts + live stream URL", async () => {
    const id = await startAgentRun({ url: "https://www.myscheme.gov.in/schemes/pm-kisan", goal: "Read the Eligibility section and return JSON {\"eligibility\": \"...\"}" });
    let stream = null;
    let status = "";
    const s = Date.now();
    while (Date.now() - s < 90000 && !stream) {
      await new Promise((r) => setTimeout(r, 3000));
      const run = await getAgentRun(id);
      stream = run.streaming_url;
      status = run.status;
      if (["FAILED", "CANCELLED", "COMPLETED"].includes(status)) break;
    }
    await cancelAgentRun(id);
    must(stream || status === "COMPLETED", `no live stream after 90 s (status ${status})`);
    return `run ${id} · status ${status} · stream ${stream ? "✓" : "—"}`;
  });

  }
  // ── 5. Sahayak Live end to end (the core pillar) ──
  const sahayak = ONLY_SAHAYAK ? ["How can my 72-year-old father get an Ayushman card?", "मेरा फ़ोन चोरी हो गया है, उसे कैसे ब्लॉक करूँ?", "Am I eligible for PM-KISAN? What documents do I need?"] : QUICK ? ["How can my 72-year-old father get an Ayushman card?"] : ["How can my 72-year-old father get an Ayushman card?", "मेरा फ़ोन चोरी हो गया है, उसे कैसे ब्लॉक करूँ?"];
  for (const req of sahayak) {
    await test(`Sahayak Live end-to-end: "${req.slice(0, 45)}"`, async () => {
      const s = Date.now();
      const marks = {};
      const stages = [];
      let maxSteps = 0;
      let stream = false;
      const lang = /[ऀ-ॿ]/.test(req) ? "Hindi" : "English";
      const res = await runSahayakTask({
        request: req,
        language: lang,
        onInstant: () => (marks.instant ??= secs(s)),
        onQuick: () => (marks.quick ??= secs(s)),
        onPlan: (p) => (marks.plan ??= `${secs(s)} ${p.url}`),
        onStage: (k, st, d) => stages.push(`${k}:${st}${d ? `(${d})` : ""}@${secs(s)}`),
        onUpdate: (u) => {
          maxSteps = Math.max(maxSteps, (u.steps || []).length);
          if (u.streamingUrl) stream = true;
        },
      });
      log(`     stages: ${stages.join(" → ")}`);
      log(`     instant ${marks.instant || "—"} · quick ${marks.quick || "—"} · plan ${marks.plan || "—"} · agent steps ${maxSteps} · live stream ${stream ? "yes" : "no"}`);
      log(`     mode: ${res.mode} · docs ${res.documents?.length || 0} · crossCheck: ${JSON.stringify(res.crossCheck)}`);
      log(`     answer: ${String(res.answer).slice(0, 260)}`);
      must(res.answer && res.answer.length > 80, "no answer");
      must(marks.instant, "no instant answer");
      must(["agent", "search"].includes(res.mode), `unexpected mode ${res.mode}`);
      if (lang === "Hindi") must(/[ऀ-ॿ]/.test(res.answer), "answer not in Hindi");
      return `mode=${res.mode} instant=${marks.instant} quick=${marks.quick} total=${secs(s)} stream=${stream} steps=${maxSteps} cross=${res.crossCheck?.status || "-"}`;
    });
  }

  if (ONLY_SAHAYAK) return finish();
  // ── 6. Scam Shield ──
  await test("Scam Shield flags fake SBI KYC SMS", async () => {
    const r = await scamCheck({
      content: "प्रिय ग्राहक, आपका SBI खाता आज रात 12 बजे ब्लॉक हो जाएगा क्योंकि KYC अपडेट नहीं है। तुरंत इस link पर KYC करें: http://sbi-kyc-verify.in/update और OTP शेयर करें। Helpline 9123456780",
      language: "English",
    });
    must(r.verdict === "likely_scam", `verdict was ${r.verdict}`);
    return `${r.verdict} · ${r.headline} · sources ${r.sources.length}`;
  });
  await test("Scam Shield keeps genuine message calm", async () => {
    const r = await scamCheck({ content: "Your PM-KISAN instalment of Rs 2000 has been credited to your bank account. Check status at pmkisan.gov.in. -PMKISAN", language: "English" });
    must(r.verdict !== "likely_scam", `false alarm: ${r.verdict}`);
    return `${r.verdict} · ${r.headline}`;
  });

  // ── 7. Nearby Help Centres ──
  await test("Help Centres live (Laxmi Nagar, East Delhi)", async () => {
    const list = await findHelpCentersLive({ city: "Delhi", district: "East Delhi", state: "Delhi", locality: "Laxmi Nagar" });
    must(list.length > 0, "no centres found");
    const types = [...new Set(list.map((c) => c.type.split(" (")[0]))].join(", ");
    return `${list.length} centres (${types}) · e.g. ${list[0].name} — ${list[0].address}`;
  });

  // ── 8. Live updates + Verify Live ──
  await test("Live updates feed (last 7 days)", async () => {
    const u = await getLiveUpdates({ language: "English", force: true });
    must(u.length > 0, "empty feed");
    return `${u.length} items · ${u[0].title}`;
  });
  if (!QUICK)
    await test("Verify Live (scheme answer vs official pages)", async () => {
      const ans = await geminiChat("You are Scheme Navigator. Be brief.", "What does PM-KISAN give farmers?");
      const v = await verifyLive({ question: "What does PM-KISAN give farmers?", answer: ans, mode: "scheme" });
      must(v.sources.length > 0, "no sources");
      return `${v.verdict} · ${v.headline} · ${v.sources.map((x) => x.site).join(", ")}`;
    });

  finish();
}
function finish() {
  const pass = results.filter((r) => r.ok).length;
  log(`\n════ ${pass}/${results.length} passed ════`);
  results.filter((r) => !r.ok).forEach((r) => log(`  ❌ ${r.name}: ${r.detail}`));
  require("fs").writeFileSync(require("path").join(__dirname, "selftest-report.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  log(`Report saved to scripts/selftest-report.json\n`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
