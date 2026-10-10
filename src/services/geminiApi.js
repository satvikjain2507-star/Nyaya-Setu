import axios from "axios";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-3.5-flash-lite";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const hasKey = () => Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key_here");

export const hasGeminiKey = hasKey;

async function callGemini(systemPrompt, parts, { json = false, maxOutputTokens = 2048, timeout = 30000 } = {}) {
  if (!hasKey()) {
    return json ? null : mockReply(systemPrompt);
  }

  try {
    const response = await axios.post(
      `${BASE_URL}?key=${GEMINI_API_KEY}`,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: json ? 0.2 : 0.4,
          maxOutputTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      },
      { headers: { "Content-Type": "application/json" }, timeout }
    );
    const candidate = response.data.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (json) return parseJsonLoose(text);
    return text || "Sorry, I couldn't generate a reply. Please try again.";
  } catch (err) {
    console.error("Gemini error:", err?.response?.data || err.message);
    if (json) return null;
    return "Sorry, I couldn't reach the AI service right now. Please check your API key and internet connection, and try again.";
  }
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
  return callGemini(systemPrompt, [{ text: userText }], { json: true, maxOutputTokens: 4096, timeout: 45000, ...opts });
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
    { maxOutputTokens: 512 }
  );
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
