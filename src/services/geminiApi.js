import axios from "axios";
import { scriptOf } from "../utils/language";

// Up to 3 keys (from different Google accounts) — each has its own free quota.
const KEYS = [process.env.EXPO_PUBLIC_GEMINI_API_KEY, process.env.EXPO_PUBLIC_GEMINI_API_KEY_2, process.env.EXPO_PUBLIC_GEMINI_API_KEY_3].filter(
  (k) => k && k !== "your_gemini_api_key_here"
);
// Every model has its OWN free-tier quota. If one is rate-limited or used up for the day,
// the app silently moves to the next one, so a busy model never breaks a feature.
// Always tried in this order: the main model (500 requests/day on your free tier) first, backups only if it fails.
const MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
const urlFor = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const cooldownUntil = new Map(); // "keyIndex|model" -> time it may be used again
const missingModels = new Set(); // models this key/project doesn't have (404)
/** Last error from Gemini, for the Settings diagnostic line and the Expo log. */
export let lastGeminiError = "";

/** Friendly message shown when the AI service can't be reached (never a raw error code). */
export const AI_BUSY = "The AI assistant is very busy right now. Please tap Send again in a few seconds — your message is safe.";
export const isAiBusy = (text) => typeof text === "string" && text === AI_BUSY;

const hasKey = () => KEYS.length > 0;

export const hasGeminiKey = hasKey;

function combos() {
  const all = [];
  KEYS.forEach((_, k) => MODELS.forEach((m) => all.push({ k, m })));
  const now = Date.now();
  const usable = all.filter((c) => !missingModels.has(c.m) && (cooldownUntil.get(`${c.k}|${c.m}`) || 0) <= now);
  // if everything is cooling down, try them all anyway (cool-downs are only estimates)
  return usable.length ? usable : all.filter((c) => !missingModels.has(c.m));
}

async function callGemini(systemPrompt, parts, opts = {}) {
  const { json = false, maxOutputTokens = 2048, timeout = 30000 } = opts;
  if (!hasKey()) {
    return json ? null : mockReply(systemPrompt);
  }
  const deadline = Date.now() + Math.max(timeout * 2, 45000);
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: json ? 0.2 : 0.4,
      maxOutputTokens,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };

  for (const c of combos()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > deadline) break;
      try {
        // same request format that has always worked for this app (key as ?key= query parameter)
        const response = await axios.post(`${urlFor(c.m)}?key=${KEYS[c.k]}`, body, {
          headers: { "Content-Type": "application/json" },
          timeout,
        });
        const candidate = response.data.candidates?.[0];
        const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!text) throw Object.assign(new Error("empty reply"), { emptyReply: true });
        lastGeminiError = "";
        if (json) {
          const parsed = parseJsonLoose(text);
          if (parsed) return parsed;
          throw Object.assign(new Error("bad JSON"), { emptyReply: true });
        }
        return text;
      } catch (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error?.message || err.message || "";
        lastGeminiError = `${c.m}: ${status || "network"} ${msg}`.slice(0, 200);
        console.log("Gemini:", lastGeminiError);
        if (status === 404 || (status === 400 && /not found|not supported|unknown model|invalid model/i.test(msg))) {
          missingModels.add(c.m);
          break; // next model
        }
        if (status === 429) {
          const daily = /per ?day|daily|PerDay/i.test(msg);
          cooldownUntil.set(`${c.k}|${c.m}`, Date.now() + (daily ? 3600000 : 60000));
          break; // next model straight away — it has its own quota
        }
        if (status === 401 || status === 403 || (status === 400 && /api key/i.test(msg))) {
          MODELS.forEach((m) => cooldownUntil.set(`${c.k}|${m}`, Date.now() + 3600000));
          break; // this key is bad — the next key (if any) is tried
        }
        if (err.emptyReply || status === 500 || status === 502 || status === 503 || status === 504 || !status) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 600));
            continue; // one quick retry on the same model
          }
          break;
        }
        break; // any other error: try the next model
      }
    }
    if (Date.now() > deadline) break;
  }
  if (json) return null;
  return AI_BUSY;
}

function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) {}
    }
  }
  return null;
}

/**
 * Structured JSON reply — used by the TinyFish "live intelligence" layer to
 * plan browser tasks and turn raw web data into verified answers.
 * Returns a parsed object, or null on failure / no key.
 */
export async function geminiJSON(systemPrompt, userText, opts = {}) {
  return callGemini(systemPrompt, [{ text: userText }], { json: true, maxOutputTokens: 4096, timeout: 30000, ...opts });
}

/** Transcribe a voice recording into plain text (any Indian language). */
export async function geminiTranscribe(audioBase64, mimeType = "audio/m4a") {
  if (!hasKey()) return "Check PM-KISAN eligibility and documents";
  const text = await callGemini(
    "You are a precise speech-to-text engine for Indian languages.",
    [
      { text: "Transcribe this audio exactly, in the language it was spoken. Reply with ONLY the transcription." },
      { inline_data: { mime_type: mimeType, data: audioBase64 } },
    ],
    { maxOutputTokens: 512, timeout: 30000 }
  );
  if (!text || isAiBusy(text)) return "";
  return text.replace(/^["']|["']$/g, "");
}

/**
 * Plain text chat — used for typed messages in all three pillars.
 */
export async function geminiChat(systemPrompt, userMessage) {
  return callGemini(systemPrompt, [{ text: userMessage }]);
}

/**
 * Send a photographed document directly to Gemini's vision understanding —
 * this replaces a separate OCR step entirely. `imageBase64` should NOT
 * include the "data:image/jpeg;base64," prefix, just the raw base64 data.
 */
export async function geminiChatWithImage(systemPrompt, userMessage, imageBase64, mimeType = "image/jpeg") {
  return callGemini(systemPrompt, [
    { text: userMessage },
    { inline_data: { mime_type: mimeType, data: imageBase64 } },
  ]);
}

/**
 * Send a voice recording directly to Gemini — it transcribes AND
 * understands the request in one call, so no separate speech-to-text
 * service is needed. `audioBase64` should be raw base64 data (no prefix).
 * The reply always starts with the transcript so the user can see what
 * was heard, followed by the actual response.
 */
export async function geminiChatWithAudio(systemPrompt, audioBase64, mimeType = "audio/m4a") {
  return callGemini(systemPrompt, [
    {
      text: 'The user sent this as a voice message. First write exactly: "🗣️ You said: " followed by your best transcription of the audio in quotes (write it in the native script of the language that was spoken, e.g. Devanagari for Hindi — not Roman letters), then a blank line, then your actual response to their request. Your response MUST strictly follow the LANGUAGE RULE in the system instructions.',
    },
    { inline_data: { mime_type: mimeType, data: audioBase64 } },
  ]);
}

/**
 * Translate text (or a voice recording) between English and Hindi.
 * `direction` is either "en-hi" or "hi-en".
 */
export async function geminiTranslateText(text, direction) {
  const [source, target] = direction === "en-hi" ? ["English", "Hindi"] : ["Hindi", "English"];
  const prompt = `Translate the following text from ${source} to ${target}. Reply with ONLY the translation, nothing else, no quotes, no explanation.\n\nText: ${text}`;
  return callGemini("You are a precise translator.", [{ text: prompt }]);
}

export async function geminiTranslateAudio(audioBase64, direction, mimeType = "audio/m4a") {
  const [source, target] = direction === "en-hi" ? ["English", "Hindi"] : ["Hindi", "English"];
  const systemPrompt = "You are a precise translator.";
  const prompt = `This audio is speech in ${source}. First write exactly: "🗣️ You said: " followed by your transcription in ${source}, then a new line with exactly: "➡️ Translation: " followed by the ${target} translation. Nothing else.`;
  return callGemini(systemPrompt, [{ text: prompt }, { inline_data: { mime_type: mimeType, data: audioBase64 } }]);
}

/**
 * General-purpose visual Q&A — photograph anything (not just official
 * documents) and ask a question about it, like Google Lens / Gemini's app.
 */
export async function geminiVisualSolve(userQuestion, imageBase64, mimeType = "image/jpeg") {
  const systemPrompt =
    "You are a helpful visual assistant. The user has photographed something and asked a question about it — it could be a math or homework problem, a plant/object/animal to identify, a diagram to explain, a machine part, or anything else. Look at the image carefully and answer their question clearly and helpfully, showing your reasoning briefly if it's a problem to solve. Keep the reply under 200 words unless step-by-step working is needed.";
  return callGemini(systemPrompt, [
    { text: userQuestion || "What is this, and can you help me understand or solve it?" },
    { inline_data: { mime_type: mimeType, data: imageBase64 } },
  ]);
}

// ---- Offline demo fallback so the app is always presentable without a key ----
function mockReply(systemPrompt) {
  if (systemPrompt.includes("Scheme Navigator")) {
    return "Based on what you've described, you may be eligible for the National Scholarship Portal scheme for your child's education. You'll typically need: income certificate, caste certificate (if applicable), previous year's mark sheet, and a bank passbook copy. (Demo mode — add EXPO_PUBLIC_GEMINI_API_KEY to .env for real responses.)";
  }
  if (systemPrompt.includes("Legal Companion")) {
    return "For a land-encroachment issue: (1) File a written complaint at your local police station citing trespass. (2) If unresolved, approach the Sub-Divisional Magistrate under local revenue law. (3) Keep land ownership documents ready. This is general guidance — confirm with a lawyer or your nearest Legal Services Authority. (Demo mode — add your API key for real responses.)";
  }
  if (systemPrompt.includes("Document Simplifier")) {
    return "Summary: This looks like a municipal property tax notice. (1) An amount is due for this financial year. (2) Payment deadline is within 30 days. (3) Late payment may attract a penalty. (Demo mode — add your API key for real document reading.)";
  }
  return "(demo mode — add EXPO_PUBLIC_GEMINI_API_KEY to .env for real responses)";
}

// ───────────── Translation between any of the 13 supported languages ─────────────

/** Translate text. `from` may be null (auto-detect). Returns only the translation. */
export async function geminiTranslate(text, from, to) {
  const src = from ? `from ${from}` : "from whatever language it is written in (detect it automatically)";
  const prompt = `Translate the text below ${src} into ${to}. Write the translation ONLY in the ${scriptOf(to)} script. Keep names, numbers, amounts and website addresses unchanged. Use simple, natural, everyday ${to}. Reply with ONLY the translation — no quotes, no notes, no transliteration.\n\nText: ${text}`;
  const out = await callGemini("You are a precise, natural translator for Indian languages.", [{ text: prompt }]);
  return typeof out === "string" ? out.replace(/^["']|["']$/g, "").trim() : out;
}

/** Translate a voice note. Returns { said, translation }. */
export async function geminiTranslateVoice(audioBase64, from, to, mimeType = "audio/m4a") {
  const src = from ? `It is spoken in ${from}.` : "Detect the spoken language automatically.";
  const prompt = `This audio is a person speaking. ${src} First write exactly "SAID:" followed by the transcription in the original language and its native script. Then on a new line write exactly "TRANSLATION:" followed by the ${to} translation written only in the ${scriptOf(to)} script. Nothing else.`;
  const reply = await callGemini("You are a precise speech translator for Indian languages.", [
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: audioBase64 } },
  ]);
  if (isAiBusy(reply)) return { said: "", translation: reply };
  const said = (reply.split(/TRANSLATION:/i)[0] || "").replace(/SAID:/i, "").trim();
  const translation = (reply.split(/TRANSLATION:/i)[1] || reply).trim();
  return { said, translation };
}
