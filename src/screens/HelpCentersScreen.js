import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Linking, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { COLORS, FONT, RADIUS, SPACING, themed } from "../constants/theme";
import { HELP_CENTERS } from "../data/helpCenters";
import { distanceKm } from "../utils/distance";
import { useLanguage } from "../context/LanguageContext";
import { findHelpCentersLive } from "../services/liveIntel";
import { openLink } from "../components/LiveCard";

const KIND = (type = "") => resolve(kindOf(type));
const resolve = (k) => ({ ...k, color: COLORS[k.color], soft: COLORS[k.soft] });
const kindOf = (type) =>
  /police/i.test(type)
    ? { key: "police", icon: "police-badge-outline", color: "blue", soft: "blueSoft" }
    : /legal|dlsa/i.test(type)
    ? { key: "legal", icon: "scale-balance", color: "violet", soft: "violetSoft" }
    : /women|one stop|sakhi/i.test(type)
    ? { key: "women", icon: "human-female", color: "rose", soft: "roseSoft" }
    : { key: "csc", icon: "office-building-outline", color: "teal", soft: "tealSoft" };

const FILTERS = [
  { key: "all", label: "hcAll" },
  { key: "csc", label: "CSC" },
  { key: "legal", label: "hlLegal" },
  { key: "police", label: "Police" },
  { key: "women", label: "hlWomen" },
];

const MAP_SEARCHES = [
  { q: "Common Service Centre CSC", label: "CSC", icon: "office-building-outline", color: "teal", soft: "tealSoft" },
  { q: "police station", label: "Police", icon: "police-badge-outline", color: "blue", soft: "blueSoft" },
  { q: "District Legal Services Authority", label: "hlLegal", icon: "scale-balance", color: "violet", soft: "violetSoft" },
  { q: "One Stop Centre Sakhi", label: "hlWomen", icon: "human-female", color: "rose", soft: "roseSoft" },
];

const HELPLINES = [
  ["112", "hlEmergency"],
  ["1930", "hlCyber"],
  ["15100", "hlLegal"],
  ["181", "hlWomen"],
];

function Tap({ style, children, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.72 }]}>
      {children}
    </Pressable>
  );
}

export default function HelpCentersScreen() {
  const { t } = useLanguage();
  const tt = (k) => (/^[A-Z]/.test(k) ? k : t(k));
  const [locating, setLocating] = useState(true);
  const [coords, setCoords] = useState(null);
  const [centers, setCenters] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [place, setPlace] = useState(null);
  const [liveState, setLiveState] = useState("idle");
  const [liveCenters, setLiveCenters] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Allow location to see centres near you.");
          setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
          return;
        }
        const loc =
          (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null)) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const { latitude, longitude } = loc.coords;
        setCoords({ latitude, longitude });
        setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: distanceKm(latitude, longitude, c.lat, c.lng) })).sort((a, b) => a.distance - b.distance));
        setLocating(false);
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo) {
            const p = { city: geo.city || geo.subregion, district: geo.subregion || geo.city, state: geo.region, locality: geo.district || geo.street || "" };
            setPlace(p);
            runLive(p);
          }
        } catch (e) {
          console.warn("Reverse geocode failed:", e.message);
        }
      } catch (e) {
        setErrorMsg("Couldn't get your location.");
        setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const runLive = async (p = place) => {
    if (!p) return;
    setLiveState("loading");
    try {
      setLiveCenters(await findHelpCentersLive(p));
      setLiveState("done");
    } catch (e) {
      setLiveState("error");
    }
  };

  const mapsSearch = (q) =>
    coords ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${coords.latitude},${coords.longitude},14z` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} near me`)}`;
  const directions = (c) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${c.name} ${c.address || ""}`)}`;

  const placeLabel = place ? [place.locality, place.city].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ") : "";
  const showLive = liveState === "done" && liveCenters.length > 0;
  const source = showLive ? liveCenters : centers;
  const data = useMemo(() => (filter === "all" ? source : source.filter((c) => KIND(c.type).key === filter)), [source, filter]);

  const Header = (
    <View>
      <View style={styles.loc}>
        <View style={styles.locIcon}>
          <Feather name="navigation" size={17} color={COLORS.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locLabel}>{t("hcYourArea")}</Text>
          <Text style={styles.locText} numberOfLines={1}>
            {locating ? t("hcLocating") : placeLabel || errorMsg || "—"}
          </Text>
        </View>
        {(locating || liveState === "loading") && <ActivityIndicator color={COLORS.ink} />}
        {liveState === "error" && (
          <Tap onPress={() => runLive()}>
            <Feather name="rotate-cw" size={18} color={COLORS.ink} />
          </Tap>
        )}
      </View>

      <View style={styles.mapGrid}>
        {MAP_SEARCHES.map((m) => (
          <Tap key={m.q} style={styles.mapBtn} onPress={() => openLink(mapsSearch(m.q))}>
            <View style={[styles.mapIcon, { backgroundColor: COLORS[m.soft] }]}>
              <MaterialCommunityIcons name={m.icon} size={20} color={COLORS[m.color]} />
            </View>
            <Text style={styles.mapText} numberOfLines={1}>
              {tt(m.label)}
            </Text>
            <Feather name="map" size={15} color={COLORS.faint} />
          </Tap>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.helpRow}>
        {HELPLINES.map(([n, l]) => (
          <Tap key={n} style={styles.helpBtn} onPress={() => Linking.openURL(`tel:${n}`)}>
            <Feather name="phone" size={13} color={COLORS.rose} />
            <Text style={styles.helpNum}>{n}</Text>
            <Text style={styles.helpLbl}>{t(l)}</Text>
          </Tap>
        ))}
      </ScrollView>

      <View style={styles.listHead}>
        <Text style={styles.section}>{showLive ? `${liveCenters.length} ${t("hcFound")}` : liveState === "loading" ? t("hcSearching") : t("hcKnown")}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Tap key={f.key} style={[styles.filter, on && styles.filterOn]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{tt(f.label)}</Text>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <FlatList
        data={liveState === "loading" && !showLive ? [] : data}
        keyExtractor={(item, i) => item.id || String(i)}
        ListHeaderComponent={Header}
        ListEmptyComponent={liveState === "loading" ? [0, 1, 2].map((i) => <View key={i} style={styles.skel} />) : null}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const k = KIND(item.type);
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <View style={[styles.kIcon, { backgroundColor: k.soft }]}>
                  <MaterialCommunityIcons name={k.icon} size={21} color={k.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.type?.split(" (")[0]}
                    {item.distance != null ? `  ·  ${item.distance.toFixed(1)} km` : ""}
                  </Text>
                  {!!item.address && (
                    <Text style={styles.address} numberOfLines={2}>
                      {item.address}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.btnRow}>
                {!!item.phone && (
                  <Tap style={[styles.btn, styles.btnPrimary]} onPress={() => Linking.openURL(`tel:${item.phone.replace(/[^\d+]/g, "")}`)}>
                    <Feather name="phone" size={15} color={COLORS.white} />
                    <Text style={[styles.btnText, { color: COLORS.white }]}>{t("hcCall")}</Text>
                  </Tap>
                )}
                <Tap style={styles.btn} onPress={() => openLink(directions(item))}>
                  <Feather name="navigation-2" size={15} color={COLORS.ink} />
                  <Text style={styles.btnText}>{t("hcDirections")}</Text>
                </Tap>
                {!!item.url && (
                  <Tap style={[styles.btn, { paddingHorizontal: 12 }]} onPress={() => openLink(item.url)}>
                    <Feather name="external-link" size={15} color={COLORS.ink} />
                  </Tap>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loc: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 20, padding: 14, marginTop: 8 },
  locIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center" },
  locLabel: { fontFamily: FONT.semibold, color: COLORS.ink400, fontSize: 12 },
  locText: { fontFamily: FONT.bold, color: COLORS.ink, fontSize: 16, marginTop: 1 },
  mapGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: 14 },
  mapBtn: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  mapIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  mapText: { flex: 1, fontFamily: FONT.semibold, fontSize: 14, color: COLORS.ink },
  helpRow: { gap: 8, paddingTop: 14 },
  helpBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.roseSoft, borderRadius: RADIUS.pill, paddingHorizontal: 13, paddingVertical: 9 },
  helpNum: { fontFamily: FONT.extrabold, color: COLORS.rose, fontSize: 14 },
  helpLbl: { fontFamily: FONT.medium, color: COLORS.ink600, fontSize: 12.5 },
  listHead: { marginTop: 26 },
  section: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3 },
  filters: { gap: 8, paddingVertical: 12 },
  filter: { borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 9 },
  filterOn: { backgroundColor: COLORS.ink },
  filterText: { fontFamily: FONT.semibold, fontSize: 13.5, color: COLORS.ink },
  filterTextOn: { color: COLORS.white },
  skel: { height: 120, borderRadius: 20, backgroundColor: COLORS.surface, marginBottom: 12 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12 },
  kIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONT.bold, fontSize: 16, lineHeight: 22, color: COLORS.ink },
  meta: { fontFamily: FONT.semibold, fontSize: 12.5, color: COLORS.ink400, marginTop: 3 },
  address: { fontFamily: FONT.regular, fontSize: 13.5, lineHeight: 19, color: COLORS.ink600, marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  btn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 16, height: 40 },
  btnPrimary: { backgroundColor: COLORS.ink },
  btnText: { fontFamily: FONT.bold, fontSize: 13.5, color: COLORS.ink },
}));
