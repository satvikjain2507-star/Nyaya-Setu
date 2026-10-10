import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Easing } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";

export const LIVE_COLORS = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7B3C", icon: "✅" },
  likely_genuine: { bg: "#E6F4EA", fg: "#1E7B3C", icon: "✅" },
  updated: { bg: "#FFF4DC", fg: "#A86A00", icon: "🔄" },
  suspicious: { bg: "#FFF4DC", fg: "#A86A00", icon: "⚠️" },
  unclear: { bg: "#EEF0F4", fg: "#4A5568", icon: "❔" },
  likely_scam: { bg: "#FDECEC", fg: "#B42318", icon: "🚨" },
};

const VERDICT_LABEL = {
  confirmed: "Verified on official sites",
  updated: "Updated with latest official info",
  unclear: "Partially verified",
  likely_genuine: "Looks genuine",
  suspicious: "Suspicious — be careful",
  likely_scam: "Likely a SCAM",
};

export function openLink(url) {
  if (!url) return;
  Linking.openURL(url.startsWith("http") ? url : `https://${url}`).catch(() => {});
}

/** Pulsing dot used for "LIVE" indicators. */
export function LiveDot({ color = "#E5484D", size = 8 }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.25, duration: 650, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: a }} />;
}

/** Rotating status lines shown while TinyFish is working. */
export function LiveWorking({ lines, accent = COLORS.teal }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1800);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.liveRow}>
        <LiveDot />
        <Text style={styles.liveLabel}>LIVE · TinyFish</Text>
      </View>
      <Text style={styles.working}>{lines[i]}</Text>
    </View>
  );
}

export function SourceChips({ sources }) {
  if (!sources?.length) return null;
  return (
    <View style={styles.chips}>
      {sources.map((s, idx) => (
        <TouchableOpacity key={idx} style={[styles.chip, s.official && styles.chipOfficial]} onPress={() => openLink(s.url)}>
          <Text style={[styles.chipText, s.official && styles.chipTextOfficial]} numberOfLines={1}>
            {s.official ? "🏛️ " : "🔗 "}
            {s.site}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Result card for Verify Live (kind="verify") and Scam Shield (kind="scam"). */
export default function LiveCard({ data }) {
  if (!data) return null;
  const c = LIVE_COLORS[data.verdict] || LIVE_COLORS.unclear;
  const list = data.kind === "scam" ? data.reasons : data.keyFacts;
  const time = data.checkedAt ? new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <View style={[styles.card, { borderLeftColor: c.fg }]}>
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.fg }]}>
          {c.icon} {VERDICT_LABEL[data.verdict] || "Checked live"}
        </Text>
      </View>

      {!!data.headline && <Text style={styles.headline}>{data.headline}</Text>}
      {!!data.summary && <Text style={styles.body}>{data.summary}</Text>}

      {list?.length > 0 && (
        <View style={{ marginTop: SPACING.sm }}>
          {list.map((f, i) => (
            <Text key={i} style={styles.fact}>
              • {f}
            </Text>
          ))}
        </View>
      )}

      {data.kind === "scam" && data.whatToDo?.length > 0 && (
        <View style={styles.todo}>
          <Text style={styles.todoTitle}>What to do</Text>
          {data.whatToDo.map((f, i) => (
            <Text key={i} style={styles.fact}>
              {i + 1}. {f}
            </Text>
          ))}
        </View>
      )}

      {!!data.officialLink && (
        <TouchableOpacity style={styles.officialBtn} onPress={() => openLink(data.officialLink)}>
          <Text style={styles.officialBtnText}>Open official website ↗</Text>
        </TouchableOpacity>
      )}

      <SourceChips sources={data.sources} />

      <Text style={styles.footer}>
        Checked live via TinyFish{time ? ` · ${time}` : ""}
        {data.demo ? " · DEMO MODE" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs + 2,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: SPACING.md + 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveLabel: { fontSize: 11, fontWeight: "800", color: "#E5484D", letterSpacing: 0.8 },
  working: { marginTop: 6, fontSize: 14, color: COLORS.darkGray },
  badge: { alignSelf: "flex-start", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  headline: { fontSize: 15.5, fontWeight: "700", color: COLORS.ink900, marginTop: SPACING.sm },
  body: { fontSize: 14, color: COLORS.darkGray, lineHeight: 20, marginTop: 4 },
  fact: { fontSize: 13.5, color: COLORS.darkGray, lineHeight: 20 },
  todo: { marginTop: SPACING.sm, backgroundColor: COLORS.parchment, borderRadius: RADIUS.sm, padding: SPACING.sm + 2 },
  todoTitle: { fontWeight: "800", color: COLORS.ink, fontSize: 12.5, marginBottom: 2 },
  officialBtn: { marginTop: SPACING.md, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingVertical: 10, alignItems: "center" },
  officialBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.sm + 2 },
  chip: { backgroundColor: COLORS.parchment, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border, maxWidth: 200 },
  chipOfficial: { backgroundColor: COLORS.tealSoft, borderColor: COLORS.teal },
  chipText: { fontSize: 11.5, color: COLORS.darkGray },
  chipTextOfficial: { color: COLORS.teal, fontWeight: "700" },
  footer: { marginTop: SPACING.sm + 2, fontSize: 10.5, color: COLORS.midGray },
});
