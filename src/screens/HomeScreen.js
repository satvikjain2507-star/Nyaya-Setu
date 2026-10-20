import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { LiveDot, openLink } from "../components/LiveCard";
import { getLiveUpdates } from "../services/liveIntel";

const ACCENTS = [
  { bg: COLORS.goldSoft, fg: COLORS.goldDark },
  { bg: COLORS.tealSoft, fg: COLORS.teal },
  { bg: COLORS.roseSoft, fg: COLORS.rose },
];

export default function HomeScreen({ navigation }) {
  const { t, geminiLanguageName } = useLanguage();
  const insets = useSafeAreaInsets();
  const [updates, setUpdates] = useState(null);
  const [updatesError, setUpdatesError] = useState(false);

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

  const PILLARS = [
    { key: "SchemeNavigator", title: t("schemeNavigator"), subtitle: t("schemeNavigatorDesc"), icon: "📋" },
    { key: "LegalCompanion", title: t("legalCompanion"), subtitle: t("legalCompanionDesc"), icon: "⚖️" },
    { key: "DocumentSimplifier", title: t("documentSimplifier"), subtitle: t("documentSimplifierDesc"), icon: "📄" },
    { key: "Translator", title: t("translator"), subtitle: t("translatorDesc"), icon: "🌐" },
    { key: "VisualSolver", title: t("visualSolver"), subtitle: t("visualSolverDesc"), icon: "🔍" },
    { key: "HelpCenters", title: t("helpCenters"), subtitle: t("helpCentersDesc"), icon: "📍" },
  ];

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { paddingTop: insets.top, backgroundColor: COLORS.ink }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: COLORS.parchment }}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("appName")}</Text>
          </View>
          <Text style={styles.heroTitle}>{t("tagline")}</Text>
          <View style={styles.heroRule} />
        </View>

        <View style={styles.cards}>
          {/* TinyFish hero feature */}
          <TouchableOpacity style={styles.liveCard} onPress={() => navigation.getParent()?.navigate("LiveTab")} activeOpacity={0.9}>
            <View style={styles.liveTop}>
              <View style={styles.livePill}>
                <LiveDot />
                <Text style={styles.livePillText}>LIVE AGENT</Text>
              </View>
              <Text style={styles.livePowered}>TinyFish × Gemini</Text>
            </View>
            <Text style={styles.liveTitle}>🛰️ {t("sahayakLive")}</Text>
            <Text style={styles.liveSub}>{t("sahayakLiveDesc")}</Text>
            <View style={styles.liveCta}>
              <Text style={styles.liveCtaText}>{t("tryNow")} →</Text>
            </View>
          </TouchableOpacity>

          {/* Scam Shield */}
          <TouchableOpacity style={styles.scamCard} onPress={() => navigation.navigate("ScamShield")} activeOpacity={0.9}>
            <View style={styles.scamIcon}>
              <Text style={{ fontSize: 24 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.scamTitle}>{t("scamShield")}</Text>
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.scamSub}>{t("scamShieldDesc")}</Text>
            </View>
            <Text style={[styles.chevron, { color: COLORS.rose }]}>›</Text>
          </TouchableOpacity>

          {PILLARS.map((p, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <TouchableOpacity
                key={p.key}
                style={styles.card}
                onPress={() => navigation.navigate(p.key)}
                activeOpacity={0.85}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: a.bg }]}>
                  <Text style={styles.cardIcon}>{p.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardSubtitle}>{p.subtitle}</Text>
                </View>
                <Text style={[styles.chevron, { color: a.fg }]}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Live updates feed (TinyFish Search, news from the last 7 days) */}
        <View style={styles.feed}>
          <View style={styles.feedHead}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LiveDot />
              <Text style={styles.feedTitle}>{t("liveUpdates")}</Text>
            </View>
            <TouchableOpacity onPress={() => loadUpdates(true)}>
              <Text style={styles.refresh}>↻</Text>
            </TouchableOpacity>
          </View>
          {updates === null && <ActivityIndicator color={COLORS.gold} style={{ marginVertical: SPACING.md }} />}
          {updates?.length === 0 && (
            <Text style={styles.feedEmpty}>{updatesError ? "Couldn't load live updates." : "No updates right now."}</Text>
          )}
          {updates?.map((u, i) => (
            <TouchableOpacity key={i} style={styles.feedItem} onPress={() => openLink(u.url)}>
              <Text style={styles.feedItemTitle} numberOfLines={2}>
                {u.fraud ? "🚨 " : u.official ? "🏛️ " : "📰 "}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.parchment },
  hero: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl + 4,
    paddingBottom: SPACING.xl + 16,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  badgeText: { color: COLORS.inkDeep, fontWeight: "800", fontSize: 12 },
  heroTitle: { color: COLORS.white, fontSize: 23, fontWeight: "700", lineHeight: 31 },
  heroRule: { width: 40, height: 3, backgroundColor: COLORS.gold, borderRadius: 2, marginTop: SPACING.lg },
  cards: { paddingHorizontal: SPACING.lg, marginTop: -SPACING.lg, gap: SPACING.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg - 2,
    gap: SPACING.md,
    shadowColor: COLORS.inkDeep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIcon: { fontSize: 21 },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: COLORS.ink900 },
  cardSubtitle: { fontSize: 12.5, color: COLORS.ink400, marginTop: 2 },
  chevron: { fontSize: 24, fontWeight: "700" },
  liveCard: {
    backgroundColor: COLORS.inkSoft,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    shadowColor: COLORS.inkDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  liveTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  livePillText: { color: COLORS.white, fontWeight: "900", fontSize: 10.5, letterSpacing: 1 },
  livePowered: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  liveTitle: { color: COLORS.white, fontSize: 20, fontWeight: "800", marginTop: SPACING.md },
  liveSub: { color: "#D9CFE0", fontSize: 13, lineHeight: 19, marginTop: 4 },
  liveCta: { alignSelf: "flex-start", backgroundColor: COLORS.gold, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, paddingVertical: 7, marginTop: SPACING.md },
  liveCtaText: { color: COLORS.inkDeep, fontWeight: "800", fontSize: 13 },
  scamCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: "#FFF5F6", borderRadius: RADIUS.md, padding: SPACING.lg - 2, borderWidth: 1.5, borderColor: COLORS.rose, elevation: 2, shadowColor: COLORS.inkDeep, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  scamIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.roseSoft, alignItems: "center", justifyContent: "center" },
  scamTitle: { fontSize: 16, fontWeight: "800", color: COLORS.ink900 },
  scamSub: { fontSize: 12.5, color: COLORS.ink600, marginTop: 2 },
  newPill: { backgroundColor: COLORS.rose, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 1 },
  newPillText: { color: "#fff", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
  feed: { marginHorizontal: SPACING.lg, marginTop: SPACING.xl, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md + 2 },
  feedHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  feedTitle: { fontWeight: "800", fontSize: 13, color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.6 },
  refresh: { fontSize: 20, color: COLORS.gold, fontWeight: "800" },
  feedEmpty: { color: COLORS.midGray, fontSize: 12.5, paddingVertical: SPACING.sm },
  feedItem: { paddingVertical: SPACING.sm + 2, borderTopWidth: 1, borderTopColor: COLORS.border },
  feedItemTitle: { fontSize: 13.5, color: COLORS.ink900, fontWeight: "600", lineHeight: 19 },
  feedMeta: { fontSize: 11, color: COLORS.midGray, marginTop: 2 },
  feedFoot: { fontSize: 10.5, color: COLORS.midGray, marginTop: SPACING.sm },
  footer: { textAlign: "center", color: COLORS.ink400, fontSize: 11, marginVertical: SPACING.xl },
});
