import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FlatList, StyleSheet, Alert } from "react-native";
import ChatItem, { runLiveCheckForMessage } from "../components/ChatItem";
import { scamCheck } from "../services/liveIntel";
import ChatInput from "../components/ChatInput";
import KeyboardAware from "../components/KeyboardAware";
import { COLORS } from "../constants/theme";
import { geminiChatWithImage, geminiChat } from "../services/geminiApi";
import { DOCUMENT_SYSTEM_PROMPT_BASE } from "../data/documentPrompts";
import { languageRule } from "../utils/language";
import { speak, stopSpeaking } from "../utils/speaker";
import StopSpeaking from "../components/StopSpeaking";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";
import { pickMedia, mediaLabel } from "../utils/mediaPicker";

const STORAGE_KEY = "chat_history_document";

export default function DocumentSimplifierScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  // stop any reply being read aloud when the user leaves this screen
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const [messages, setMessages] = useState([{ id: "intro", role: "bot", text: t("documentIntro") }]);
  const listRef = useRef(null);
  const scrollEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);

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

  const finish = (loadingId, reply) => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
      persist(next);
      return next;
    });
    speak(reply, geminiLanguageName(), speechRate);
  };

  const systemPrompt = () => `${DOCUMENT_SYSTEM_PROMPT_BASE}\n\n${languageRule(geminiLanguageName())}`;

  // Type or paste the text of a notice
  const handleSend = async (text) => {
    stopSpeaking();
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });
    finish(loadingId, await geminiChat(systemPrompt(), text));
  };

  // Camera · gallery · PDF/file — Gemini reads images and PDFs directly (no OCR step)
  const handleAttach = async (source) => {
    let media;
    try {
      media = await pickMedia(source);
    } catch (e) {
      return Alert.alert("Couldn't open the file", e.message || "Please try again.");
    }
    if (!media) return;
    stopSpeaking();
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text: mediaLabel(media) });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });
    const ask =
      media.kind === "pdf"
        ? "Please read this whole PDF document and summarise it."
        : "Please read and summarise this document.";
    finish(loadingId, await geminiChatWithImage(systemPrompt(), ask, media.base64, media.mimeType));
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
        scamCheck({
          content: `${question && !/^(📷|📄|🖼️)/.test(question) ? `Original text: ${question}\n` : ""}Summary: ${answer}`,
          language: geminiLanguageName(),
        }),
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
      <KeyboardAware onShow={scrollEnd}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatItem item={item.id === "intro" ? { ...item, text: t("documentIntro") } : item} accentColor={COLORS.green} actions={actionsFor(item)} />
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollEnd}
        />
        <StopSpeaking />
        <ChatInput onSend={handleSend} onAttach={handleAttach} placeholder={t("typeMessage")} attachTitle="Add a notice, letter or PDF" />
      </KeyboardAware>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
});
