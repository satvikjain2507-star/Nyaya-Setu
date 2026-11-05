import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { COLORS, FONT, themed } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";

/** Order-tracker style progress: Understand → Find page → Browse → Verify. */
const STEPS = [
  { key: "understand", label: "stepUnderstand" },
  { key: "find", label: "stepFind" },
  { key: "browse", label: "stepBrowse" },
  { key: "verify", label: "stepVerify" },
];

export default function PipelineStrip({ stages = {} }) {
  const { t } = useLanguage();
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const activeIdx = STEPS.findIndex((s) => stages[s.key]?.status === "active");
  const doneCount = STEPS.filter((s) => ["done", "skipped"].includes(stages[s.key]?.status)).length;
  const current = activeIdx >= 0 ? STEPS[activeIdx] : STEPS[Math.min(doneCount, 3)];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t(current.label)}…</Text>
      <View style={styles.bars}>
        {STEPS.map((s, i) => {
          const st = stages[s.key]?.status;
          const done = st === "done" || st === "skipped";
          const active = st === "active" || (!st && i === doneCount && activeIdx < 0);
          return (
            <View key={s.key} style={styles.track}>
              {done && <View style={[styles.fill, { backgroundColor: COLORS.ink }]} />}
              {active && <Animated.View style={[styles.fill, { backgroundColor: COLORS.gold, opacity: pulse }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { marginTop: 18 },
  label: { fontFamily: FONT.semibold, fontSize: 14, color: COLORS.ink },
  bars: { flexDirection: "row", gap: 6, marginTop: 10 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceAlt, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 2 },
}));
