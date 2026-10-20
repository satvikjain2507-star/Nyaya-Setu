import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Pressable, Share } from "react-native";
import { useVoiceRecorder } from "../utils/voiceRecorder";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { geminiTranslate, geminiTranslateVoice } from "../services/geminiApi";
import { LANGUAGES } from "../data/translations";
import ChatInput from "../components/ChatInput";
import KeyboardAware from "../components/KeyboardAware";
import StopSpeaking from "../components/StopSpeaking";
import { speak, stopSpeaking } from "../utils/speaker";

const AUTO = { code: "auto", label: "Detect language", geminiName: null };
const nameOf = (l) => (l.code === "auto" ? "Auto-detect" : l.label);

export default function TranslatorScreen() {
  const { t, speechRate, langCode } = useLanguage();
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const [from, setFrom] = useState(AUTO);
  const [to, setTo] = useState(LANGUAGES.find((l) => l.code === (langCode === "en" ? "hi" : langCode)) || LANGUAGES[1]);
  const [picker, setPicker] = useState(null); // "from" | "to" | null
  const [sourceText, setSourceText] = useState("");
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const voice = useVoiceRecorder();
  const scrollRef = useRef(null);

  const swap = () => {
    if (from.code === "auto") {
      // after auto-detect, swapping means "reply back in the detected language" — use English as a sensible default
      setFrom(to);
      setTo(LANGUAGES[0]);
    } else {
      setFrom(to);
      setTo(from);
    }
    if (resultText) {
      setSourceText(resultText);
      setResultText("");
    }
  };

  const handleTranslateText = async (text) => {
    stopSpeaking();
    setSourceText(text);
    setResultText("");
    setLoading(true);
    const translated = await geminiTranslate(text, from.geminiName, to.geminiName);
    setResultText(translated);
    setLoading(false);
    speak(translated, to.geminiName, speechRate);
  };

  const handleMicPress = async () => {
    if (!isRecording) {
      try {
        stopSpeaking();
        const ok = await voice.start();
        if (!ok) return Alert.alert("Microphone permission is needed for voice translation.");
        setIsRecording(true);
      } catch (err) {
        console.warn("Failed to start recording:", err);
      }
    } else {
      setIsRecording(false);
      setLoading(true);
      setResultText("");
      try {
        const base64 = await voice.stop();
        if (!base64) return;
        const { said, translation } = await geminiTranslateVoice(base64, from.geminiName, to.geminiName, "audio/m4a");
        setSourceText(said || "(voice message)");
        setResultText(translation);
        speak(translation, to.geminiName, speechRate);
      } catch (err) {
        console.warn("Failed to process recording:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const options = picker === "from" ? [AUTO, ...LANGUAGES] : LANGUAGES;

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <KeyboardAware>
        <View style={styles.langBar}>
          <TouchableOpacity style={styles.langBtn} onPress={() => setPicker("from")}>
            <Text style={styles.langCaption}>From</Text>
            <Text style={styles.langName} numberOfLines={1}>
              {nameOf(from)} ▾
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.swapBtn} onPress={swap} accessibilityLabel="Swap languages">
            <Text style={styles.swapText}>⇄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.langBtn} onPress={() => setPicker("to")}>
            <Text style={styles.langCaption}>To</Text>
            <Text style={styles.langName} numberOfLines={1}>
              {nameOf(to)} ▾
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {!sourceText && !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗣️ → 🌐</Text>
              <Text style={styles.emptyText}>Speak 🎤 or type in any of 13 Indian languages. The translation is shown and read aloud.</Text>
              <View style={styles.chips}>
                {LANGUAGES.map((l) => (
                  <TouchableOpacity key={l.code} style={[styles.chip, to.code === l.code && styles.chipOn]} onPress={() => setTo(l)}>
                    <Text style={[styles.chipText, to.code === l.code && styles.chipTextOn]}>{l.label.split(" (")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {sourceText ? (
            <View style={styles.sourceBox}>
              <Text style={styles.sourceLabel}>Original · {nameOf(from)}</Text>
              <Text style={styles.sourceText}>{sourceText}</Text>
            </View>
          ) : null}

          {loading && (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator color={COLORS.orange} />
              <Text style={{ color: COLORS.midGray, marginTop: 8 }}>{t("translating")}</Text>
            </View>
          )}

          {resultText ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Translation · {nameOf(to)}</Text>
              <Text style={styles.resultText}>{resultText}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={styles.playBtn} onPress={() => speak(resultText, to.geminiName, speechRate)}>
                  <Text style={styles.playBtnText}>{t("playAloud")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.playBtn, styles.shareBtn]} onPress={() => Share.share({ message: resultText }).catch(() => {})}>
                  <Text style={[styles.playBtnText, { color: COLORS.ink }]}>📤 Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <StopSpeaking />
        <ChatInput onSend={handleTranslateText} onMicPress={handleMicPress} isRecording={isRecording} placeholder={t("typeMessage")} sendLabel={t("send")} />
      </KeyboardAware>

      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{picker === "from" ? "Translate from" : "Translate to"}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((l) => {
              const on = (picker === "from" ? from.code : to.code) === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.option, on && styles.optionOn]}
                  onPress={() => {
                    picker === "from" ? setFrom(l) : setTo(l);
                    setPicker(null);
                  }}
                >
                  <Text style={[styles.optionText, on && { color: COLORS.goldDark, fontWeight: "800" }]}>{nameOf(l)}</Text>
                  {on && <Text style={{ color: COLORS.goldDark, fontWeight: "800" }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1 },
  langBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.parchment },
  langBtn: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border },
  langCaption: { fontSize: 10.5, color: COLORS.midGray, fontWeight: "700", textTransform: "uppercase" },
  langName: { fontSize: 14.5, color: COLORS.ink900, fontWeight: "700", marginTop: 1 },
  swapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  swapText: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  empty: { alignItems: "center", paddingVertical: 12 },
  emptyIcon: { fontSize: 30 },
  emptyText: { color: COLORS.darkGray, fontSize: 13.5, textAlign: "center", marginTop: 8, lineHeight: 19, paddingHorizontal: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 14 },
  chip: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.parchment },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontSize: 13, color: COLORS.darkGray },
  chipTextOn: { color: COLORS.white, fontWeight: "800" },
  sourceBox: { backgroundColor: COLORS.lightBg, borderRadius: 12, padding: 14, marginBottom: 12 },
  sourceLabel: { fontSize: 11, color: COLORS.midGray, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  sourceText: { fontSize: 14.5, color: COLORS.darkGray },
  resultBox: { backgroundColor: "#FFF7F0", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: COLORS.orange },
  resultLabel: { fontSize: 11, color: COLORS.goldDark, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  resultText: { fontSize: 17, color: COLORS.black, lineHeight: 25 },
  playBtn: { backgroundColor: COLORS.orange, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  shareBtn: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  playBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 12.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(22,13,25,0.45)" },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg, paddingBottom: SPACING.xl + 8 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: COLORS.ink900, marginBottom: SPACING.sm },
  option: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionOn: { backgroundColor: COLORS.goldSoft, borderRadius: 8 },
  optionText: { fontSize: 15, color: COLORS.ink900 },
});
