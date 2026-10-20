import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FlatList, StyleSheet, Image, View, Text, TouchableOpacity, Alert } from "react-native";
import ChatBubble from "../components/ChatBubble";
import ChatInput from "../components/ChatInput";
import KeyboardAware from "../components/KeyboardAware";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { geminiVisualSolve, geminiChat } from "../services/geminiApi";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";
import { languageRule } from "../utils/language";
import { pickMedia, mediaLabel } from "../utils/mediaPicker";
import { speak } from "../utils/speaker";

const STORAGE_KEY = "chat_history_visual_solver";

export default function VisualSolverScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  const [messages, setMessages] = useState([{ id: "intro", role: "bot", text: t("askAboutPhoto") }]);
  const [pending, setPending] = useState(null); // { uri, base64, mimeType, name, kind }
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

  const handleAttach = async (source) => {
    try {
      const media = await pickMedia(source);
      if (!media) return;
      setPending(media);
    } catch (e) {
      Alert.alert("Couldn't open the file", e.message || "Please try again.");
    }
  };

  const handleSend = async (text) => {
    if (!text && !pending) return;
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text: pending ? `${mediaLabel(pending)}${text ? `\n${text}` : ""}` : text });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });

    let reply;
    if (pending) {
      const media = pending;
      setPending(null);
      const q = `${text || "What is this, and can you help me understand or solve it?"}\n\n${languageRule(geminiLanguageName())}`;
      reply = await geminiVisualSolve(q, media.base64, media.mimeType);
    } else {
      reply = await geminiChat(
        `You are a helpful visual assistant in the Nyaya Setu app. The user hasn't attached a photo yet — politely ask them to tap 📎 to take a photo, choose one from the gallery or upload a PDF, unless their message is a general question you can answer directly.\n\n${languageRule(geminiLanguageName())}`,
        text
      );
    }

    setMessages((prev) => {
      const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
      persist(next);
      return next;
    });
  };

  const actionsFor = (item) =>
    item.role === "bot" && !item.loading && item.id !== "intro" ? [{ label: t("listen"), onPress: () => speak(item.text, geminiLanguageName(), speechRate) }] : undefined;

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <KeyboardAware onShow={scrollEnd}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble role={item.role} text={item.id === "intro" ? t("askAboutPhoto") : item.text} loading={item.loading} accentColor={COLORS.navy} actions={actionsFor(item)} />
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollEnd}
        />
        {pending && (
          <View style={styles.pending}>
            {pending.kind === "image" ? (
              <Image source={{ uri: pending.uri }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.pdf]}>
                <Text style={{ fontSize: 26 }}>📄</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle} numberOfLines={1}>
                {pending.kind === "pdf" ? pending.name : "Ready to analyse"}
              </Text>
              <Text style={styles.pendingSub}>Type a question, or just tap Send</Text>
            </View>
            <TouchableOpacity onPress={() => setPending(null)}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <ChatInput onSend={handleSend} onAttach={handleAttach} placeholder={t("typeMessage")} allowEmptySend={!!pending} />
      </KeyboardAware>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  pending: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: COLORS.parchment, borderWidth: 1, borderColor: COLORS.border },
  preview: { width: 56, height: 56, borderRadius: 10 },
  pdf: { backgroundColor: COLORS.goldSoft, alignItems: "center", justifyContent: "center" },
  pendingTitle: { fontWeight: "700", color: COLORS.ink900, fontSize: 13.5 },
  pendingSub: { color: COLORS.midGray, fontSize: 12, marginTop: 2 },
  remove: { fontSize: 18, color: COLORS.rose, fontWeight: "800", paddingHorizontal: 8 },
});
