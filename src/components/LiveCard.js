import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Easing, Share } from "react-native";
import { COLORS, RADIUS, SPACING, FONT, themed } from "../constants/theme";
import { Feather } from "@expo/vector-icons";

export const LIVE_COLORS = themed(() => ({
  confirmed: { bg: COLORS.tealSoft, fg: COLORS.teal, icon: "✅", f: "check-circle" },
  likely_genuine: { bg: COLORS.tealSoft, fg: COLORS.teal, icon: "✅", f: "check-circle" },
  updated: { bg: COLORS.amberSoft, fg: COLORS.amber, icon: "🔄", f: "refresh-cw" },
  suspicious: { bg: COLORS.amberSoft, fg: COLORS.amber, icon: "⚠️", f: "alert-triangle" },
  unclear: { bg: COLORS.surface, fg: COLORS.ink600, icon: "❔", f: "help-circle" },
  likely_scam: { bg: COLORS.roseSoft, fg: COLORS.rose, icon: "🚨", f: "alert-octagon" },
}));

const VERDICT_LABEL = {
  confirmed: "Verified on official sites",
  updated: "Updated with latest official info",
  unclear: "Partially verified",
  likely_genuine: "Looks genuine",
  suspicious: "Suspicious, be careful",
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
        <Text style={styles.liveLabel}>CHECKING</Text>
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
    <View style={styles.card}>
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Feather name={c.f} size={14} color={c.fg} />
        <Text style={[styles.badgeText, { color: c.fg }]}>{VERDICT_LABEL[data.verdict] || "Checked live"}</Text>
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
          <Text style={styles.officialBtnText}>Open official website</Text>
          <Feather name="arrow-up-right" size={17} color="#fff" />
        </TouchableOpacity>
      )}

      {data.kind === "scam" && data.verdict !== "likely_genuine" && (
        <View style={styles.actRow}>
          <TouchableOpacity style={[styles.act, styles.actDanger]} onPress={() => Linking.openURL("tel:1930").catch(() => {})}>
            <Feather name="phone" size={14} color="#fff" />
            <Text style={[styles.actText, { color: "#fff" }]}>Call 1930</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.act} onPress={() => openLink("https://cybercrime.gov.in")}>
            <Feather name="globe" size={14} color={COLORS.ink} />
            <Text style={styles.actText}>Report online</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.actRow}>
        <TouchableOpacity
          style={styles.act}
          onPress={() =>
            Share.share({
              message:
                data.kind === "scam"
                  ? `⚠️ ${VERDICT_LABEL[data.verdict] || "Checked"}: ${data.headline}\n${(data.reasons || []).slice(0, 3).map((r) => "• " + r).join("\n")}\nNever share OTP/PIN. Cyber fraud helpline: 1930\n— checked with Nyaya Setu`
                  : `✅ ${data.headline}\n${data.summary || ""}${data.officialLink ? `\nOfficial link: ${data.officialLink}` : ""}\n— verified live with Nyaya Setu`,
            }).catch(() => {})
          }
        >
          <Feather name="share-2" size={14} color={COLORS.ink} />
          <Text style={styles.actText}>{data.kind === "scam" ? "Warn family" : "Share"}</Text>
        </TouchableOpacity>
      </View>

      <SourceChips sources={data.sources} />

      <Text style={styles.footer}>
        {data.offline ? "Instant safety scan" : "Checked just now"}{time ? ` · ${time}` : ""}
        {data.demo ? " · DEMO MODE" : ""}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 6, backgroundColor: COLORS.bg, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveLabel: { fontFamily: FONT.extrabold, fontSize: 11, color: COLORS.ink400, letterSpacing: 1 },
  working: { fontFamily: FONT.regular, marginTop: 6, fontSize: 14.5, color: COLORS.ink },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 6 },
  badgeText: { fontFamily: FONT.bold, fontSize: 13, },
  headline: { fontFamily: FONT.extrabold, fontSize: 18, lineHeight: 25, color: COLORS.ink, marginTop: 12 },
  body: { fontFamily: FONT.regular, fontSize: 15, color: COLORS.ink600, lineHeight: 22, marginTop: 6 },
  fact: { fontFamily: FONT.regular, fontSize: 14.5, color: COLORS.ink600, lineHeight: 22 },
  todo: { marginTop: 14, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14 },
  todoTitle: { fontFamily: FONT.extrabold, color: COLORS.ink, fontSize: 14.5, marginBottom: 4 },
  officialBtn: { marginTop: 16, backgroundColor: COLORS.brand, borderRadius: RADIUS.pill, height: 50, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  officialBtnText: { fontFamily: FONT.bold, color: COLORS.onAccent, fontSize: 15 },
  actRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  act: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10 },
  actDanger: { backgroundColor: COLORS.rose },
  actText: { fontFamily: FONT.bold, fontSize: 13.5, color: COLORS.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  chip: { backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 200 },
  chipOfficial: { backgroundColor: COLORS.tealSoft },
  chipText: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.ink600 },
  chipTextOfficial: { fontFamily: FONT.bold, color: COLORS.teal, },
  footer: { fontFamily: FONT.regular, marginTop: 12, fontSize: 12, color: COLORS.ink400 },
}));
