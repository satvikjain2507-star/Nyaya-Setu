import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { COLORS, RADIUS } from "../constants/theme";
import { onSpeakingChange, stopSpeaking, isSpeaking } from "../utils/speaker";
import { useLanguage } from "../context/LanguageContext";

/** Floating "Stop speaking" pill — visible only while a reply is being read aloud. */
export default function StopSpeaking() {
  const { t } = useLanguage();
  const [on, setOn] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setOn), []);
  if (!on) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={stopSpeaking} activeOpacity={0.85}>
        <View style={styles.square} />
        <Text style={styles.text}>{t("stopSpeaking")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 6, backgroundColor: "transparent" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: "#E5484D" },
  text: { color: COLORS.white, fontWeight: "800", fontSize: 13.5 },
});
