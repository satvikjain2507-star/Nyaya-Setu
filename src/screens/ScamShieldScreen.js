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
import { Feather } from "@expo/vector-icons";
import ChatItem from "../components/ChatItem";
import ChatInput from "../components/ChatInput";
import KeyboardAware from "../components/KeyboardAware";
import StopSpeaking from "../components/StopSpeaking";
import { openLink } from "../components/LiveCard";
import { COLORS, RADIUS, SPACING, FONT, themed } from "../constants/theme";
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
        check(text, `"${text}"`);
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
      const ok = !item.flags.length;
      return (
        <View style={[styles.flagCard, ok && styles.flagCardOk]}>
          <View style={styles.flagHead}>
            <Feather name={ok ? "search" : "alert-triangle"} size={16} color={ok ? COLORS.teal : COLORS.amber} />
            <Text style={[styles.flagTitle, ok && { color: COLORS.teal }]}>
              {ok ? "No obvious warning signs. Checking live…" : `${item.flags.length} warning sign${item.flags.length > 1 ? "s" : ""} found`}
            </Text>
          </View>
          {item.flags.map((f, i) => (
            <Text key={i} style={styles.flagItem}>
              {f}
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
        <Text style={styles.heroTitle}>{t("scamHeroTitle")}</Text>
        <Text style={styles.heroSub}>{t("scamHeroSub")}</Text>
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.heroBtn} onPress={() => Linking.openURL("tel:1930")}>
            <Feather name="phone" size={15} color={COLORS.onAccent} />
            <Text style={styles.heroBtnText}>Call 1930</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.heroBtn, styles.heroBtnGhost]} onPress={() => openLink("https://cybercrime.gov.in")}>
            <Feather name="globe" size={15} color={COLORS.ink} />
            <Text style={[styles.heroBtnText, { color: COLORS.ink }]}>Report online</Text>
          </TouchableOpacity>
        </View>
      </View>
      {messages.length === 0 && (
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={styles.sectionTitle}>{t("scamSamples")}</Text>
          <View style={styles.list}>
            {SCAM_SAMPLES.map((s, i) => (
              <TouchableOpacity key={s.label} style={[styles.sample, i > 0 && styles.sampleBorder]} onPress={() => !busy && check(s.text)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleLabel}>{s.label}</Text>
                  <Text style={styles.sampleText} numberOfLines={2}>
                    {s.text}
                  </Text>
                </View>
                <Feather name="arrow-up-right" size={18} color={COLORS.faint} />
              </TouchableOpacity>
            ))}
          </View>
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
                <Feather name="plus" size={17} color={COLORS.white} />
                <Text style={styles.clearText}>{t("scamAnother")}</Text>
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

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  heroTitle: { fontFamily: FONT.extrabold, color: COLORS.ink, fontSize: 28, letterSpacing: -0.6 },
  heroSub: { fontFamily: FONT.regular, color: COLORS.ink400, fontSize: 15, lineHeight: 21, marginTop: 4 },
  heroBtns: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: COLORS.rose, borderRadius: RADIUS.pill, paddingHorizontal: 16, height: 42 },
  heroBtnGhost: { backgroundColor: COLORS.surface },
  heroBtnText: { fontFamily: FONT.bold, color: COLORS.onAccent, fontSize: 14 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3, marginBottom: 10 },
  list: { borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  sample: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  sampleBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  sampleLabel: { fontFamily: FONT.bold, fontSize: 15, color: COLORS.ink },
  sampleText: { fontFamily: FONT.regular, fontSize: 13.5, lineHeight: 19, color: COLORS.ink400, marginTop: 3 },
  flagCard: { marginHorizontal: 16, marginVertical: 6, backgroundColor: COLORS.amberSoft, borderRadius: 20, padding: 16 },
  flagCardOk: { backgroundColor: COLORS.tealSoft },
  flagHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  flagTitle: { fontFamily: FONT.bold, color: COLORS.amber, fontSize: 15 },
  flagItem: { fontFamily: FONT.regular, fontSize: 14, color: COLORS.ink600, lineHeight: 21, marginTop: 2 },
  clear: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingHorizontal: 22, height: 48 },
  clearText: { fontFamily: FONT.bold, color: COLORS.white, fontSize: 14.5 },
}));
