// Maps Gemini's display language name to a TTS locale expo-speech understands.
const LOCALE_MAP = {
  English: "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Bengali: "bn-IN",
  Telugu: "te-IN",
  Tamil: "ta-IN",
  Gujarati: "gu-IN",
  Urdu: "ur-IN",
  Kannada: "kn-IN",
  Odia: "or-IN",
  Malayalam: "ml-IN",
  Punjabi: "pa-IN",
  Assamese: "as-IN",
};

export function getSpeechLocale(languageName) {
  return LOCALE_MAP[languageName] || "en-IN";
}
