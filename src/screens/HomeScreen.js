import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, FONT, RADIUS, SPACING, themed } from "../constants/theme";
import { useLanguage } from "../context/LanguageContext";
import { openLink } from "../components/LiveCard";
import { getLiveUpdates } from "../services/liveIntel";
import { BrandMark, Chakra, LiveArt, ShieldArt, MapArt, ScriptsArt, Pulse } from "../components/Art";

const GRAD = {
  header: ["#FF8A1F", "#FF5A1F", "#F23D3D"],
  live: ["#2F1FB8", "#4B36F0", "#8A3FF2"],
  scam: ["#FF4F55", "#C9183F"],
  help: ["#16C47F", "#0A7A55"],
  lang: ["#FFF4E2", "#FFE3C4"],
};

const QUICK = [
  { key: "qtKisan", icon: "sprout", c: "#0A9466", task: "Am I eligible for PM-KISAN? What documents do I need?" },
  { key: "qtPhone", icon: "cellphone-lock", c: "#2563EB", task: "My phone was stolen today. How do I block it?" },
  { key: "qtAyushman", icon: "hospital-box", c: "#E5383E", task: "How can my 72-year-old father get an Ayushman card?" },
  { key: "qtFraud", icon: "alert-octagon", c: "#F2611D", task: "How do I report a UPI fraud online?" },
  { key: "qtPassport", icon: "passport", c: "#6E56CF", task: "How do I apply for a passport?" },
  { key: "qtRti", icon: "file-document-edit", c: "#B7791F", task: "How to file an RTI application online" },
];

const SERVICES = [
  { key: "SchemeNavigator", label: "schemeNavigator", icon: "layers-triple", c: "#F2611D", bg: ["#FFF1E6", "#FFE0C8"] },
  { key: "LegalCompanion", label: "legalCompanion", icon: "scale-balance", c: "#6E56CF", bg: ["#F3EFFF", "#E4DBFF"] },
  { key: "DocumentSimplifier", label: "documentSimplifier", icon: "file-document-outline", c: "#2563EB", bg: ["#EEF4FF", "#DCE7FF"] },
  { key: "Translator", label: "translator", icon: "translate", c: "#0A9466", bg: ["#E9FBF2", "#D2F3E3"] },
  { key: "VisualSolver", label: "visualSolver", icon: "camera-outline", c: "#C2410C", bg: ["#FFF6E5", "#FFE9BF"] },
  { key: "ScamShield", label: "scamShield", icon: "shield-check-outline", c: "#E5383E", bg: ["#FFEEEF", "#FFD9DB"] },
];

const HELPLINES = [
  { num: "112", key: "hlEmergency", icon: "alarm-light" },
  { num: "1930", key: "hlCyber", icon: "shield-alert" },
  { num: "15100", key: "hlLegal", icon: "scale-balance" },
  { num: "181", key: "hlWomen", icon: "human-female" },
];

function Tap({ style, children, onPress, ...rest }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.85, transform: [{ scale: 0.975 }] }]} {...rest}>
      {children}
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { t, geminiLanguageName, langCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
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
  const goSettings = () => navigation.getParent()?.navigate("SettingsTab");

  return (
    <View style={styles.safe}>
      {focused && <StatusBar style="light" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* ===== saffron header band ===== */}
        <LinearGradient colors={GRAD.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Chakra size={280} opacity={0.12} style={styles.chakra} />
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <BrandMark size={36} light />
              <View>
                <Text style={styles.brand}>Nyaya Setu</Text>
                <Text style={styles.brandSub}>{t("brandTagline")}</Text>
              </View>
            </View>
            <Tap style={styles.langPill} onPress={goSettings}>
              <Feather name="globe" size={14} color="#FFFFFF" />
              <Text style={styles.langText}>{langCode.toUpperCase()}</Text>
            </Tap>
          </View>

          <Text style={styles.title}>{t("homeTitle")}</Text>

          <Tap style={styles.search} onPress={() => goLive()}>
            <Feather name="search" size={19} color="#71717A" />
            <Text style={styles.searchText} numberOfLines={1}>
              {t("askPlaceholder")}
            </Text>
            <View style={styles.searchDivider} />
            <MaterialCommunityIcons name="microphone" size={22} color="#FF5A1F" />
          </Tap>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
            {QUICK.map((q) => (
              <Tap key={q.key} style={styles.cat} onPress={() => goLive(q.task)}>
                <View style={styles.catIcon}>
                  <MaterialCommunityIcons name={q.icon} size={26} color={q.c} />
                </View>
                <Text style={styles.catText} numberOfLines={1}>
                  {t(q.key)}
                </Text>
              </Tap>
            ))}
          </ScrollView>
        </LinearGradient>

        <View style={styles.body}>
          {/* ===== hero: Sahayak Live ===== */}
          <Tap onPress={() => goLive()} style={styles.heroWrap}>
            <LinearGradient colors={GRAD.live} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroGlow} />
              <View style={styles.heroArt}>
                <LiveArt width={158} />
              </View>
              <View style={styles.livePill}>
                <Pulse size={10} color="#FF4D4F" />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
              <Text style={styles.heroTitle}>{t("sahayakLive")}</Text>
              <Text style={styles.heroSub}>{t("liveCardSub")}</Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>{t("tryNow")}</Text>
                <Feather name="arrow-right" size={16} color="#4B36F0" />
              </View>
            </LinearGradient>
          </Tap>

          {/* ===== two feature tiles ===== */}
          <View style={styles.tiles}>
            <Tap style={styles.tileWrap} onPress={() => navigation.navigate("ScamShield")}>
              <LinearGradient colors={GRAD.scam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                <View style={styles.tileArt}>
                  <ShieldArt size={104} />
                </View>
                <Text style={styles.tileTitle}>{t("scamShield")}</Text>
                <Text style={styles.tileSub}>{t("scamTileSub")}</Text>
                <View style={styles.tileArrow}>
                  <Feather name="arrow-right" size={16} color="#C9183F" />
                </View>
              </LinearGradient>
            </Tap>
            <Tap style={styles.tileWrap} onPress={() => navigation.navigate("HelpCenters")}>
              <LinearGradient colors={GRAD.help} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                <View style={styles.tileArt}>
                  <MapArt size={104} />
                </View>
                <Text style={styles.tileTitle}>{t("helpTileTitle")}</Text>
                <Text style={styles.tileSub}>{t("helpTileSub")}</Text>
                <View style={styles.tileArrow}>
                  <Feather name="arrow-right" size={16} color="#0A7A55" />
                </View>
              </LinearGradient>
            </Tap>
          </View>

          {/* ===== services grid ===== */}
          <Text style={styles.section}>{t("servicesTitle")}</Text>
          <View style={styles.grid}>
            {SERVICES.map((s) => (
              <Tap key={s.key} style={styles.gridItem} onPress={() => navigation.navigate(s.key)}>
                <LinearGradient colors={s.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gridTile}>
                  <View style={[styles.gridIcon, { backgroundColor: s.c }]}>
                    <MaterialCommunityIcons name={s.icon} size={24} color="#FFFFFF" />
                  </View>
                </LinearGradient>
                <Text style={styles.gridText} numberOfLines={2}>
                  {t(s.label)}
                </Text>
              </Tap>
            ))}
          </View>

          {/* ===== language banner ===== */}
          <Tap onPress={goSettings} style={styles.langWrap}>
            <LinearGradient colors={GRAD.lang} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.langCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.langTitle}>{t("langBannerTitle")}</Text>
                <Text style={styles.langSub}>{t("langBannerSub")}</Text>
                <View style={styles.langBtn}>
                  <Text style={styles.langBtnText}>{t("langBannerCta")}</Text>
                </View>
              </View>
              <ScriptsArt width={136} />
            </LinearGradient>
          </Tap>

          {/* ===== emergency ===== */}
          <View style={styles.sosCard}>
            <View style={styles.sosHead}>
              <View style={styles.sosBadge}>
                <MaterialCommunityIcons name="phone-alert" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.sosTitle}>{t("emergencyTitle")}</Text>
            </View>
            <View style={styles.sosRow}>
              {HELPLINES.map((h) => (
                <Tap key={h.num} style={styles.sos} onPress={() => Linking.openURL(`tel:${h.num}`)}>
                  <MaterialCommunityIcons name={h.icon} size={18} color="#E5383E" />
                  <Text style={styles.sosNum}>{h.num}</Text>
                  <Text style={styles.sosLbl} numberOfLines={1}>
                    {t(h.key)}
                  </Text>
                </Tap>
              ))}
            </View>
          </View>

          {/* ===== updates ===== */}
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]}>{t("updatesTitle")}</Text>
            <Tap onPress={() => loadUpdates(true)} hitSlop={12}>
              <Feather name="rotate-cw" size={17} color={COLORS.ink400} />
            </Tap>
          </View>
          {updates === null && [0, 1, 2].map((i) => <View key={i} style={styles.skel} />)}
          {updates?.length === 0 && <Text style={styles.empty}>{t("noUpdates")}</Text>}
          {updates?.slice(0, 4).map((u, i) => {
            const tag = u.fraud ? { l: t("tagFraud"), c: COLORS.rose, b: COLORS.roseSoft, i: "alert" } : u.official ? { l: t("tagOfficial"), c: COLORS.teal, b: COLORS.tealSoft, i: "check-decagram" } : { l: t("tagNews"), c: COLORS.blue, b: COLORS.blueSoft, i: "newspaper-variant-outline" };
            return (
              <Tap key={i} style={styles.news} onPress={() => openLink(u.url)}>
                <View style={[styles.newsIcon, { backgroundColor: tag.b }]}>
                  <MaterialCommunityIcons name={tag.i} size={20} color={tag.c} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.newsTag, { color: tag.c }]}>{tag.l}</Text>
                  <Text style={styles.newsTitle} numberOfLines={2}>
                    {u.title}
                  </Text>
                  <Text style={styles.newsMeta} numberOfLines={1}>
                    {u.site}
                    {u.date ? `  ·  ${u.date}` : ""}
                  </Text>
                </View>
              </Tap>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },

    header: { paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
    chakra: { position: "absolute", right: -90, top: -40 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    brand: { fontFamily: FONT.extrabold, fontSize: 20, color: "#FFFFFF", letterSpacing: -0.4 },
    brandSub: { fontFamily: FONT.semibold, fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: -1 },
    langPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8 },
    langText: { fontFamily: FONT.bold, fontSize: 12.5, color: "#FFFFFF" },
    title: { fontFamily: FONT.extrabold, fontSize: 27, lineHeight: 33, color: "#FFFFFF", letterSpacing: -0.7, marginTop: 20 },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
      paddingHorizontal: 16,
      height: 54,
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      shadowColor: "#7A1F00",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    searchText: { flex: 1, fontFamily: FONT.medium, fontSize: 15, color: "#71717A" },
    searchDivider: { width: 1, height: 24, backgroundColor: "#E4E4E7" },
    cats: { gap: 14, paddingTop: 18, paddingRight: 20 },
    cat: { width: 70, alignItems: "center" },
    catIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#7A1F00", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    catText: { fontFamily: FONT.bold, fontSize: 12, color: "#FFFFFF", marginTop: 7 },

    body: { paddingHorizontal: 20 },

    heroWrap: { marginTop: 20, borderRadius: 26, shadowColor: "#4B36F0", shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 9 },
    hero: { borderRadius: 26, padding: 20, minHeight: 200, overflow: "hidden" },
    heroGlow: { position: "absolute", width: 240, height: 240, borderRadius: 120, right: -80, top: -100, backgroundColor: "rgba(255,255,255,0.10)" },
    heroArt: { position: "absolute", right: -6, bottom: 6 },
    livePill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
    livePillText: { fontFamily: FONT.extrabold, fontSize: 11, color: "#FFFFFF", letterSpacing: 1.4 },
    heroTitle: { fontFamily: FONT.extrabold, fontSize: 28, color: "#FFFFFF", letterSpacing: -0.6, marginTop: 14 },
    heroSub: { width: "56%", fontFamily: FONT.medium, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.88)", marginTop: 4 },
    heroCta: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF", borderRadius: RADIUS.pill, paddingHorizontal: 16, height: 38, marginTop: 16 },
    heroCtaText: { fontFamily: FONT.extrabold, fontSize: 13.5, color: "#4B36F0" },

    tiles: { flexDirection: "row", gap: 12, marginTop: 14 },
    tileWrap: { flex: 1, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
    tile: { borderRadius: 24, padding: 16, height: 176, overflow: "hidden" },
    tileArt: { position: "absolute", right: -18, bottom: -14 },
    tileTitle: { fontFamily: FONT.extrabold, fontSize: 18, color: "#FFFFFF", letterSpacing: -0.3 },
    tileSub: { width: "78%", fontFamily: FONT.medium, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.9)", marginTop: 3 },
    tileArrow: { position: "absolute", left: 16, bottom: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },

    section: { fontFamily: FONT.extrabold, fontSize: 19, color: COLORS.ink, letterSpacing: -0.3, marginTop: 28, marginBottom: 12 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
    gridItem: { width: "31%", alignItems: "center" },
    gridTile: { width: "100%", aspectRatio: 1.05, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    gridIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
    gridText: { fontFamily: FONT.bold, fontSize: 12.5, lineHeight: 16, color: COLORS.ink, textAlign: "center", marginTop: 8 },

    langWrap: { marginTop: 24 },
    langCard: { flexDirection: "row", alignItems: "center", borderRadius: 24, padding: 18, paddingRight: 10, overflow: "hidden" },
    langTitle: { fontFamily: FONT.extrabold, fontSize: 18, lineHeight: 23, color: "#3A1A00", letterSpacing: -0.3 },
    langSub: { fontFamily: FONT.medium, fontSize: 13, color: "#8A4B12", marginTop: 3 },
    langBtn: { alignSelf: "flex-start", backgroundColor: "#FF5A1F", borderRadius: RADIUS.pill, paddingHorizontal: 14, height: 34, justifyContent: "center", marginTop: 12 },
    langBtnText: { fontFamily: FONT.extrabold, fontSize: 12.5, color: "#FFFFFF" },

    sosCard: { marginTop: 16, borderRadius: 24, padding: 16, backgroundColor: COLORS.roseSoft },
    sosHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    sosBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#E5383E", alignItems: "center", justifyContent: "center" },
    sosTitle: { fontFamily: FONT.extrabold, fontSize: 16.5, color: COLORS.ink },
    sosRow: { flexDirection: "row", gap: 8 },
    sos: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 16, paddingVertical: 12, alignItems: "center" },
    sosNum: { fontFamily: FONT.extrabold, fontSize: 17, color: "#E5383E", letterSpacing: -0.3, marginTop: 4 },
    sosLbl: { fontFamily: FONT.semibold, fontSize: 11, color: COLORS.ink400, marginTop: 1 },

    skel: { height: 70, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, marginTop: 10 },
    empty: { fontFamily: FONT.medium, fontSize: 14, color: COLORS.ink400, paddingVertical: 12 },
    news: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
    newsIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    newsTag: { fontFamily: FONT.extrabold, fontSize: 10.5, letterSpacing: 0.8 },
    newsTitle: { fontFamily: FONT.bold, fontSize: 14.5, lineHeight: 20, color: COLORS.ink, marginTop: 2 },
    newsMeta: { fontFamily: FONT.medium, fontSize: 12, color: COLORS.ink400, marginTop: 3 },
  })
);
