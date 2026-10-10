import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import ChatItem, { runLiveCheckForMessage } from "../components/ChatItem";
import { verifyLive } from "../services/liveIntel";
import ChatInput from "../components/ChatInput";
import { COLORS } from "../constants/theme";
import { geminiChat, geminiChatWithAudio } from "../services/geminiApi";
import { LEGAL_SYSTEM_PROMPT_BASE } from "../data/legalScenarios";
import { languageRule } from "../utils/language";
import { speak, stopSpeaking } from "../utils/speaker";
import StopSpeaking from "../components/StopSpeaking";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";

const STORAGE_KEY = "chat_history_legal";

export default function LegalCompanionScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  // stop any reply being read aloud when the user leaves this screen
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const [messages, setMessages] = useState([{ id: "intro", role: "bot", text: t("legalIntro") }]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(null);

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

  const systemPrompt = () => `${LEGAL_SYSTEM_PROMPT_BASE}\n\n${languageRule(geminiLanguageName())}`;

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

  const handleMicPress = async () => {
    if (!isRecording) {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    } else {
      setIsRecording(false);
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

        const userMsgId = Date.now().toString();
        appendMessage({ id: userMsgId, role: "user", text: "🎤 (voice message)" });
        const loadingId = userMsgId + "-loading";
        appendMessage({ id: loadingId, role: "bot", loading: true });

        const reply = await geminiChatWithAudio(systemPrompt(), base64, "audio/m4a");

        setMessages((prev) => {
          const next = prev.map((m) => (m.id === loadingId ? { ...m, loading: false, text: reply } : m));
          persist(next);
          return next;
        });

      speak(reply, geminiLanguageName(), speechRate);
      } catch (err) {
        console.error("Failed to process recording:", err);
      }
    }
  };

  // TinyFish: cross-check this answer against live official websites
  const handleVerify = (item) =>
    runLiveCheckForMessage({
      messages,
      item,
      setMessages,
      persist,
      lines: ["Searching official legal portals…", "Reading nalsa.gov.in, cybercrime.gov.in…", "Checking the latest official process…", "Preparing a verified answer…"],
      task: (question, answer) => verifyLive({ question, answer, mode: "legal", language: geminiLanguageName() }),
      onResult: (data) => {
        speak(`${data.headline}. ${data.summary}`, geminiLanguageName(), speechRate);
      },
    });

  const actionsFor = (item) => {
    if (item.role !== "bot" || item.id === "intro" || item.kind || item.loading) return undefined;
    const acts = [{ label: t("listen"), onPress: () => speak(item.text, geminiLanguageName(), speechRate) }];
    if (!item.liveChecked) acts.push({ label: t("verifyLive"), onPress: () => handleVerify(item) });
    return acts;
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem item={item.id === "intro" ? { ...item, text: t("legalIntro") } : item} accentColor={COLORS.purple} actions={actionsFor(item)} />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
      <StopSpeaking />
      <ChatInput
        onSend={handleSend}
        onMicPress={handleMicPress}
        isRecording={isRecording}
        placeholder={t("typeMessage")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
});
