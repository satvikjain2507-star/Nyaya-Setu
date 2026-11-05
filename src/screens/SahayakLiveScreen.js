/**
 * SAHAYAK LIVE — the citizen speaks a task in any Indian language, and an AI
 * agent (TinyFish) opens the OFFICIAL government website and does the work
 * live, while the citizen watches. Gemini plans the task and explains the
 * result back in the citizen's language, read aloud.
 */
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import KeyboardAware from "../components/KeyboardAware";
import { useVoiceRecorder } from "../utils/voiceRecorder";
import ChatInput from "../components/ChatInput";
import AgentLiveView from "../components/AgentLiveView";
import PipelineStrip from "../components/PipelineStrip";
import { SourceChips, openLink } from "../components/LiveCard";
import { COLORS, FONT, RADIUS, SPACING, themed } from "../constants/theme";
import { speak, stopSpeaking } from "../utils/speaker";
import StopSpeaking from "../components/StopSpeaking";
import { useLanguage } from "../context/LanguageContext";
import { runSahayakTask } from "../services/liveIntel";
import { geminiTranscribe } from "../services/geminiApi";
import { hasTinyFishKey, hostnameOf } from "../services/tinyfishApi";

const SUGGESTIONS = [
  { icon: "sprout", text: "Am I eligible for PM-KISAN? What documents do I need?" },
  { icon: "cellphone-lock", text: "My phone was stolen today. How do I block it?" },
  { icon: "hospital-box-outline", text: "How can my 72-year-old father get an Ayushman card?" },
  { icon: "school-outline", text: "Scholarships for a girl student in class 11 from a poor family" },
  { icon: "alert-octagon-outline", text: "How do I report a UPI fraud online?" },
  { icon: "passport", text: "How do I apply for a passport?" },
];

function Tap({ style, children, onPress, disabled }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.72 }]}>
      {children}
    </Pressable>
  );
}

export default function SahayakLiveScreen({ route }) {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  // stop any reply being read aloud when the user leaves this screen
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState("idle"); // idle | planning | running | done | error
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState(null);
  const [live, setLive] = useState({ status: "PENDING", steps: [], streamingUrl: null, elapsed: 0 });
  const [result, setResult] = useState(null);
  const [stages, setStages] = useState({});
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const voice = useVoiceRecorder();
  const stopRef = useRef(false);
  const scrollRef = useRef(null);

  const finalRef = useRef(false);
  const hasAnswerRef = useRef(false); // an instant/quick answer is already on screen
  const spokeRef = useRef(false);
  const say = (text) => {
    spokeRef.current = true;
    speak(text, geminiLanguageName(), speechRate);
  };

  const start = async (text) => {
    // never run the "🎤 …" placeholder as a task (happened when "Try again" was tapped after a failed voice note)
    if (!text?.trim() || /^🎤/.test(text.trim()) || phase === "planning" || phase === "running") return;
    stopRef.current = false;
    finalRef.current = false;
    spokeRef.current = false;
    hasAnswerRef.current = false;
    stopSpeaking();
    setRequest(text);
    setPlan(null);
    setResult(null);
    setStages({});
    setError(null);
    setLive({ status: "PENDING", steps: [], streamingUrl: null, elapsed: 0 });
    setPhase("planning");

    try {
      const res = await runSahayakTask({
        request: text,
        language: geminiLanguageName(),
        onPlan: (p) => {
          setPlan(p);
          setPhase("running");
        },
        onUpdate: (u) =>
          setLive((prev) => ({
            ...prev,
            ...u,
            streamingUrl: u.streamingUrl || prev.streamingUrl,
            steps: u.steps || prev.steps,
            elapsed: u.elapsed ?? prev.elapsed,
          })),
        onInstant: (a) => {
          // instant spoken answer while the cloud browser starts
          if (finalRef.current || stopRef.current) return;
          hasAnswerRef.current = true;
          setResult((prev) => (prev && prev.mode !== "instant" ? prev : a));
          if (!spokeRef.current) say(a.answer);
        },
        onQuick: (q) => {
          // answer read from official pages — replaces the instant one on screen while the live agent keeps working
          if (finalRef.current || stopRef.current) return;
          hasAnswerRef.current = true;
          setResult(q);
          if (!spokeRef.current) say(q.answer);
        },
        onStage: (key, status, detail) => setStages((prev) => ({ ...prev, [key]: { status, detail } })),
        shouldStop: () => stopRef.current,
      });
      finalRef.current = true;

      if (res.cancelled) {
        setPhase("idle");
        return;
      }
      setResult(res);
      setLive((prev) => ({ ...prev, status: res.mode === "agent" ? "COMPLETED" : "FALLBACK" }));
      setPhase("done");
      if (!spokeRef.current) say(res.answer);
      // the citizen already heard the instant answer — now tell them what the official page confirmed or corrected
      else if (res.crossCheck?.note) say(res.crossCheck.note);
      // scroll up so the live browser (now right under the task) is on screen
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 300);
    } catch (e) {
      finalRef.current = true;
      // keep the answer the citizen already heard instead of replacing it with an error
      if (hasAnswerRef.current) {
        setLive((prev) => ({ ...prev, status: "FALLBACK" }));
        setPhase("done");
        return;
      }
      setError(e.message || "Something went wrong.");
      setPhase("error");
    }
  };

  const cancel = () => {
    stopRef.current = true;
    stopSpeaking();
  };

  const handleMicPress = async () => {
    if (!isRecording) {
      try {
        const ok = await voice.start();
        if (!ok) return Alert.alert("Microphone permission is needed for voice tasks.");
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    } else {
      setIsRecording(false);
      try {
        const base64 = await voice.stop();
        if (!base64) return;
        setPhase("planning");
        setRequest("🎤 …");
        const text = await geminiTranscribe(base64, "audio/m4a");
        setPhase("idle");
        if (!text?.trim()) {
          setRequest("");
          setError("Couldn't hear that clearly. Please try again, or type your task.");
          setPhase("error");
          return;
        }
        start(text);
      } catch (err) {
        console.error("Failed to process recording:", err);
        setPhase("idle");
      }
    }
  };

  const busy = phase === "planning" || phase === "running";

  // a task tapped on the Home screen
  const lastTs = useRef(null);
  useEffect(() => {
    const p = route?.params;
    if (p?.task && p.ts && p.ts !== lastTs.current) {
      lastTs.current = p.ts;
      start(p.task);
    }
  }, [route?.params?.ts]);

  const site = plan?.url ? hostnameOf(plan.url) : "";
  const doneSite = plan?.siteName || site;
  const status =
    phase === "done"
      ? result?.mode === "agent"
        ? { icon: "check-circle", color: COLORS.teal, text: `${t("ansVerified")} ${doneSite}` }
        : { icon: "check-circle", color: COLORS.teal, text: t("ansOfficial") }
      : { spin: true, color: COLORS.ink400, text: result?.mode === "instant" ? `${t("ansQuick")} · ${t("ansVerifying")}` : t("ansVerifying") };

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { paddingTop: insets.top }]}>
      <KeyboardAware>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("sahayakLive")}</Text>
            {(phase === "idle" || phase === "error") && <Text style={styles.sub}>{t("liveSub")}</Text>}
          </View>

          {(phase === "idle" || phase === "error") && (
            <View style={styles.pad}>
              {phase === "error" && (
                <View style={styles.errorCard}>
                  <Feather name="alert-circle" size={18} color={COLORS.rose} />
                  <Text style={styles.errorText}>{error}</Text>
                  <Tap onPress={() => (request && !/^🎤/.test(request) ? start(request) : handleMicPress())}>
                    <Text style={styles.retry}>{t("tryAgain")}</Text>
                  </Tap>
                </View>
              )}

              <Tap style={styles.bigMicWrap} onPress={handleMicPress}>
                <View style={[styles.bigMic, isRecording && { backgroundColor: COLORS.rose }]}>
                  <Feather name={isRecording ? "square" : "mic"} size={34} color={COLORS.white} />
                </View>
                <Text style={styles.bigMicText}>{isRecording ? t("listening") : t("tapToSpeak")}</Text>
              </Tap>

              <Text style={styles.section}>{t("popularTitle")}</Text>
              <View style={styles.list}>
                {SUGGESTIONS.map((s, i) => (
                  <Tap key={s.text} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => start(s.text)}>
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons name={s.icon} size={19} color={COLORS.ink} />
                    </View>
                    <Text style={styles.rowText}>{s.text}</Text>
                    <Feather name="arrow-up-right" size={18} color={COLORS.faint} />
                  </Tap>
                ))}
              </View>
            </View>
          )}

          {phase !== "idle" && phase !== "error" && (
            <View style={styles.pad}>
              <Text style={styles.request}>{request}</Text>
              {!!site && (
                <View style={styles.siteChip}>
                  <Feather name="lock" size={12} color={COLORS.teal} />
                  <Text style={styles.siteText}>{site}</Text>
                </View>
              )}

              {phase !== "done" && <PipelineStrip stages={stages} />}

              {phase === "running" && (
                <View style={{ marginTop: SPACING.md }}>
                  <AgentLiveView streamingUrl={live.streamingUrl} steps={live.steps} status={live.status} elapsedMs={live.elapsed} siteName={site} demo={!hasTinyFishKey()} />
                </View>
              )}
              {phase === "done" && (
                <View style={{ marginTop: SPACING.lg }}>
                  <AgentLiveView streamingUrl={live.streamingUrl} steps={live.steps} status={live.status} elapsedMs={live.elapsed} siteName={site} demo={!hasTinyFishKey()} />
                </View>
              )}

              {result && (
                <View style={styles.card}>
                  <View style={styles.statusRow}>
                    {status.spin ? <ActivityIndicator size="small" color={COLORS.ink400} /> : <Feather name={status.icon} size={17} color={status.color} />}
                    <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
                      {status.text}
                    </Text>
                    <Tap onPress={() => say(result.answer)} style={styles.iconBtn}>
                      <Feather name="volume-2" size={18} color={COLORS.ink} />
                    </Tap>
                  </View>

                  {result.crossCheck && phase === "done" && (
                    <View style={[styles.cross, result.crossCheck.status === "corrected" && { backgroundColor: COLORS.amberSoft }]}>
                      <Feather name={result.crossCheck.status === "corrected" ? "refresh-cw" : "check"} size={14} color={result.crossCheck.status === "corrected" ? COLORS.amber : COLORS.teal} />
                      <Text style={[styles.crossText, { color: result.crossCheck.status === "corrected" ? COLORS.amber : COLORS.teal }]}>
                        {result.crossCheck.status === "corrected" ? t("crossFix") : t("crossOk")}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.answer}>{result.answer}</Text>

                  {result.eligibility?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>{t("whoCanApply")}</Text>
                      {result.eligibility.map((f, i) => (
                        <View key={i} style={styles.item}>
                          <View style={styles.dot} />
                          <Text style={styles.itemText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {result.documents?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>{t("documentsNeeded")}</Text>
                      {result.documents.map((f, i) => (
                        <View key={i} style={styles.item}>
                          <Feather name="square" size={15} color={COLORS.ink400} style={{ marginTop: 3 }} />
                          <Text style={styles.itemText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {result.nextSteps?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>{t("nextSteps")}</Text>
                      {result.nextSteps.map((f, i) => (
                        <View key={i} style={styles.item}>
                          <Text style={styles.num}>{i + 1}</Text>
                          <Text style={styles.itemText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!result.officialLink && (
                    <Tap style={styles.primary} onPress={() => openLink(result.officialLink)}>
                      <Text style={styles.primaryText}>{t("openOfficial")}</Text>
                      <Feather name="arrow-up-right" size={18} color={COLORS.white} />
                    </Tap>
                  )}
                  <Tap
                    style={styles.secondary}
                    onPress={() =>
                      Share.share({
                        message: `${request}\n\n${result.answer}${result.documents?.length ? `\n\n${t("documentsNeeded")}:\n${result.documents.map((x) => `• ${x}`).join("\n")}` : ""}${result.officialLink ? `\n\n${result.officialLink}` : ""}\n\n— Nyaya Setu`,
                      }).catch(() => {})
                    }
                  >
                    <Feather name="share-2" size={16} color={COLORS.ink} />
                    <Text style={styles.secondaryText}>{t("share")}</Text>
                  </Tap>
                  <SourceChips sources={result.sources} />
                </View>
              )}

              {busy && (
                <Tap style={styles.stop} onPress={cancel}>
                  <View style={styles.stopSquare} />
                  <Text style={styles.stopText}>{t("stop").replace(/^■\s*/, "")}</Text>
                </Tap>
              )}
              {phase === "done" && (
                <Tap style={styles.newBtn} onPress={() => setPhase("idle")}>
                  <Feather name="plus" size={18} color={COLORS.white} />
                  <Text style={styles.newText}>{t("newTask")}</Text>
                </Tap>
              )}
            </View>
          )}
        </ScrollView>

        <StopSpeaking />
        <ChatInput onSend={start} onMicPress={busy ? undefined : handleMicPress} isRecording={isRecording} placeholder={t("sahayakPlaceholder")} sendLabel={t("go")} />
      </KeyboardAware>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: SPACING.lg },
  title: { fontFamily: FONT.extrabold, fontSize: 30, color: COLORS.ink, letterSpacing: -0.8 },
  sub: { fontFamily: FONT.medium, fontSize: 15, lineHeight: 21, color: COLORS.ink400, marginTop: 4 },
  pad: { paddingHorizontal: 20 },

  bigMicWrap: { alignItems: "center", paddingVertical: 28 },
  bigMic: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  bigMicText: { fontFamily: FONT.semibold, fontSize: 15, color: COLORS.ink, marginTop: 14 },

  section: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3, marginBottom: 10 },
  list: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: FONT.semibold, fontSize: 14.5, lineHeight: 20, color: COLORS.ink },

  request: { fontFamily: FONT.bold, fontSize: 21, lineHeight: 28, color: COLORS.ink, letterSpacing: -0.3, marginTop: SPACING.lg },
  siteChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: COLORS.tealSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  siteText: { fontFamily: FONT.semibold, fontSize: 12.5, color: COLORS.teal },

  card: { marginTop: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 18, backgroundColor: COLORS.bg },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { flex: 1, fontFamily: FONT.semibold, fontSize: 13.5 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  cross: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: COLORS.tealSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6, marginTop: 12 },
  crossText: { fontFamily: FONT.semibold, fontSize: 12.5 },
  answer: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 25, color: COLORS.ink, marginTop: 14 },
  block: { marginTop: 18 },
  blockTitle: { fontFamily: FONT.bold, fontSize: 15, color: COLORS.ink, marginBottom: 8 },
  item: { flexDirection: "row", gap: 10, marginBottom: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.ink, marginTop: 9 },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.surface, textAlign: "center", lineHeight: 22, fontFamily: FONT.bold, fontSize: 12, color: COLORS.ink, overflow: "hidden" },
  itemText: { flex: 1, fontFamily: FONT.regular, fontSize: 15, lineHeight: 22, color: COLORS.ink600 },
  primary: { marginTop: 20, height: 52, borderRadius: RADIUS.pill, backgroundColor: COLORS.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontFamily: FONT.bold, fontSize: 15, color: COLORS.white },
  secondary: { marginTop: 10, height: 48, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { fontFamily: FONT.bold, fontSize: 14.5, color: COLORS.ink },

  stop: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: SPACING.lg, paddingHorizontal: 22, height: 44, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  stopSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.rose },
  stopText: { fontFamily: FONT.semibold, fontSize: 14, color: COLORS.ink },
  newBtn: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: SPACING.lg, paddingHorizontal: 24, height: 50, borderRadius: RADIUS.pill, backgroundColor: COLORS.ink },
  newText: { fontFamily: FONT.bold, fontSize: 15, color: COLORS.white },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.roseSoft, borderRadius: RADIUS.md, padding: 14, marginTop: SPACING.lg },
  errorText: { flex: 1, fontFamily: FONT.medium, fontSize: 13.5, lineHeight: 19, color: COLORS.ink },
  retry: { fontFamily: FONT.bold, fontSize: 13.5, color: COLORS.rose },
}));
