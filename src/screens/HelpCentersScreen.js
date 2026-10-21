import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, ScrollView } from "react-native";
import * as Location from "expo-location";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { HELP_CENTERS } from "../data/helpCenters";
import { distanceKm } from "../utils/distance";
import { useLanguage } from "../context/LanguageContext";
import { findHelpCentersLive } from "../services/liveIntel";
import { LiveDot, LiveWorking, openLink } from "../components/LiveCard";
import { hasTinyFishKey } from "../services/tinyfishApi";

// type → filter key, icon and colour
const KIND = (type = "") =>
  /police/i.test(type)
    ? { key: "police", icon: "🚓", color: "#0E7AA8", soft: "#E4F1F8" }
    : /legal|dlsa/i.test(type)
    ? { key: "legal", icon: "⚖️", color: "#6B4FD8", soft: "#ECE8FB" }
    : /women|one stop|sakhi/i.test(type)
    ? { key: "women", icon: "👩", color: COLORS.rose, soft: COLORS.roseSoft }
    : { key: "csc", icon: "🏛️", color: COLORS.teal, soft: COLORS.tealSoft };

const FILTERS = [
  { key: "all", label: null, icon: "✨" },
  { key: "csc", label: "CSC", icon: "🏛️" },
  { key: "legal", label: "Legal aid", icon: "⚖️" },
  { key: "police", label: "Police", icon: "🚓" },
  { key: "women", label: "Women", icon: "👩" },
];

// Google Maps searches around the user's real position — always works, even if live web search fails
const MAP_SEARCHES = [
  { q: "Common Service Centre CSC", label: "CSC centre", icon: "🏛️" },
  { q: "police station", label: "Police station", icon: "🚓" },
  { q: "District Legal Services Authority", label: "Legal aid (DLSA)", icon: "⚖️" },
  { q: "One Stop Centre Sakhi", label: "Women's help", icon: "👩" },
];

const HELPLINES = [
  ["112", "Emergency"],
  ["1930", "Cyber fraud"],
  ["15100", "Free legal aid"],
  ["181", "Women"],
  ["14599", "CSC helpdesk"],
];

export default function HelpCentersScreen() {
  const { t } = useLanguage();
  const [locating, setLocating] = useState(true);
  const [coords, setCoords] = useState(null);
  const [centers, setCenters] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [place, setPlace] = useState(null); // { city, district, state, locality }
  const [liveState, setLiveState] = useState("idle"); // idle | loading | done | error
  const [liveCenters, setLiveCenters] = useState([]);
  const [liveError, setLiveError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Location permission is off — showing known centres. Allow location for centres near you.");
          setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
          return;
        }
        const loc = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null)) || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const { latitude, longitude } = loc.coords;
        setCoords({ latitude, longitude });
        setCenters(
          HELP_CENTERS.map((c) => ({ ...c, distance: distanceKm(latitude, longitude, c.lat, c.lng) })).sort((a, b) => a.distance - b.distance)
        );
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
        console.warn("Location error:", e?.message);
        setErrorMsg("Couldn't get your location — showing known centres.");
        setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const runLive = async (p = place) => {
    if (!p) return;
    setLiveState("loading");
    setLiveError(null);
    try {
      const list = await findHelpCentersLive(p);
      setLiveCenters(list);
      setLiveState("done");
    } catch (e) {
      setLiveError(e.message);
      setLiveState("error");
    }
  };

  const mapsSearch = (q) =>
    coords
      ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${coords.latitude},${coords.longitude},14z`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} near me`)}`;
  const directions = (c) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${c.name} ${c.address || ""}`)}`;

  const placeLabel = place ? [place.locality, place.city, place.state].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ") : "";
  const showLive = liveState === "done" && liveCenters.length > 0;
  const source = showLive ? liveCenters : centers;
  const data = useMemo(() => (filter === "all" ? source : source.filter((c) => KIND(c.type).key === filter)), [source, filter]);
  const counts = useMemo(() => {
    const m = { all: source.length };
    source.forEach((c) => (m[KIND(c.type).key] = (m[KIND(c.type).key] || 0) + 1));
    return m;
  }, [source]);

  const Header = (
    <View>
      {/* Where am I */}
      <View style={styles.locCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 22 }}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.locLabel}>YOUR LOCATION</Text>
            <Text style={styles.locText} numberOfLines={2}>
              {locating ? "Finding where you are…" : placeLabel || (coords ? "Location found" : "Location not available")}
            </Text>
          </View>
          {locating && <ActivityIndicator color={COLORS.gold} />}
        </View>
        {(place || liveState !== "idle") && (
          <View style={styles.liveRow}>
            <LiveDot />
            <Text style={styles.liveText}>
              {liveState === "loading"
                ? `${t("findingRealCentres")} ${place?.city || ""}…`
                : showLive
                ? `${liveCenters.length} ${t("realCentresIn")} ${place?.city || ""} · TinyFish${hasTinyFishKey() ? "" : " (demo)"}`
                : liveState === "error"
                ? "Live search failed"
                : "Live web search via TinyFish"}
            </Text>
          </View>
        )}
        {liveState === "error" && (
          <TouchableOpacity onPress={() => runLive()}>
            <Text style={styles.retry}>⚠️ {liveError} — tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nearest on the map — works even without live search */}
      <Text style={styles.section}>🗺️ {t("nearestOnMap")}</Text>
      <View style={styles.mapGrid}>
        {MAP_SEARCHES.map((m) => (
          <TouchableOpacity key={m.q} style={styles.mapBtn} onPress={() => openLink(mapsSearch(m.q))} activeOpacity={0.85}>
            <Text style={styles.mapIcon}>{m.icon}</Text>
            <Text style={styles.mapText} numberOfLines={1}>
              {m.label}
            </Text>
            <Text style={styles.mapGo}>↗</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Helplines */}
      <Text style={styles.section}>📞 {t("helplinesOneTap")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
        {HELPLINES.map(([n, l]) => (
          <TouchableOpacity key={n} style={styles.helpBtn} onPress={() => Linking.openURL(`tel:${n}`)}>
            <Text style={styles.helpNum}>{n}</Text>
            <Text style={styles.helpLbl}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const n = counts[f.key] || 0;
          return (
            <TouchableOpacity key={f.key} style={[styles.filter, on && styles.filterOn]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.filterText, on && styles.filterTextOn]}>
                {f.icon} {f.label || t("allTypes")} {n ? `· ${n}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {liveState === "loading" && (
        <LiveWorking lines={["Searching CSC centres near you…", "Finding your District Legal Services Authority…", "Finding police stations & One Stop Centres…", "Gemini is extracting addresses & phone numbers…"]} />
      )}
      {!showLive && liveState !== "loading" && (
        <Text style={styles.sampleNote}>
          {errorMsg || (liveState === "done" ? "Couldn't confirm exact addresses online — use “Nearest on the map” above, or these known centres:" : "Known centres:")}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <FlatList
        data={data}
        keyExtractor={(item, i) => item.id || String(i)}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          liveState !== "loading" && !locating ? <Text style={styles.sampleNote}>No centres of this type found — try “Nearest on the map”.</Text> : null
        }
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xl * 2 }}
        renderItem={({ item }) => {
          const k = KIND(item.type);
          return (
            <View style={[styles.card, { borderLeftColor: k.color }]}>
              <View style={{ flexDirection: "row", gap: SPACING.md }}>
                <View style={[styles.kIcon, { backgroundColor: k.soft }]}>
                  <Text style={{ fontSize: 19 }}>{k.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.type, { color: k.color }]}>{item.type}</Text>
                  {!!item.address && <Text style={styles.address}>{item.address}</Text>}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    {item.distance != null && <Text style={styles.meta}>📏 {item.distance.toFixed(1)} km {t("distanceAway")}</Text>}
                    {item.live && <Text style={[styles.meta, { color: COLORS.teal, fontWeight: "700" }]}>● found live</Text>}
                  </View>
                </View>
              </View>
              <View style={styles.btnRow}>
                {!!item.phone && (
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => Linking.openURL(`tel:${item.phone.replace(/[^\d+]/g, "")}`)}>
                    <Text style={[styles.btnText, { color: COLORS.white }]}>📞 Call</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btn} onPress={() => openLink(directions(item))}>
                  <Text style={styles.btnText}>🧭 Directions</Text>
                </TouchableOpacity>
                {!!item.url && (
                  <TouchableOpacity style={styles.btn} onPress={() => openLink(item.url)}>
                    <Text style={styles.btnText}>🔗 Source</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.parchment },
  locCard: { backgroundColor: COLORS.ink, borderRadius: RADIUS.md, padding: SPACING.md + 2 },
  locLabel: { color: COLORS.gold, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  locText: { color: COLORS.white, fontSize: 15, fontWeight: "800", marginTop: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, backgroundColor: COLORS.inkSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  liveText: { color: "#E7DCEB", fontSize: 11.5, fontWeight: "700" },
  retry: { color: COLORS.gold, marginTop: 8, fontWeight: "700" },
  section: { fontSize: 12, fontWeight: "900", color: COLORS.ink, letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.sm, textTransform: "uppercase" },
  mapGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  mapBtn: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 11, borderWidth: 1, borderColor: COLORS.border },
  mapIcon: { fontSize: 17 },
  mapText: { flex: 1, fontSize: 12.5, fontWeight: "700", color: COLORS.ink900 },
  mapGo: { color: COLORS.teal, fontWeight: "900" },
  helpBtn: { backgroundColor: COLORS.roseSoft, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#EBC6CD", alignItems: "center" },
  helpNum: { color: COLORS.rose, fontWeight: "900", fontSize: 14 },
  helpLbl: { color: COLORS.darkGray, fontSize: 10.5, marginTop: 1 },
  filters: { gap: 6, paddingVertical: SPACING.md },
  filter: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 6 },
  filterOn: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  filterText: { fontSize: 12.5, fontWeight: "700", color: COLORS.ink600 },
  filterTextOn: { color: COLORS.white },
  sampleNote: { color: COLORS.midGray, fontSize: 12, paddingVertical: 8 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md + 2, marginBottom: SPACING.md, borderLeftWidth: 4, shadowColor: COLORS.inkDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  kIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "800", color: COLORS.ink900 },
  type: { fontSize: 12, marginTop: 2, fontWeight: "700" },
  address: { fontSize: 12.5, color: COLORS.darkGray, marginTop: 4, lineHeight: 18 },
  meta: { fontSize: 11.5, color: COLORS.midGray },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.md },
  btn: { backgroundColor: COLORS.tealSoft, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  btnPrimary: { backgroundColor: COLORS.teal },
  btnText: { color: COLORS.teal, fontWeight: "800", fontSize: 12.5 },
});
