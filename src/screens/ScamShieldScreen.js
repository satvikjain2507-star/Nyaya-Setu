/**
 * SCAM SHIELD — paste, photograph, upload or speak any suspicious SMS,
 * WhatsApp message, call script or notice.
 *   1. Instant offline red-flag scan (milliseconds)
 *   2. Live check via TinyFish Search: official sources + fraud alerts / PIB fact checks
 *   3. Gemini verdict in the citizen's language: Genuine / Suspicious / Likely SCAM
 *   4. One tap: call 1930, report on cybercrime.gov.in, warn family on WhatsApp
 */
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FlatList, StyleSheet, Alert, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import ChatItem from "../components/ChatItem";
import ChatInput from "../components/ChatInput";
import KeyboardAware from "../components/KeyboardAware";
import StopSpeaking from "../components/StopSpeaking";
import { openLink } from "../components/LiveCard";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { scamCheck } from "../services/liveIntel";
import { geminiChatWithImage, geminiTranscribe, isAiBusy } from "../services/geminiApi";
import { useVoiceRecorder } from "../utils/voiceRecorder";
import { pickMedia, mediaLabel } from "../utils/mediaPicker";
import { redFlags, offlineVerdict, SCAM_SAMPLES } from "../utils/scamSignals";
import { speak, stopSpeaking } from "../utils/speaker";
import { useLanguage } from "../context/LanguageContext";
import { loadMessages, saveMessages } from "../utils/chatStorage";

const STORAGE_KEY = "chat_history_scam_shield";

export default function ScamShieldScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const voice = useVoiceRecorder();
  const listRef = useRef(null);

  useEffect(() => {
    (async () => {
      const saved = await loadMessages(STORAGE_KEY, null);
      if (saved && saved.length > 0) setMessages(saved.filter((m) => !m.loading && m.kind !== "liveLoading"));
    })();
  }, []);

  const persist = (msgs) => saveMessages(STORAGE_KEY, msgs);
  const scrollEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);
  const append = (msg) => setMessages((prev) => [...prev, msg]);
  const replace = (id, msg) =>
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === id ? msg : m));
      persist(next);
      return next;
    });

  /** Core flow: red flags instantly → live TinyFish check → verdict card. */
  const check = async (content, displayText) => {
    if (!content?.trim()) return;
    stopSpeaking();
    setBusy(true);
    const id = Date.now().toString();
    const flags = redFlags(content);
    append({ id: `${id}-u`, role: "user", text: displayText || content });
    append({ id: `${id}-f`, kind: "flags", flags });
    const loadingId = `${id}-l`;
    append({
      id: loadingId,
      kind: "liveLoading",
      loading: true,
      lines: ["Looking for the official source…", "Searching PIB Fact Check & fraud alerts…", "Comparing with known scam patterns…", "Preparing your safety verdict…"],
    });

    let data;
    try {
      data = await scamCheck({
        content: `${content}${flags.length ? `\n\nRed flags found automatically: ${flags.join("; ")}` : ""}`,
        language: geminiLanguageName(),
      });
      // never let the live verdict look safer than strong offline evidence
      if (flags.length >= 3 && data.verdict === "likely_genuine") data.verdict = "suspicious";
    } catch (e) {
      data = offlineVerdict(flags, geminiLanguageName());
    }
    replace(loadingId, { id: loadingId, kind: "live", role: "bot", data });
    speak(data.headline, geminiLanguageName(), speechRate);
    setBusy(false);
  };

  const handleSend = (text) => check(text);

  const handleAttach = async (source) => {
    try {
      const media = await pickMedia(source);
      if (!media) return;
      setBusy(true);
      const id = Date.now().toString();
      append({ id: `${id}-r`, kind: "liveLoading", loading: true, lines: ["Reading the message in your screenshot…", "Finding the sender and any links…"] });
      const extracted = await geminiChatWithImage(
        "You read screenshots and photos of SMS, WhatsApp messages, emails, letters and official-looking notices for a scam checker.",
        "Copy out the exact message text shown, plus the sender (name, number, email or link) if visible. Reply in plain text in this format:\nSender: ...\nMessage: ...\nIf it is a letter or notice, give its issuing office, what it asks the reader to do, any amounts, deadlines, phone numbers and links.",
        media.base64,
        media.mimeType
      );
      setMessages((prev) => prev.filter((m) => m.id !== `${id}-r`));
      if (!extracted || isAiBusy(extracted)) {
        setBusy(false);
        return Alert.alert("Couldn't read that image", "The AI is busy right now. Please try again in a few seconds, or paste the message text.");
      }
      await check(extracted, `${mediaLabel(media)}\n${extracted.slice(0, 400)}`);
    } catch (e) {
      setBusy(false);
      Alert.alert("Couldn't open the file", e.message || "Please try again.");
    }
  };

  const handleMicPress = async () => {
    if (!isRecording) {
      try {
        const ok = await voice.start();
        if (!ok) return Alert.alert("Microphone permission is needed for voice.");
        setIsRecording(true);
      } catch (err) {
        console.warn("Failed to start recording:", err);
      }
    } else {
      setIsRecording(false);
      try {
        const base64 = await voice.stop();
        if (!base64) return;
        setBusy(true);
        const text = await geminiTranscribe(base64, "audio/m4a");
        setBusy(false);
        if (!text?.trim()) return Alert.alert("Couldn't hear that clearly", "Please try again, or paste the message text.");
        check(text, `🎤 "${text}"`);
      } catch (err) {
        setBusy(false);
        console.warn("Failed to process recording:", err);
      }
    }
  };

  const clearAll = () => {
    setMessages([]);
    persist([]);
  };

  const renderItem = ({ item }) => {
    if (item.kind === "flags") {
      return (
        <View style={[styles.flagCard, !item.flags.length && styles.flagCardOk]}>
          <Text style={[styles.flagTitle, !item.flags.length && { color: COLORS.teal }]}>
            {item.flags.length ? `⚠️ ${item.flags.length} warning sign${item.flags.length > 1 ? "s" : ""} spotted instantly` : "🔍 No obvious warning signs — checking live…"}
          </Text>
          {item.flags.map((f, i) => (
            <Text key={i} style={styles.flagItem}>
              • {f}
            </Text>
          ))}
        </View>
      );
    }
    return <ChatItem item={item} accentColor={COLORS.rose} />;
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>🛡️ {t("scamShield")}</Text>
        <Text style={styles.heroSub}>{t("scamShieldHero")}</Text>
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.heroBtn} onPress={() => Linking.openURL("tel:1930")}>
            <Text style={styles.heroBtnText}>📞 1930 Helpline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.heroBtn, styles.heroBtnGhost]} onPress={() => openLink("https://cybercrime.gov.in")}>
            <Text style={[styles.heroBtnText, { color: COLORS.white }]}>🌐 cybercrime.gov.in</Text>
          </TouchableOpacity>
        </View>
      </View>
      {messages.length === 0 && (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Text style={styles.howTitle}>{t("scamHow")}</Text>
          <View style={styles.howRow}>
            {[
              ["📋", "Paste the SMS"],
              ["🖼️", "Upload screenshot"],
              ["🎤", "Speak it"],
            ].map(([i, l]) => (
              <View key={l} style={styles.howItem}>
                <Text style={styles.howIcon}>{i}</Text>
                <Text style={styles.howLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.sectionTitle}>{t("trySample")}</Text>
          {SCAM_SAMPLES.map((s) => (
            <TouchableOpacity key={s.label} style={styles.sample} onPress={() => !busy && check(s.text)} activeOpacity={0.85}>
              <Text style={styles.sampleIcon}>{s.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sampleLabel}>{s.label}</Text>
                <Text style={styles.sampleText} numberOfLines={2}>
                  {s.text}
                </Text>
              </View>
              <Text style={styles.go}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <KeyboardAware onShow={scrollEnd}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={Header}
          ListFooterComponent={
            messages.length > 0 && !busy ? (
              <TouchableOpacity onPress={clearAll} style={styles.clear}>
                <Text style={styles.clearText}>＋ Check another message</Text>
              </TouchableOpacity>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => messages.length && scrollEnd()}
        />
        <StopSpeaking />
        <ChatInput
          onSend={handleSend}
          onAttach={handleAttach}
          onMicPress={handleMicPress}
          isRecording={isRecording}
          placeholder={t("scamPlaceholder")}
          sendLabel={t("checkBtn")}
          attachTitle="Upload a screenshot, photo or PDF"
        />
      </KeyboardAware>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.parchment },
  hero: { backgroundColor: COLORS.ink, margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1.5, borderColor: COLORS.rose },
  heroTitle: { color: COLORS.white, fontSize: 21, fontWeight: "800" },
  heroSub: { color: "#D9CFE0", fontSize: 13, lineHeight: 19, marginTop: 6 },
  heroBtns: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, flexWrap: "wrap" },
  heroBtn: { backgroundColor: COLORS.rose, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 },
  heroBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#D9CFE0" },
  heroBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 12.5 },
  howTitle: { fontSize: 12.5, fontWeight: "800", color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.6, marginTop: SPACING.xs },
  howRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  howItem: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, paddingVertical: SPACING.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  howIcon: { fontSize: 22 },
  howLabel: { fontSize: 11.5, color: COLORS.darkGray, marginTop: 4, fontWeight: "600", textAlign: "center" },
  sectionTitle: { fontSize: 12.5, fontWeight: "800", color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACING.sm },
  sample: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  sampleIcon: { fontSize: 22 },
  sampleLabel: { fontSize: 14, fontWeight: "700", color: COLORS.ink900 },
  sampleText: { fontSize: 12, color: COLORS.midGray, marginTop: 2 },
  go: { fontSize: 22, color: COLORS.rose, fontWeight: "800" },
  flagCard: { marginHorizontal: SPACING.md, marginVertical: SPACING.xs + 2, backgroundColor: "#FFF4DC", borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 4, borderLeftColor: "#A86A00" },
  flagCardOk: { backgroundColor: COLORS.tealSoft, borderLeftColor: COLORS.teal },
  flagTitle: { fontWeight: "800", color: "#A86A00", fontSize: 13.5, marginBottom: 4 },
  flagItem: { fontSize: 13, color: COLORS.darkGray, lineHeight: 19 },
  clear: { alignSelf: "center", marginTop: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.rose },
  clearText: { color: COLORS.rose, fontWeight: "800" },
});
