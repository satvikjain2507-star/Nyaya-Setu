import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import * as Location from "expo-location";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { HELP_CENTERS } from "../data/helpCenters";
import { distanceKm } from "../utils/distance";
import { useLanguage } from "../context/LanguageContext";
import { findHelpCentersLive } from "../services/liveIntel";
import { LiveDot, LiveWorking, openLink } from "../components/LiveCard";
import { hasTinyFishKey } from "../services/tinyfishApi";

const TYPE_ICON = (type = "") =>
  /police/i.test(type) ? "🚓" : /legal|dlsa/i.test(type) ? "⚖️" : /women|one stop|sakhi/i.test(type) ? "👩" : "🏛️";

export default function HelpCentersScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [place, setPlace] = useState(null); // { city, district, state }
  const [liveState, setLiveState] = useState("idle"); // idle | loading | done | error
  const [liveCenters, setLiveCenters] = useState([]);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Location permission denied — showing sample list instead.");
          setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const withDistance = HELP_CENTERS.map((c) => ({
          ...c,
          distance: distanceKm(loc.coords.latitude, loc.coords.longitude, c.lat, c.lng),
        })).sort((a, b) => a.distance - b.distance);
        setCenters(withDistance);

        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (geo) {
            const p = { city: geo.city || geo.subregion, district: geo.subregion || geo.city, state: geo.region, locality: geo.district || geo.street || "" };
            setPlace(p);
            runLive(p);
          }
        } catch (e) {
          console.warn("Reverse geocode failed:", e.message);
        }
      } catch (e) {
        console.error("Location error:", e);
        setErrorMsg("Couldn't get your location — showing sample list instead.");
        setCenters(HELP_CENTERS.map((c) => ({ ...c, distance: null })));
      } finally {
        setLoading(false);
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

  const mapsUrl = (c) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.name} ${c.address || ""}`)}`;

  if (loading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </SafeAreaView>
    );
  }

  const placeLabel = place ? [place.city, place.state].filter(Boolean).join(", ") : "";
  const showLive = liveState === "done" && liveCenters.length > 0;
  const data = showLive ? liveCenters : centers;

  const HELPLINES = [
    ["112", "Emergency"],
    ["1930", "Cyber fraud"],
    ["15100", "Free legal aid"],
    ["181", "Women helpline"],
    ["14599", "CSC helpdesk"],
  ];

  const Header = (
    <View>
      <View style={styles.helpRow}>
        {HELPLINES.map(([n, l]) => (
          <TouchableOpacity key={n} style={styles.helpBtn} onPress={() => Linking.openURL(`tel:${n}`)}>
            <Text style={styles.helpNum}>📞 {n}</Text>
            <Text style={styles.helpLbl}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {place && (
        <View style={styles.liveBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <LiveDot />
            <Text style={styles.liveTitle}>
              {showLive ? `${t("realCentresIn")} ${placeLabel}` : `${t("findingRealCentres")} ${placeLabel}`}
            </Text>
          </View>
          <Text style={styles.liveSub}>
            Searched live on the web via TinyFish{hasTinyFishKey() ? "" : " (demo mode)"} · verify before visiting
          </Text>
          {liveState === "error" && (
            <TouchableOpacity onPress={() => runLive()}>
              <Text style={styles.retry}>⚠️ {liveError} — tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {liveState === "loading" && (
        <LiveWorking lines={["Searching CSC centres near you…", "Finding your District Legal Services Authority…", "Finding police stations & One Stop Centres…", "Extracting addresses & phone numbers…"]} />
      )}
      {!showLive && liveState !== "loading" && (
        <Text style={styles.sampleNote}>
          {errorMsg || (liveState === "done" ? "Couldn't confirm exact addresses online right now — showing known centres:" : "Known centres (offline list):")}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={Header}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.live && styles.cardLive]}>
            <Text style={styles.name}>
              {TYPE_ICON(item.type)} {item.name}
            </Text>
            <Text style={styles.type}>{item.type}</Text>
            {!!item.address && <Text style={styles.address}>{item.address}</Text>}
            {item.distance != null && (
              <Text style={styles.distance}>
                {item.distance.toFixed(1)} km {t("distanceAway")}
              </Text>
            )}
            {item.live && (
              <View style={styles.btnRow}>
                {!!item.phone && (
                  <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(`tel:${item.phone.replace(/[^\d+]/g, "")}`)}>
                    <Text style={styles.btnText}>📞 Call</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btn} onPress={() => openLink(mapsUrl(item))}>
                  <Text style={styles.btnText}>🗺️ Directions</Text>
                </TouchableOpacity>
                {!!item.url && (
                  <TouchableOpacity style={styles.btn} onPress={() => openLink(item.url)}>
                    <Text style={styles.btnText}>🔗 Source</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { justifyContent: "center", alignItems: "center" },
  helpRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: SPACING.md },
  helpBtn: { backgroundColor: COLORS.roseSoft, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#EBC6CD" },
  helpNum: { color: COLORS.rose, fontWeight: "800", fontSize: 13 },
  helpLbl: { color: COLORS.darkGray, fontSize: 10.5, marginTop: 1 },
  sampleNote: { color: COLORS.midGray, fontSize: 12, padding: 8 },
  liveBanner: { backgroundColor: COLORS.ink, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  liveTitle: { color: COLORS.white, fontWeight: "800", fontSize: 14, flexShrink: 1 },
  liveSub: { color: "#D9CFE0", fontSize: 11.5, marginTop: 4 },
  retry: { color: COLORS.gold, marginTop: 6, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.lightBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.navy,
  },
  cardLive: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderLeftColor: COLORS.teal },
  name: { fontSize: 15, fontWeight: "bold", color: COLORS.black },
  type: { fontSize: 12.5, color: COLORS.orange, marginTop: 2, fontWeight: "600" },
  address: { fontSize: 12.5, color: COLORS.darkGray, marginTop: 4 },
  distance: { fontSize: 12, color: COLORS.midGray, marginTop: 6 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  btn: { backgroundColor: COLORS.tealSoft, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { color: COLORS.teal, fontWeight: "700", fontSize: 12.5 },
});
