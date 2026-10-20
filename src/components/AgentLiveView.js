import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing, TouchableOpacity, Modal, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { LiveDot } from "./LiveCard";

// Makes TinyFish's live stream page fill the frame (it is designed for a desktop iframe).
const FIT_JS = `
(function(){
  var css = 'html,body{margin:0!important;padding:0!important;background:#160D19!important;overflow:hidden!important;height:100%!important;width:100%!important}' +
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
  const showStream = streamingUrl && !webError && running;
  // 16:10 frame (desktop browser shape) so the page is not squashed
  const frameH = Math.round((width - SPACING.lg * 2) * 0.62);

  return (
    <View>
      <View style={styles.frame}>
        <View style={styles.frameBar}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: "#FF5F57" }]} />
            <View style={[styles.dot, { backgroundColor: "#FEBC2E" }]} />
            <View style={[styles.dot, { backgroundColor: "#28C840" }]} />
          </View>
          <Text style={styles.urlText} numberOfLines={1}>
            🔒 {siteName || "official website"}
          </Text>
          {running && (
            <View style={styles.liveBadge}>
              <LiveDot color="#fff" size={6} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={[styles.screen, { height: frameH }]}>
          {showStream ? (
            <>
              <LiveStream url={streamingUrl} onError={() => setWebError(true)} />
              <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(true)} activeOpacity={0.8}>
                <Text style={styles.expandText}>⤢  Enlarge</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Placeholder
              scan={scan}
              text={
                !running
                  ? status === "FALLBACK"
                    ? "Answer ready from official government pages ✓"
                    : "Done on the official website ✓"
                  : demo
                  ? "Demo mode — add your TinyFish key to watch the real browser"
                  : streamingUrl && webError
                  ? "Live view unavailable — the agent is still working"
                  : "Opening the official website in a secure cloud browser…"
              }
            />
          )}
        </View>
      </View>

      <View style={styles.timeline}>
        <View style={styles.timelineHead}>
          <Text style={styles.timelineTitle}>What the agent is doing{steps.length ? ` · step ${steps.length}` : ""}</Text>
          <Text style={styles.timer}>⏱ {secs}s{running ? " · usually 40–60 s" : ""}</Text>
        </View>
        {steps.length === 0 && running && (
          <View style={styles.stepRow}>
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.stepText}>Starting a secure cloud browser (takes ~20 s)…</Text>
          </View>
        )}
        {steps.slice(-6).map((s, i, arr) => {
          const isLast = i === arr.length - 1;
          return (
            <View key={`${i}-${s.action}`} style={styles.stepRow}>
              {isLast && running ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Text style={styles.check}>✓</Text>}
              <Text style={[styles.stepText, isLast && running && { color: COLORS.ink900, fontWeight: "600" }]} numberOfLines={2}>
                {s.action}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Enlarged live view */}
      <Modal visible={expanded && !!showStream} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalFrame, { height: Math.min(height * 0.8, width * 1.6) }]}>
            <View style={styles.frameBar}>
              <LiveDot color="#E5484D" size={7} />
              <Text style={[styles.urlText, { marginLeft: 6 }]} numberOfLines={1}>
                {siteName}
              </Text>
              <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>{showStream && <LiveStream url={streamingUrl} onError={() => setWebError(true)} />}</View>
          </View>
          <Text style={styles.modalHint}>Live view of the official website — the AI is browsing for you</Text>
        </View>
      </Modal>
    </View>
  );
}

function Placeholder({ text, scan }) {
  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  return (
    <View style={styles.placeholder}>
      <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
      <Text style={styles.fish}>🐟</Text>
      <Text style={styles.placeholderText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.inkDeep, borderWidth: 1, borderColor: COLORS.inkSoft },
  frameBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: COLORS.ink, gap: SPACING.sm },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  urlText: { flex: 1, color: "#D9CFE0", fontSize: 12, backgroundColor: COLORS.inkSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E5484D", borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  liveBadgeText: { color: "#fff", fontWeight: "900", fontSize: 10, letterSpacing: 0.8 },
  screen: { backgroundColor: COLORS.inkDeep },
  expandBtn: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  expandText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingHorizontal: SPACING.lg },
  scanLine: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS.gold, opacity: 0.6 },
  fish: { fontSize: 34 },
  placeholderText: { color: "#D9CFE0", marginTop: SPACING.sm, fontSize: 13, textAlign: "center" },
  timeline: { marginTop: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  timelineHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  timelineTitle: { fontWeight: "800", color: COLORS.ink, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 },
  timer: { color: COLORS.midGray, fontSize: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 5 },
  check: { color: COLORS.teal, fontWeight: "900", width: 20, textAlign: "center" },
  stepText: { flex: 1, color: COLORS.darkGray, fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: "rgba(10,6,12,0.92)", justifyContent: "center", paddingHorizontal: 10 },
  modalFrame: { borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.inkDeep },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  closeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalHint: { color: "#D9CFE0", textAlign: "center", marginTop: 12, fontSize: 12.5 },
});
