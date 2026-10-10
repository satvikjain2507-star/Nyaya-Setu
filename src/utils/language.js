// Strict language rules + text cleaning so replies come in the user's chosen
// language & native script (not English/Hinglish), and read aloud cleanly.

const SCRIPTS = {
  English: "Latin (English alphabet)",
  Hindi: "Devanagari (हिंदी)",
  Marathi: "Devanagari (मराठी)",
  Bengali: "Bengali (বাংলা)",
  Telugu: "Telugu (తెలుగు)",
  Tamil: "Tamil (தமிழ்)",
  Gujarati: "Gujarati (ગુજરાતી)",
  Urdu: "Urdu Nastaliq (اردو)",
  Kannada: "Kannada (ಕನ್ನಡ)",
  Odia: "Odia (ଓଡ଼ିଆ)",
  Malayalam: "Malayalam (മലയാളം)",
  Punjabi: "Gurmukhi (ਪੰਜਾਬੀ)",
  Assamese: "Assamese (অসমীয়া)",
};

export function scriptOf(language) {
  return SCRIPTS[language] || language;
}

/** Instruction appended to every system prompt. */
export function languageRule(language = "English") {
  const format =
    "FORMAT: plain text only. Do NOT use markdown — no asterisks (*), no bold, no # headings. For lists use numbered lines (1. 2. 3.) or the • symbol.";
  if (language === "English") {
    return `LANGUAGE: Reply in simple, everyday English that a person with little schooling can understand. ${format}`;
  }
  return [
    `LANGUAGE RULE — HIGHEST PRIORITY: Write your ENTIRE reply in ${language}, using ONLY the ${scriptOf(language)} script.`,
    `Do this even if the user writes or speaks in English, Hinglish or Roman letters (for example "mujhe card banwana hai").`,
    `NEVER reply in English and NEVER write ${language} in Roman/Latin letters.`,
    `Only official scheme names, website addresses, phone numbers and amounts may stay as they are.`,
    `Use simple, everyday spoken ${language} that a villager would understand — avoid difficult official words.`,
    format,
  ].join(" ");
}

/** Remove markdown so text displays cleanly in chat bubbles. */
export function cleanForDisplay(text) {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[\*\-]\s+/gm, "• ")
    .replace(/\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Clean text for text-to-speech: no markdown, emojis, links or the "You said" echo. */
export function cleanForSpeech(text) {
  if (!text || typeof text !== "string") return "";
  let t = cleanForDisplay(text);
  // drop the transcription echo ("🗣️ You said: ...") — speak only the actual answer
  t = t.replace(/^.*You said:.*$/gim, "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "");
  t = t.replace(/^\s*•\s*/gm, "").replace(/[•→]/g, ", ");
  t = t.replace(/\n+/g, ". ").replace(/([।.!?])\s*\./g, "$1");
  return t.replace(/\s{2,}/g, " ").replace(/^[\s.,]+/, "").trim();
}
