import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../data/translations";
import { LiveDot, openLink } from "../components/LiveCard";
import { getLiveUpdates } from "../services/liveIntel";

const TOOL_ACCENTS = [
  { bg: COLORS.goldSoft, fg: COLORS.goldDark },
  { bg: COLORS.tealSoft, fg: COLORS.teal },
  { bg: COLORS.roseSoft, fg: COLORS.rose },
  { bg: "#ECE8FB", fg: "#6B4FD8" },
  { bg: "#E4F1F8", fg: "#0E7AA8" },
];

const HELPLINES = [
  { num: "112", label: "Emergency", icon: "🚨" },
  { num: "1930", label: "Cyber fraud", icon: "🛡️" },
  { num: "15100", label: "Legal aid", icon: "⚖️" },
  { num: "181", label: "Women", icon: "👩" },
];

export default function HomeScreen({ navigation }) {
  const { t, geminiLanguageName, langCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const [updates, setUpdates] = useState(null);
  const [updatesError, setUpdatesError] = useState(false);
  const langLabel = (LANGUAGES.find((l) => l.code === langCode)?.label || "English").split(" (")[0];

  const loadUpdates = async (force = false) => {
    setUpdatesError(false);
    if (force) setUpdates(null);
    try {
      setUpdates(await getLiveUpdates({ language: geminiLanguageName(), force }));
    } catch (e) {
      setUpdatesError(true);
      setUpdates([]);
    }
  };

  useEffect(() => {
    loadUpdates();
  }, [geminiLanguageName()]);

  const goLive = () => navigation.getParent()?.navigate("LiveTab");

  const TOOLS = [
    { key: "SchemeNavigator", title: t("schemeNavigator"), subtitle: t("schemeNavigatorDesc"), icon: "📋" },
    { key: "LegalCompanion", title: t("legalCompanion"), subtitle: t("legalCompanionDesc"), icon: "⚖️" },
    { key: "DocumentSimplifier", title: t("documentSimplifier"), subtitle: t("documentSimplifierDesc"), icon: "📄" },
    { key: "Translator", title: t("translator"), subtitle: t("translatorDesc"), icon: "🌐" },
    { key: "VisualSolver", title: t("visualSolver"), subtitle: t("visualSolverDesc"), icon: "🔍" },
  ];

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { paddingTop: insets.top, backgroundColor: COLORS.ink }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: COLORS.parchment }}>
        {/* ── Header ── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>न्याय सेतु · Nyaya Setu</Text>
            </View>
            <TouchableOpacity style={styles.langChip} onPress={() => navigation.getParent()?.navigate("SettingsTab")} activeOpacity={0.8}>
              <Text style={styles.langChipText}>🌐 {langLabel} ▾</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{t("tagline")}</Text>

          <TouchableOpacity style={styles.speakBtn} onPress={goLive} activeOpacity={0.9}>
            <View style={styles.speakMic}>
              <Text style={{ fontSize: 20 }}>🎤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.speakTitle}>{t("speakNow")}</Text>
              <Text style={styles.speakSub}>{t("speakNowSub")}</Text>
            </View>
            <Text style={styles.speakArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            {["13 languages", "Verified on .gov.in", "Free · no login"].map((x) => (
              <View key={x} style={styles.trustPill}>
                <Text style={styles.trustText}>✓ {x}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Core feature 1: Sahayak Live ── */}
          <TouchableOpacity style={styles.liveCard} onPress={goLive} activeOpacity={0.92}>
            <View style={styles.liveTop}>
              <View style={styles.livePill}>
                <LiveDot />
                <Text style={styles.livePillText}>LIVE AGENT</Text>
              </View>
              <Text style={styles.livePowered}>TinyFish × Gemini</Text>
            </View>
            <Text style={styles.liveTitle}>🛰️ {t("sahayakLive")}</Text>
            <Text style={styles.liveSub}>{t("sahayakLiveDesc")}</Text>
            <View style={styles.flowRow}>
              {[
                ["🧠", "Gemini plans"],
                ["🌐", "TinyFish browses"],
                ["✅", "Verified answer"],
              ].map(([i, l], idx) => (
                <React.Fragment key={l}>
                  <View style={styles.flowStep}>
                    <Text style={styles.flowIcon}>{i}</Text>
                    <Text style={styles.flowText}>{l}</Text>
                  </View>
                  {idx < 2 && <Text style={styles.flowArrow}>›</Text>}
                </React.Fragment>
              ))}
            </View>
            <View style={styles.liveCta}>
              <Text style={styles.liveCtaText}>{t("tryNow")} →</Text>
            </View>
          </TouchableOpacity>

          {/* ── Core features 2 & 3: Scam Shield + Nearby Help Centres ── */}
          <View style={styles.tileRow}>
            <TouchableOpacity style={[styles.tile, styles.tileScam]} onPress={() => navigation.navigate("ScamShield")} activeOpacity={0.9}>
              <View style={styles.tileHead}>
                <View style={[styles.tileIcon, { backgroundColor: COLORS.roseSoft }]}>
                  <Text style={styles.tileEmoji}>🛡️</Text>
                </View>
                <View style={[styles.tilePill, { backgroundColor: COLORS.rose }]}>
                  <Text style={styles.tilePillText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.tileTitle}>{t("scamShield")}</Text>
              <Text style={styles.tileSub} numberOfLines={3}>
                {t("scamShieldDesc")}
              </Text>
              <Text style={[styles.tileCta, { color: COLORS.rose }]}>{t("checkNow")} →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tile, styles.tileHelp]} onPress={() => navigation.navigate("HelpCenters")} activeOpacity={0.9}>
              <View style={styles.tileHead}>
                <View style={[styles.tileIcon, { backgroundColor: "#CFE8E6" }]}>
                  <Text style={styles.tileEmoji}>📍</Text>
                </View>
                <View style={[styles.tilePill, { backgroundColor: COLORS.teal }]}>
                  <Text style={styles.tilePillText}>NEAR YOU</Text>
                </View>
              </View>
              <Text style={styles.tileTitle}>{t("helpCenters")}</Text>
              <Text style={styles.tileSub} numberOfLines={3}>
                {t("helpCentersHomeDesc")}
              </Text>
              <Text style={[styles.tileCta, { color: COLORS.teal }]}>{t("findNearMe")} →</Text>
            </TouchableOpacity>
          </View>

          {/* ── One-tap helplines ── */}
          <View style={styles.sosCard}>
            <Text style={styles.sosTitle}>📞 {t("helplinesOneTap")}</Text>
            <View style={styles.sosRow}>
              {HELPLINES.map((h) => (
                <TouchableOpacity key={h.num} style={styles.sosBtn} onPress={() => Linking.openURL(`tel:${h.num}`)} activeOpacity={0.8}>
                  <Text style={styles.sosNum}>{h.num}</Text>
                  <Text style={styles.sosLbl} numberOfLines={1}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── More tools ── */}
          <Text style={styles.section}>{t("moreTools")}</Text>
          <View style={styles.grid}>
            {TOOLS.map((p, i) => {
              const a = TOOL_ACCENTS[i % TOOL_ACCENTS.length];
              const wide = i === TOOLS.length - 1 && TOOLS.length % 2 === 1;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.tool, wide && styles.toolWide]}
                  onPress={() => navigation.navigate(p.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.toolIcon, { backgroundColor: a.bg }]}>
                    <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                  </View>
                  <View style={wide ? { flex: 1 } : null}>
                    <Text style={styles.toolTitle} numberOfLines={2}>
                      {p.title}
                    </Text>
                    <Text style={styles.toolSub} numberOfLines={2}>
                      {p.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Live updates (TinyFish Search, last 7 days) ── */}
          <View style={styles.feed}>
            <View style={styles.feedHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <LiveDot />
                <Text style={styles.feedTitle}>{t("liveUpdates")}</Text>
              </View>
              <TouchableOpacity onPress={() => loadUpdates(true)} hitSlop={12}>
                <Text style={styles.refresh}>↻</Text>
              </TouchableOpacity>
            </View>
            {updates === null && (
              <View>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton} />
                ))}
              </View>
            )}
            {updates?.length === 0 && (
              <Text style={styles.feedEmpty}>{updatesError ? "Couldn't load live updates — tap ↻ to retry." : "No new updates this week."}</Text>
            )}
            {updates?.map((u, i) => (
              <TouchableOpacity key={i} style={styles.feedItem} onPress={() => openLink(u.url)}>
                <Text style={styles.feedTag}>{u.fraud ? "🚨 FRAUD ALERT" : u.official ? "🏛️ OFFICIAL" : "📰 NEWS"}</Text>
                <Text style={styles.feedItemTitle} numberOfLines={2}>
                  {u.title}
                </Text>
                <Text style={styles.feedMeta}>
                  {u.site}
                  {u.date ? ` · ${u.date}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.feedFoot}>Fetched live from the web via TinyFish Search</Text>
          </View>

          <Text style={styles.footer}>Team Hackpeeps · Made in India 🇮🇳</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = {
  shadowColor: COLORS.inkDeep,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.parchment },
  hero: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl + 18,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
  badge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  badgeText: { color: COLORS.inkDeep, fontWeight: "800", fontSize: 12 },
  langChip: { borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  langChipText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  heroTitle: { color: COLORS.white, fontSize: 22, fontWeight: "800", lineHeight: 30 },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.inkSoft,
    borderRadius: RADIUS.pill,
    padding: 6,
    paddingRight: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(227,164,56,0.5)",
  },
  speakMic: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  speakTitle: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  speakSub: { color: "#CDBFD6", fontSize: 11.5, marginTop: 1 },
  speakArrow: { color: COLORS.gold, fontSize: 20, fontWeight: "800" },
  trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.md },
  trustPill: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  trustText: { color: "#E7DCEB", fontSize: 10.5, fontWeight: "700" },

  body: { paddingHorizontal: SPACING.lg, marginTop: -SPACING.xl, gap: SPACING.md },

  liveCard: { backgroundColor: COLORS.inkSoft, borderRadius: RADIUS.md + 2, padding: SPACING.lg, borderWidth: 1.5, borderColor: COLORS.gold, ...shadow, shadowOpacity: 0.25, elevation: 6 },
  liveTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  livePillText: { color: COLORS.white, fontWeight: "900", fontSize: 10.5, letterSpacing: 1 },
  livePowered: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  liveTitle: { color: COLORS.white, fontSize: 21, fontWeight: "800", marginTop: SPACING.md },
  liveSub: { color: "#D9CFE0", fontSize: 13, lineHeight: 19, marginTop: 4 },
  flowRow: { flexDirection: "row", alignItems: "center", marginTop: SPACING.md, backgroundColor: COLORS.ink, borderRadius: RADIUS.sm, paddingVertical: 8, paddingHorizontal: 6 },
  flowStep: { flex: 1, alignItems: "center" },
  flowIcon: { fontSize: 16 },
  flowText: { color: "#E7DCEB", fontSize: 10.5, fontWeight: "700", marginTop: 2, textAlign: "center" },
  flowArrow: { color: COLORS.gold, fontSize: 18, fontWeight: "900" },
  liveCta: { alignSelf: "flex-start", backgroundColor: COLORS.gold, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, paddingVertical: 8, marginTop: SPACING.md },
  liveCtaText: { color: COLORS.inkDeep, fontWeight: "800", fontSize: 13.5 },

  tileRow: { flexDirection: "row", gap: SPACING.md },
  tile: { flex: 1, borderRadius: RADIUS.md, padding: SPACING.md + 2, borderWidth: 1.5, ...shadow },
  tileScam: { backgroundColor: "#FFF5F6", borderColor: COLORS.rose },
  tileHelp: { backgroundColor: "#F0F8F7", borderColor: COLORS.teal },
  tileHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tileEmoji: { fontSize: 22 },
  tilePill: { borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  tilePillText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  tileTitle: { fontSize: 15.5, fontWeight: "800", color: COLORS.ink900, marginTop: SPACING.sm },
  tileSub: { fontSize: 12, color: COLORS.ink600, marginTop: 3, lineHeight: 16.5, minHeight: 50 },
  tileCta: { fontSize: 12.5, fontWeight: "800", marginTop: SPACING.sm },

  sosCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...shadow },
  sosTitle: { fontSize: 12, fontWeight: "900", color: COLORS.ink, letterSpacing: 0.4, marginBottom: SPACING.sm },
  sosRow: { flexDirection: "row", gap: 6 },
  sosBtn: { flex: 1, backgroundColor: COLORS.roseSoft, borderRadius: RADIUS.sm, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#EBC6CD" },
  sosNum: { color: COLORS.rose, fontWeight: "900", fontSize: 15 },
  sosLbl: { color: COLORS.ink600, fontSize: 10, marginTop: 1 },

  section: { fontSize: 12.5, fontWeight: "900", color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.8, marginTop: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: SPACING.md },
  tool: { width: "48%", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md + 2, ...shadow },
  toolWide: { width: "100%", flexDirection: "row", alignItems: "center", gap: SPACING.md },
  toolIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm },
  toolTitle: { fontSize: 14.5, fontWeight: "800", color: COLORS.ink900 },
  toolSub: { fontSize: 11.5, color: COLORS.ink400, marginTop: 2, lineHeight: 15.5 },

  feed: { marginTop: SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md + 2, ...shadow },
  feedHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  feedTitle: { fontWeight: "900", fontSize: 12.5, color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.6 },
  refresh: { fontSize: 20, color: COLORS.gold, fontWeight: "800" },
  skeleton: { height: 44, borderRadius: RADIUS.sm, backgroundColor: "#F3EEE4", marginBottom: 8 },
  feedEmpty: { color: COLORS.midGray, fontSize: 12.5, paddingVertical: SPACING.sm },
  feedItem: { paddingVertical: SPACING.sm + 2, borderTopWidth: 1, borderTopColor: COLORS.border },
  feedTag: { fontSize: 9.5, fontWeight: "900", color: COLORS.ink400, letterSpacing: 0.6, marginBottom: 2 },
  feedItemTitle: { fontSize: 13.5, color: COLORS.ink900, fontWeight: "600", lineHeight: 19 },
  feedMeta: { fontSize: 11, color: COLORS.midGray, marginTop: 2 },
  feedFoot: { fontSize: 10.5, color: COLORS.midGray, marginTop: SPACING.sm },
  footer: { textAlign: "center", color: COLORS.ink400, fontSize: 11, marginTop: SPACING.md, marginBottom: SPACING.xl },
});
