import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { COLORS } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { geminiTranslateText, geminiTranslateAudio } from "../services/geminiApi";
import ChatInput from "../components/ChatInput";

export default function TranslatorScreen() {
  const { t, speechRate } = useLanguage();
  const [direction, setDirection] = useState("en-hi"); // "en-hi" or "hi-en"
  const [sourceText, setSourceText] = useState("");
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(null);

  const targetSpeechLang = () => (direction === "en-hi" ? "hi-IN" : "en-IN");

  const handleTranslateText = async (text) => {
    setSourceText(text);
    setResultText("");
    setLoading(true);
    const translated = await geminiTranslateText(text, direction);
    setResultText(translated);
    setLoading(false);
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
      setLoading(true);
      setResultText("");
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const reply = await geminiTranslateAudio(base64, direction, "audio/m4a");
        // reply contains both "🗣️ You said:" and "➡️ Translation:" lines
        const translationLine = reply.split("➡️ Translation:")[1]?.trim() || reply;
        setSourceText(reply.split("➡️ Translation:")[0]?.replace("🗣️ You said:", "").trim() || "(voice message)");
        setResultText(translationLine);

      Speech.stop();
      Speech.speak(translationLine, { language: targetSpeechLang() , rate: speechRate });
      } catch (err) {
        console.error("Failed to process recording:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePlayAloud = () => {
    if (!resultText) return;
    Speech.speak(resultText, { language: targetSpeechLang() , rate: speechRate });
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.directionBar}>
        <Text style={styles.directionText}>{direction === "en-hi" ? "English → हिंदी" : "हिंदी → English"}</Text>
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => setDirection((d) => (d === "en-hi" ? "hi-en" : "en-hi"))}
        >
          <Text style={styles.switchBtnText}>🔄 {t("switchDirection")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        {sourceText ? (
          <View style={styles.sourceBox}>
            <Text style={styles.sourceLabel}>Original</Text>
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
            <Text style={styles.resultLabel}>Translation</Text>
            <Text style={styles.resultText}>{resultText}</Text>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlayAloud}>
              <Text style={styles.playBtnText}>{t("playAloud")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <ChatInput
        onSend={handleTranslateText}
        onMicPress={handleMicPress}
        isRecording={isRecording}
        placeholder={t("typeMessage")}
        sendLabel={t("send")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1 },
  directionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  directionText: { fontSize: 15, fontWeight: "bold", color: COLORS.black },
  switchBtn: { backgroundColor: COLORS.lightBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  switchBtnText: { fontSize: 12.5, color: COLORS.orange, fontWeight: "600" },
  sourceBox: { backgroundColor: COLORS.lightBg, borderRadius: 12, padding: 14, marginBottom: 12 },
  sourceLabel: { fontSize: 11, color: COLORS.midGray, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  sourceText: { fontSize: 14.5, color: COLORS.darkGray },
  resultBox: {
    backgroundColor: "#FFF7F0",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
  },
  resultLabel: { fontSize: 11, color: COLORS.orange, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  resultText: { fontSize: 16, color: COLORS.black, lineHeight: 22 },
  playBtn: { marginTop: 12, alignSelf: "flex-start", backgroundColor: COLORS.orange, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  playBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 12.5 },
});
