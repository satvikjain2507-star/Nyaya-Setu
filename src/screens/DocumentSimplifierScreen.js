import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import ChatItem, { runLiveCheckForMessage } from "../components/ChatItem";
import { scamCheck } from "../services/liveIntel";
import ChatInput from "../components/ChatInput";
import { COLORS } from "../constants/theme";
import { geminiChatWithImage, geminiChat } from "../services/geminiApi";
import { DOCUMENT_SYSTEM_PROMPT_BASE } from "../data/documentPrompts";
import { languageRule } from "../utils/language";
import { speak, stopSpeaking } from "../utils/speaker";
import StopSpeaking from "../components/StopSpeaking";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";

const STORAGE_KEY = "chat_history_document";

export default function DocumentSimplifierScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  // stop any reply being read aloud when the user leaves this screen
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const [messages, setMessages] = useState([{ id: "intro", role: "bot", text: t("documentIntro") }]);

  useEffect(() => {
    (async () => {
      const saved = await loadMessages(STORAGE_KEY, null);
      if (saved && saved.length > 0) setMessages(saved);
    })();
  }, []);

  const persist = (msgs) => saveMessages(STORAGE_KEY, msgs);

  const appendMessage = (msg) =>
    setMessages((prev) => {
      const next = [...prev, msg];
      persist(next);
      return next;
    });

  const systemPrompt = () => `${DOCUMENT_SYSTEM_PROMPT_BASE}\n\n${languageRule(geminiLanguageName())}`;

  // Fallback path: if the user just wants to type/paste text instead of a photo
  const handleSend = async (text) => {
    stopSpeaking();
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });

    const reply = await geminiChat(systemPrompt(), text);

    setMessages((prev) => {
      const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
      persist(next);
      return next;
    });
    speak(reply, geminiLanguageName(), speechRate);
  };

  // Main path: photograph the document, Gemini reads it directly — no manual typing needed
  const handleImagePress = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text: "📷 (document photo)" });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });

    const reply = await geminiChatWithImage(
      systemPrompt(),
      "Please read and summarise this document.",
      asset.base64,
      "image/jpeg"
    );

    setMessages((prev) => {
      const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
      persist(next);
      return next;
    });
    speak(reply, geminiLanguageName(), speechRate);
  };

  // TinyFish Scam Shield: is this notice / SMS genuine? Checks official sites + fraud alerts live.
  const handleScamCheck = (item) =>
    runLiveCheckForMessage({
      messages,
      item,
      setMessages,
      persist,
      lines: ["Looking for the official source…", "Checking PIB Fact Check & fraud alerts…", "Scanning for known scam patterns…", "Preparing your safety verdict…"],
      task: (question, answer) =>
        scamCheck({ content: `${question && !question.startsWith("📷") ? `Original text: ${question}\n` : ""}Summary: ${answer}`, language: geminiLanguageName() }),
      onResult: (data) => {
        speak(data.headline, geminiLanguageName(), speechRate);
      },
    });

  const actionsFor = (item) => {
    if (item.role !== "bot" || item.id === "intro" || item.kind || item.loading) return undefined;
    const acts = [{ label: t("listen"), onPress: () => speak(item.text, geminiLanguageName(), speechRate) }];
    if (!item.liveChecked) acts.push({ label: t("scamCheck"), onPress: () => handleScamCheck(item) });
    return acts;
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem item={item.id === "intro" ? { ...item, text: t("documentIntro") } : item} accentColor={COLORS.green} actions={actionsFor(item)} />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
      <StopSpeaking />
      <ChatInput onSend={handleSend} onImagePress={handleImagePress} placeholder={t("typeMessage")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
});
