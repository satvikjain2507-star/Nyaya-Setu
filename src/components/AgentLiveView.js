import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing, Pressable, Modal, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { COLORS, FONT, RADIUS, SPACING, themed } from "../constants/theme";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";
import { LiveDot } from "./LiveCard";

// Makes TinyFish's live stream page fill the frame (it is designed for a desktop iframe).
const FIT_JS = `
(function(){
  var css = 'html,body{margin:0!important;padding:0!important;background:#0B0B0C!important;overflow:hidden!important;height:100%!important;width:100%!important}' +
            'img,video,canvas,iframe{width:100%!important;height:100%!important;object-fit:contain!important;max-width:100%!important;display:block}';
  var s = document.createElement('style'); s.innerHTML = css; document.head && document.head.appendChild(s);
  var m = document.querySelector('meta[name=viewport]');
  if(!m){ m = document.createElement('meta'); m.name='viewport'; document.head && document.head.appendChild(m); }
  m.content = 'width=device-width, initial-scale=1, maximum-scale=1';
})(); true;`;

function LiveStream({ url, onError }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: COLORS.inkDeep }}
      containerStyle={{ backgroundColor: COLORS.inkDeep }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      injectedJavaScript={FIT_JS}
      injectedJavaScriptBeforeContentLoaded={FIT_JS}
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      bounces={false}
      originWhitelist={["*"]}
      mixedContentMode="always"
      androidLayerType="hardware"
      onError={onError}
      onHttpError={onError}
    />
  );
}

/**
 * Shows the TinyFish cloud browser LIVE inside the app (streaming_url),
 * plus a step-by-step timeline of what the agent is doing.
 */
export default function AgentLiveView({ streamingUrl, steps = [], status, elapsedMs = 0, siteName, demo }) {
  const scan = useRef(new Animated.Value(0)).current;
  const [webError, setWebError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

  useEffect(() => setWebError(false), [streamingUrl]);

  const secs = Math.floor(elapsedMs / 1000);
  const running = !["COMPLETED", "FAILED", "CANCELLED", "FALLBACK"].includes(status);
  // keep the live browser on screen for a few seconds after the agent finishes,
  // so a fast run (PM-KISAN finished in 24 s) is still seen by the citizen
  const [grace, setGrace] = useState(false);
  useEffect(() => {
    if (running) return setGrace(false);
    if (!streamingUrl) return;
    setGrace(true);
    const id = setTimeout(() => setGrace(false), 10000);
    return () => clearTimeout(id);
  }, [running, streamingUrl]);
  const showStream = streamingUrl && !webError && (running || grace);
  // 16:10 frame (desktop browser shape) so the page is not squashed
  const frameH = Math.round((width - 40) * 0.62);

  const last = steps.slice(-3);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // finished and the stream is gone: one quiet summary line instead of an empty frame
  if (!running && !showStream) {
    return (
      <View style={styles.doneRow}>
        <View style={styles.doneIcon}>
          <Feather name="check" size={14} color={COLORS.onAccent} />
        </View>
        <Text style={styles.doneText} numberOfLines={1}>
          {t("stepDone")}
          {siteName ? ` · ${siteName}` : ""}
        </Text>
        <Text style={styles.doneMeta}>
          {steps.length ? `${steps.length} steps · ` : ""}
          {fmt(secs)}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.frame}>
        <View style={styles.frameBar}>
          <Feather name="lock" size={12} color={COLORS.ink400} />
          <Text style={styles.urlText} numberOfLines={1}>
            {siteName || "official website"}
          </Text>
          {running ? (
            <View style={styles.liveBadge}>
              <LiveDot color="#fff" size={6} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          ) : (
            <View style={[styles.liveBadge, { backgroundColor: COLORS.teal }]}>
              <Feather name="check" size={11} color="#fff" />
            </View>
          )}
        </View>

        <View style={[styles.screen, { height: frameH }]}>
          {showStream ? (
            <>
              <LiveStream url={streamingUrl} onError={() => setWebError(true)} />
              <Pressable style={styles.expandBtn} onPress={() => setExpanded(true)}>
                <Feather name="maximize-2" size={15} color="#fff" />
              </Pressable>
            </>
          ) : (
            <View style={styles.placeholder}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.placeholderText}>{demo ? "Demo mode" : t("workingTitle")}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.timeline}>
        <View style={styles.timelineHead}>
          <Text style={styles.timelineTitle}>{t("stepBrowse")}</Text>
          <Text style={styles.timer}>{fmt(secs)}</Text>
        </View>
        {last.map((s, i, arr) => {
          const isLast = i === arr.length - 1;
          return (
            <View key={`${steps.length - arr.length + i}-${s.action}`} style={styles.stepRow}>
              {isLast && running ? <ActivityIndicator size="small" color={COLORS.ink} style={{ width: 16 }} /> : <Feather name="check" size={15} color={COLORS.teal} style={{ width: 16 }} />}
              <Text style={[styles.stepText, isLast && running && { color: COLORS.ink }]} numberOfLines={1}>
                {s.action}
              </Text>
            </View>
          );
        })}
      </View>

      <Modal visible={expanded && !!showStream} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalFrame, { height: Math.min(height * 0.8, width * 1.6) }]}>
            <View style={styles.frameBar}>
              <LiveDot color="#E5484D" size={7} />
              <Text style={styles.urlText} numberOfLines={1}>
                {siteName}
              </Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={10}>
                <Feather name="x" size={20} color={COLORS.ink} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>{showStream && <LiveStream url={streamingUrl} onError={() => setWebError(true)} />}</View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  frame: { borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: COLORS.hero, borderWidth: 1, borderColor: COLORS.border },
  frameBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.surface, gap: 8 },
  urlText: { flex: 1, fontFamily: FONT.semibold, color: COLORS.ink600, fontSize: 12.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#E5484D", borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveBadgeText: { fontFamily: FONT.bold, color: "#fff", fontSize: 10, letterSpacing: 1 },
  screen: { backgroundColor: COLORS.hero },
  expandBtn: { position: "absolute", right: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  placeholderText: { fontFamily: FONT.medium, color: "#BDBDC4", fontSize: 13.5 },
  timeline: { marginTop: 12, paddingHorizontal: 2 },
  timelineHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  timelineTitle: { fontFamily: FONT.bold, color: COLORS.ink, fontSize: 14 },
  timer: { fontFamily: FONT.semibold, color: COLORS.ink400, fontSize: 13 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  stepText: { flex: 1, fontFamily: FONT.medium, color: COLORS.ink400, fontSize: 13.5 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12 },
  doneIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.teal, alignItems: "center", justifyContent: "center" },
  doneText: { flex: 1, fontFamily: FONT.semibold, color: COLORS.ink, fontSize: 14 },
  doneMeta: { fontFamily: FONT.medium, color: COLORS.ink400, fontSize: 12.5 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", paddingHorizontal: 10 },
  modalFrame: { borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: COLORS.hero },
}));
