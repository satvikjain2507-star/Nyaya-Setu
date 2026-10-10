import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STRINGS, LANGUAGES } from "../data/translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "nyaya_setu_language";
const RATE_STORAGE_KEY = "nyaya_setu_speech_rate";

export function LanguageProvider({ children }) {
  const [langCode, setLangCode] = useState("en");
  const [speechRate, setSpeechRateState] = useState(1.0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLang) setLangCode(savedLang);
        const savedRate = await AsyncStorage.getItem(RATE_STORAGE_KEY);
        if (savedRate) setSpeechRateState(parseFloat(savedRate));
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const changeLanguage = async (code) => {
    setLangCode(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
      console.error("Failed to save language:", e);
    }
  };

  const setSpeechRate = async (rate) => {
    setSpeechRateState(rate);
    try {
      await AsyncStorage.setItem(RATE_STORAGE_KEY, String(rate));
    } catch (e) {
      console.error("Failed to save speech rate:", e);
    }
  };

  const t = (key) => STRINGS[langCode]?.[key] || STRINGS.en[key] || key;
  const geminiLanguageName = () => LANGUAGES.find((l) => l.code === langCode)?.geminiName || "English";

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ langCode, changeLanguage, t, geminiLanguageName, speechRate, setSpeechRate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
