import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, FONT, RADIUS, SPACING } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { LiveDot, openLink } from "../components/LiveCard";
import { getLiveUpdates } from "../services/liveIntel";

const QUICK = [
  { key: "qtKisan", icon: "sprout", task: "Am I eligible for PM-KISAN? What documents do I need?" },
  { key: "qtPhone", icon: "cellphone-lock", task: "My phone was stolen today. How do I block it?" },
  { key: "qtAyushman", icon: "hospital-box-outline", task: "How can my 72-year-old father get an Ayushman card?" },
  { key: "qtFraud", icon: "alert-octagon-outline", task: "How do I report a UPI fraud online?" },
  { key: "qtPassport", icon: "passport", task: "How do I apply for a passport?" },
  { key: "qtRti", icon: "file-document-edit-outline", task: "How to file an RTI application online" },
];

const SERVICES = [
  { key: "SchemeNavigator", label: "schemeNavigator", icon: "layers", tint: COLORS.gold, bg: COLORS.goldSoft },
  { key: "LegalCompanion", label: "legalCompanion", mci: "scale-balance", tint: COLORS.violet, bg: COLORS.violetSoft },
  { key: "DocumentSimplifier", label: "documentSimplifier", icon: "file-text", tint: COLORS.blue, bg: COLORS.blueSoft },
  { key: "Translator", label: "translator", mci: "translate", tint: COLORS.teal, bg: COLORS.tealSoft },
  { key: "VisualSolver", label: "visualSolver", icon: "camera", tint: COLORS.amber, bg: COLORS.amberSoft },
];

const HELPLINES = [
  { num: "112", key: "hlEmergency" },
  { num: "1930", key: "hlCyber" },
  { num: "15100", key: "hlLegal" },
  { num: "181", key: "hlWomen" },
];

function Tap({ style, children, onPress, ...rest }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] }]} {...rest}>
      {children}
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { t, geminiLanguageName, langCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const [updates, setUpdates] = useState(null);

  const loadUpdates = async (force = false) => {
    if (force) setUpdates(null);
    try {
      setUpdates(await getLiveUpdates({ language: geminiLanguageName(), force }));
    } catch (e) {
      setUpdates([]);
    }
  };
  useEffect(() => {
    loadUpdates();
  }, [geminiLanguageName()]);

  const goLive = (task) => navigation.getParent()?.navigate("LiveTab", task ? { task, ts: Date.now() } : undefined);

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>
            Nyaya Setu<Text style={{ color: COLORS.gold }}>.</Text>
          </Text>
          <Tap style={styles.langPill} onPress={() => navigation.getParent()?.navigate("SettingsTab")}>
            <Feather name="globe" size={14} color={COLORS.ink} />
            <Text style={styles.langText}>{langCode.toUpperCase()}</Text>
          </Tap>
        </View>

        <Text style={styles.hello}>{t("homeHello")}</Text>
        <Text style={styles.title}>{t("homeTitle")}</Text>

        {/* search / speak bar */}
        <Tap style={styles.search} onPress={() => goLive()}>
          <Feather name="search" size={19} color={COLORS.ink400} />
          <Text style={styles.searchText} numberOfLines={1}>
            {t("askPlaceholder")}
          </Text>
          <View style={styles.micBtn}>
            <Feather name="mic" size={18} color={COLORS.white} />
          </View>
        </Tap>

        {/* quick tasks */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {QUICK.map((q) => (
            <Tap key={q.key} style={styles.chip} onPress={() => goLive(q.task)}>
              <MaterialCommunityIcons name={q.icon} size={17} color={COLORS.ink} />
              <Text style={styles.chipText}>{t(q.key)}</Text>
            </Tap>
          ))}
        </ScrollView>

        <View style={styles.body}>
          {/* hero: Sahayak Live */}
          <Tap style={styles.hero} onPress={() => goLive()}>
            <View style={styles.heroTop}>
              <View style={styles.livePill}>
                <LiveDot color="#FF4D4F" size={7} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{t("sahayakLive")}</Text>
            <View style={styles.heroBottom}>
              <Text style={styles.heroSub}>{t("liveCardSub")}</Text>
              <View style={styles.heroArrow}>
                <Feather name="arrow-up-right" size={22} color={COLORS.ink} />
              </View>
            </View>
          </Tap>

          {/* two core tiles */}
          <View style={styles.tiles}>
            <Tap style={styles.tile} onPress={() => navigation.navigate("ScamShield")}>
              <View style={[styles.tileIcon, { backgroundColor: COLORS.roseSoft }]}>
                <Feather name="shield" size={22} color={COLORS.rose} />
              </View>
              <Text style={styles.tileTitle}>{t("scamShield")}</Text>
              <Text style={styles.tileSub}>{t("scamTileSub")}</Text>
            </Tap>
            <Tap style={styles.tile} onPress={() => navigation.navigate("HelpCenters")}>
              <View style={[styles.tileIcon, { backgroundColor: COLORS.tealSoft }]}>
                <Feather name="map-pin" size={22} color={COLORS.teal} />
              </View>
              <Text style={styles.tileTitle}>{t("helpTileTitle")}</Text>
              <Text style={styles.tileSub}>{t("helpTileSub")}</Text>
            </Tap>
          </View>

          {/* services list */}
          <Text style={styles.section}>{t("servicesTitle")}</Text>
          <View style={styles.list}>
            {SERVICES.map((s, i) => (
              <Tap key={s.key} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => navigation.navigate(s.key)}>
                <View style={[styles.rowIcon, { backgroundColor: s.bg }]}>
                  {s.mci ? <MaterialCommunityIcons name={s.mci} size={19} color={s.tint} /> : <Feather name={s.icon} size={18} color={s.tint} />}
                </View>
                <Text style={styles.rowText}>{t(s.label)}</Text>
                <Feather name="chevron-right" size={20} color="#A1A1AA" />
              </Tap>
            ))}
          </View>

          {/* emergency */}
          <Text style={styles.section}>{t("emergencyTitle")}</Text>
          <View style={styles.sosRow}>
            {HELPLINES.map((h) => (
              <Tap key={h.num} style={styles.sos} onPress={() => Linking.openURL(`tel:${h.num}`)}>
                <Text style={styles.sosNum}>{h.num}</Text>
                <Text style={styles.sosLbl} numberOfLines={1}>
                  {t(h.key)}
                </Text>
              </Tap>
            ))}
          </View>

          {/* updates */}
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]}>{t("updatesTitle")}</Text>
            <Tap onPress={() => loadUpdates(true)} hitSlop={12}>
              <Feather name="rotate-cw" size={17} color={COLORS.ink400} />
            </Tap>
          </View>
          {updates === null && [0, 1, 2].map((i) => <View key={i} style={styles.skel} />)}
          {updates?.length === 0 && <Text style={styles.empty}>{t("noUpdates")}</Text>}
          {updates?.slice(0, 4).map((u, i) => (
            <Tap key={i} style={[styles.news, i > 0 && styles.rowBorder]} onPress={() => openLink(u.url)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.newsTag, { color: u.fraud ? COLORS.rose : u.official ? COLORS.teal : COLORS.ink400 }]}>
                  {u.fraud ? t("tagFraud") : u.official ? t("tagOfficial") : t("tagNews")}
                </Text>
                <Text style={styles.newsTitle} numberOfLines={2}>
                  {u.title}
                </Text>
                <Text style={styles.newsMeta} numberOfLines={1}>
                  {u.site}
                  {u.date ? `  ·  ${u.date}` : ""}
                </Text>
              </View>
              <Feather name="arrow-up-right" size={18} color="#A1A1AA" />
            </Tap>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: SPACING.md },
  brand: { fontFamily: FONT.extrabold, fontSize: 20, color: COLORS.ink, letterSpacing: -0.4 },
  langPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
  langText: { fontFamily: FONT.bold, fontSize: 12.5, color: COLORS.ink },
  hello: { fontFamily: FONT.medium, fontSize: 15, color: COLORS.ink400, paddingHorizontal: 20, marginTop: 22 },
  title: { fontFamily: FONT.extrabold, fontSize: 30, lineHeight: 36, color: COLORS.ink, letterSpacing: -0.8, paddingHorizontal: 20, marginTop: 2 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    paddingLeft: 16,
    paddingRight: 6,
    height: 58,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchText: { flex: 1, fontFamily: FONT.medium, fontSize: 15.5, color: COLORS.ink400 },
  micBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: FONT.semibold, fontSize: 13.5, color: COLORS.ink },
  body: { paddingHorizontal: 20 },

  hero: { marginTop: 20, backgroundColor: COLORS.ink, borderRadius: RADIUS.lg, padding: 20, minHeight: 170, justifyContent: "space-between" },
  heroTop: { flexDirection: "row" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  livePillText: { fontFamily: FONT.bold, fontSize: 11, color: COLORS.white, letterSpacing: 1.2 },
  heroTitle: { fontFamily: FONT.extrabold, fontSize: 28, color: COLORS.white, letterSpacing: -0.6, marginTop: 18 },
  heroBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 6 },
  heroSub: { flex: 1, fontFamily: FONT.medium, fontSize: 14.5, lineHeight: 20, color: "#BDBDC4" },
  heroArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },

  tiles: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, minHeight: 150 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontFamily: FONT.bold, fontSize: 16.5, color: COLORS.ink, marginTop: 18, letterSpacing: -0.2 },
  tileSub: { fontFamily: FONT.medium, fontSize: 13, lineHeight: 18, color: COLORS.ink400, marginTop: 3 },

  section: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3, marginTop: 30, marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 30, marginBottom: 6 },
  list: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.bg },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: FONT.semibold, fontSize: 15.5, color: COLORS.ink },

  sosRow: { flexDirection: "row", gap: 8 },
  sos: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center" },
  sosNum: { fontFamily: FONT.extrabold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3 },
  sosLbl: { fontFamily: FONT.medium, fontSize: 11.5, color: COLORS.ink400, marginTop: 2 },

  skel: { height: 64, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, marginTop: 10 },
  empty: { fontFamily: FONT.medium, fontSize: 14, color: COLORS.ink400, paddingVertical: 12 },
  news: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  newsTag: { fontFamily: FONT.bold, fontSize: 10.5, letterSpacing: 1 },
  newsTitle: { fontFamily: FONT.semibold, fontSize: 15, lineHeight: 21, color: COLORS.ink, marginTop: 3 },
  newsMeta: { fontFamily: FONT.medium, fontSize: 12.5, color: COLORS.ink400, marginTop: 4 },
});
