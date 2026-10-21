import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";

/**
 * Shows how Gemini and TinyFish hand the task to each other, live:
 *   Gemini understands → TinyFish finds the page → TinyFish browses → Gemini verifies
 * stages: { understand|find|browse|verify: { status: pending|active|done|skipped|error, detail } }
 */
export const PIPELINE = [
  { key: "understand", icon: "🧠", label: "Understand", engine: "Gemini", color: "#6B4FD8" },
  { key: "find", icon: "🔎", label: "Find page", engine: "TinyFish", color: COLORS.teal },
  { key: "browse", icon: "🌐", label: "Browse live", engine: "TinyFish", color: "#0E7AA8" },
  { key: "verify", icon: "✅", label: "Verify", engine: "Gemini", color: "#1E7B3C" },
];

function Node({ def, state }) {
  const status = state?.status || "pending";
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status !== "active") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const done = status === "done";
  const active = status === "active";
  const skipped = status === "skipped";
  const bg = done ? def.color : active ? COLORS.white : skipped ? "#EEE8F0" : "#F3EEF5";
  const border = done || active ? def.color : COLORS.border;
  return (
    <View style={styles.node}>
      <Animated.View style={[styles.circle, { backgroundColor: bg, borderColor: border, transform: [{ scale: pulse }] }]}>
        <Text style={[styles.icon, !done && !active && { opacity: 0.45 }]}>{done ? "✓" : status === "error" ? "!" : def.icon}</Text>
      </Animated.View>
      <Text style={[styles.label, (done || active) && { color: COLORS.ink900 }]} numberOfLines={1}>
        {def.label}
      </Text>
      <Text style={[styles.engine, { color: done || active ? def.color : COLORS.ink400 }]}>{def.engine}</Text>
      <Text style={styles.detail} numberOfLines={1}>
        {skipped ? "used official pages" : state?.detail || (active ? "working…" : " ")}
      </Text>
    </View>
  );
}

export default function PipelineStrip({ stages = {} }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>GEMINI × TINYFISH · WORKING TOGETHER</Text>
      <View style={styles.row}>
        {PIPELINE.map((def, i) => {
          const done = stages[def.key]?.status === "done" || stages[def.key]?.status === "skipped";
          return (
            <React.Fragment key={def.key}>
              <Node def={def} state={stages[def.key]} />
              {i < PIPELINE.length - 1 && <View style={[styles.link, done && { backgroundColor: def.color }]} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.9, color: COLORS.ink400, textAlign: "center", marginBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "flex-start" },
  node: { flex: 1, alignItems: "center" },
  circle: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 18, color: COLORS.white, fontWeight: "900" },
  label: { fontSize: 11.5, fontWeight: "800", color: COLORS.ink400, marginTop: 5 },
  engine: { fontSize: 10, fontWeight: "800", marginTop: 1 },
  detail: { fontSize: 9.5, color: COLORS.midGray, marginTop: 1, maxWidth: 78 },
  link: { height: 2, flex: 0.35, backgroundColor: COLORS.border, marginTop: 20, borderRadius: 1 },
});
