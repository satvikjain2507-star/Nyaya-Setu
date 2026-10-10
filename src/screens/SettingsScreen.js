import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../data/translations";
import { clearMessages } from "../utils/chatStorage";
import { hasTinyFishKey, testTinyFishConnection } from "../services/tinyfishApi";
import { hasGeminiKey } from "../services/geminiApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEYS = ["chat_history_scheme", "chat_history_legal", "chat_history_document"];

export default function SettingsScreen() {
  const { langCode, changeLanguage, t, speechRate, setSpeechRate } = useLanguage();

  const [tfTest, setTfTest] = useState(null);
  const runTest = async () => {
    setTfTest({ message: "Testing…" });
    setTfTest(await testTinyFishConnection());
  };

  const handleClearHistory = () => {
    Alert.alert(t("clearHistory"), "This will remove all saved conversations. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await Promise.all(HISTORY_KEYS.map((k) => clearMessages(k)));
          const keys = await AsyncStorage.getAllKeys();
          await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith("tf_cache_")));
          Alert.alert("Done", "Chat history cleared.");
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xl }}>
        <Text style={styles.sectionTitle}>{t("language")}</Text>
        <View style={styles.langGroup}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langOption, langCode === l.code && styles.langOptionActive]}
              onPress={() => changeLanguage(l.code)}
            >
              <Text style={[styles.langText, langCode === l.code && styles.langTextActive]}>{l.label}</Text>
              {langCode === l.code && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl + 4 }]}>Speech Speed</Text>
        <View style={styles.langGroup}>
          {[
            { label: "Slow", value: 0.75 },
            { label: "Normal", value: 1.0 },
            { label: "Fast", value: 1.25 },
            { label: "Very Fast", value: 1.5 },
          ].map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.langOption, speechRate === r.value && styles.langOptionActive]}
              onPress={() => setSpeechRate(r.value)}
            >
              <Text style={[styles.langText, speechRate === r.value && styles.langTextActive]}>{r.label}</Text>
              {speechRate === r.value && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl + 4 }]}>AI & Live Web</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            {hasGeminiKey() ? "✅" : "⚠️"} Gemini (understanding & languages): {hasGeminiKey() ? "connected" : "demo mode"}
          </Text>
          <Text style={styles.aboutText}>
            {hasTinyFishKey() ? "✅" : "⚠️"} TinyFish (live web agent): {hasTinyFishKey() ? "key found" : "demo mode — add EXPO_PUBLIC_TINYFISH_API_KEY"}
          </Text>
          <TouchableOpacity style={styles.testBtn} onPress={runTest}>
            <Text style={styles.testBtnText}>Test TinyFish connection</Text>
          </TouchableOpacity>
          {tfTest && <Text style={[styles.aboutText, { marginTop: 6 }]}>{tfTest.message}</Text>}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl + 4 }]}>Data</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearHistory}>
          <Text style={styles.dangerBtnText}>{t("clearHistory")}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl + 4 }]}>{t("aboutApp")}</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>{t("aboutText")}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: SPACING.md - 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  langGroup: { gap: SPACING.sm },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.parchment,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langOptionActive: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.gold, borderWidth: 1.5 },
  langText: { fontSize: 14.5, color: COLORS.darkGray },
  langTextActive: { color: COLORS.goldDark, fontWeight: "700" },
  checkMark: { color: COLORS.gold, fontWeight: "700", fontSize: 16 },
  dangerBtn: {
    backgroundColor: "#FDECEC",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  dangerBtnText: { color: "#C0392B", fontWeight: "700", fontSize: 13.5 },
  aboutCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg - 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  testBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingVertical: 9, alignItems: "center" },
  testBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  aboutText: { fontSize: 13, color: COLORS.darkGray, lineHeight: 20 },
});
