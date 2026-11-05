import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, FONT, RADIUS, themed } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { LANGUAGES } from "../data/translations";
import { clearMessages } from "../utils/chatStorage";

const HISTORY_KEYS = ["chat_history_scheme", "chat_history_legal", "chat_history_document", "chat_history_scam_shield"];
const SPEEDS = [
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1.0 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
];

export default function SettingsScreen() {
  const { langCode, changeLanguage, t, speechRate, setSpeechRate } = useLanguage();
  const { mode, setMode } = useTheme();

  const handleClearHistory = () => {
    Alert.alert(t("clearHistory"), "This removes all saved conversations.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await Promise.all(HISTORY_KEYS.map((k) => clearMessages(k)));
          const keys = await AsyncStorage.getAllKeys();
          await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith("tf_cache_")));
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 }}>
        <Text style={styles.section}>{t("settingsTheme")}</Text>
        <View style={styles.segment}>
          {[
            { key: "system", icon: "smartphone", label: "themeSystem" },
            { key: "light", icon: "sun", label: "themeLight" },
            { key: "dark", icon: "moon", label: "themeDark" },
          ].map((m) => {
            const on = mode === m.key;
            return (
              <Pressable key={m.key} style={[styles.seg, styles.segRow, on && styles.segOn]} onPress={() => setMode(m.key)}>
                <Feather name={m.icon} size={15} color={on ? COLORS.white : COLORS.ink} />
                <Text style={[styles.segText, on && { color: COLORS.white }]}>{t(m.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>{t("settingsLanguage")}</Text>
        <View style={styles.group}>
          {LANGUAGES.map((l, i) => {
            const on = langCode === l.code;
            const [native, english] = l.label.includes("(") ? [l.label.split(" (")[0], l.label.split(" (")[1].replace(")", "")] : [l.label, ""];
            return (
              <Pressable key={l.code} style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: COLORS.surface }]} onPress={() => changeLanguage(l.code)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, on && { fontFamily: FONT.bold }]}>{native}</Text>
                  {!!english && <Text style={styles.rowSub}>{english}</Text>}
                </View>
                {on && (
                  <View style={styles.check}>
                    <Feather name="check" size={14} color={COLORS.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>{t("settingsSpeed")}</Text>
        <View style={styles.segment}>
          {SPEEDS.map((r) => {
            const on = speechRate === r.value;
            return (
              <Pressable key={r.value} style={[styles.seg, on && styles.segOn]} onPress={() => setSpeechRate(r.value)}>
                <Text style={[styles.segText, on && { color: COLORS.white }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>{t("settingsData")}</Text>
        <Pressable style={({ pressed }) => [styles.group, styles.row, pressed && { backgroundColor: COLORS.surface }]} onPress={handleClearHistory}>
          <Feather name="trash-2" size={18} color={COLORS.rose} />
          <Text style={[styles.rowText, { color: COLORS.rose, flex: 1 }]}>{t("clearHistory")}</Text>
        </Pressable>

        <Text style={styles.section}>{t("settingsAbout")}</Text>
        <View style={[styles.group, { padding: 16 }]}>
          <Text style={styles.aboutTitle}>
            Nyaya Setu<Text style={{ color: COLORS.gold }}>.</Text>
          </Text>
          <Text style={styles.aboutText}>न्याय सेतु · Bridge to Justice. Free for every citizen. General guidance only, not legal advice.</Text>
          <Text style={styles.version}>Version 1.3.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  section: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3, marginTop: 26, marginBottom: 10 },
  group: { borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowText: { fontFamily: FONT.semibold, fontSize: 15.5, color: COLORS.ink },
  rowSub: { fontFamily: FONT.medium, fontSize: 12.5, color: COLORS.ink400, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, padding: 4 },
  seg: { flex: 1, height: 40, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: COLORS.ink },
  segRow: { flexDirection: "row", gap: 7 },
  segText: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.ink },
  aboutTitle: { fontFamily: FONT.extrabold, fontSize: 18, color: COLORS.ink },
  aboutText: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20, color: COLORS.ink600, marginTop: 6 },
  version: { fontFamily: FONT.medium, fontSize: 12.5, color: COLORS.ink400, marginTop: 10 },
}));
