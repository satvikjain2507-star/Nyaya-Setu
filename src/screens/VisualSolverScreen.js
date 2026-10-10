import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import { FlatList, StyleSheet, Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import ChatBubble from "../components/ChatBubble";
import ChatInput from "../components/ChatInput";
import { COLORS } from "../constants/theme";
import { geminiVisualSolve, geminiChat } from "../services/geminiApi";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";
import { useEffect } from "react";

const STORAGE_KEY = "chat_history_visual_solver";

export default function VisualSolverScreen() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([{ id: "intro", role: "bot", text: t("askAboutPhoto") }]);
  const [pendingImage, setPendingImage] = useState(null); // { uri, base64 }

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

  const handleCameraPress = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPendingImage({ uri: asset.uri, base64: asset.base64 });
    appendMessage({
      id: Date.now().toString(),
      role: "bot",
      text: "Photo ready — now type your question below (e.g. \"what is this?\" or \"solve this problem\"), or just tap Send to get a general explanation.",
    });
  };

  const handleSend = async (text) => {
    const userMsgId = Date.now().toString();
    appendMessage({ id: userMsgId, role: "user", text: pendingImage ? `📷 ${text}` : text });
    const loadingId = userMsgId + "-loading";
    appendMessage({ id: loadingId, role: "bot", loading: true });

    let reply;
    if (pendingImage) {
      reply = await geminiVisualSolve(text, pendingImage.base64, "image/jpeg");
      setPendingImage(null);
    } else {
      reply = await geminiChat(
        "You are a helpful visual assistant in the Nyaya Setu app. The user hasn't attached a photo yet — politely ask them to tap 📷 to photograph what they need help with, unless their message is a general question you can answer directly.",
        text
      );
    }

    setMessages((prev) => {
      const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
      persist(next);
      return next;
    });
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      {pendingImage && (
        <View style={styles.previewWrap}>
          <Image source={{ uri: pendingImage.uri }} style={styles.preview} />
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble role={item.role} text={item.text} loading={item.loading} accentColor={COLORS.navy} />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
      <ChatInput onSend={handleSend} onImagePress={handleCameraPress} placeholder={t("typeMessage")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  previewWrap: { padding: 10, alignItems: "center" },
  preview: { width: 120, height: 120, borderRadius: 10 },
});
