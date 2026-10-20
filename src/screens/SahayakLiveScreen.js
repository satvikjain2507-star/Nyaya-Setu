/**
 * SAHAYAK LIVE — the citizen speaks a task in any Indian language, and an AI
 * agent (TinyFish) opens the OFFICIAL government website and does the work
 * live, while the citizen watches. Gemini plans the task and explains the
 * result back in the citizen's language, read aloud.
 */
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from "react-native";
import KeyboardAware from "../components/KeyboardAware";
import { useVoiceRecorder } from "../utils/voiceRecorder";
import ChatInput from "../components/ChatInput";
import AgentLiveView from "../components/AgentLiveView";
import { LiveDot, SourceChips, openLink } from "../components/LiveCard";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { speak, stopSpeaking } from "../utils/speaker";
import StopSpeaking from "../components/StopSpeaking";
import { useLanguage } from "../context/LanguageContext";
import { runSahayakTask } from "../services/liveIntel";
import { geminiTranscribe } from "../services/geminiApi";
import { hasTinyFishKey } from "../services/tinyfishApi";

const SUGGESTIONS = [
  { icon: "🌾", text: "Am I eligible for PM-KISAN? What documents do I need?" },
  { icon: "🏥", text: "How can my 72-year-old father get an Ayushman card?" },
  { icon: "🎓", text: "Scholarships for a girl student in class 11 from a poor family" },
  { icon: "📱", text: "My phone was stolen today. How do I block it?" },
  { icon: "🚨", text: "How do I report a UPI fraud online?" },
  { icon: "📄", text: "How to file an RTI application online" },
  { icon: "🛂", text: "How do I apply for a passport?" },
];

export default function SahayakLiveScreen() {
  const { t, geminiLanguageName, speechRate } = useLanguage();
  // stop any reply being read aloud when the user leaves this screen
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState("idle"); // idle | planning | running | done | error
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState(null);
  const [live, setLive] = useState({ status: "PENDING", steps: [], streamingUrl: null, elapsed: 0 });
  const [result, setResult] = useState(null);
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
          setError("Couldn't understand the voice note (AI busy or no internet). Please tap 🎤 and speak again, or type your task.");
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

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { paddingTop: insets.top, backgroundColor: COLORS.ink }]}>
      <KeyboardAware>
      <ScrollView ref={scrollRef} style={{ backgroundColor: COLORS.parchment }} contentContainerStyle={{ paddingBottom: SPACING.xl }} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              <LiveDot color="#E5484D" />
              <Text style={styles.badgeText}>LIVE AGENT</Text>
            </View>
            <Text style={styles.powered}>powered by TinyFish{hasTinyFishKey() ? "" : " · demo"}</Text>
          </View>
          <Text style={styles.heroTitle}>{t("sahayakLive")}</Text>
          <Text style={styles.heroSub}>{t("sahayakLiveHero")}</Text>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.lg }}>
          {/* Idle: suggestions */}
          {(phase === "idle" || phase === "error") && (
            <>
              {phase === "error" && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                  <TouchableOpacity onPress={() => (request && !/^🎤/.test(request) ? start(request) : handleMicPress())}>
                    <Text style={styles.retry}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.sectionTitle}>{t("tryAsking")}</Text>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s.text} style={styles.suggestion} onPress={() => start(s.text)} activeOpacity={0.85}>
                  <Text style={styles.suggestionIcon}>{s.icon}</Text>
                  <Text style={styles.suggestionText}>{s.text}</Text>
                  <Text style={styles.go}>›</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.howItWorks}>{t("sahayakHow")}</Text>
            </>
          )}

          {/* Working / done */}
          {phase !== "idle" && phase !== "error" && (
            <>
              <View style={styles.taskCard}>
                <Text style={styles.taskLabel}>{t("yourTask")}</Text>
                <Text style={styles.taskText}>{request}</Text>
                {plan ? (
                  <Text style={styles.planText}>
                    🌐 {plan.siteName} · <Text style={{ color: COLORS.teal }}>{plan.url}</Text>
                  </Text>
                ) : (
                  <Text style={styles.planText}>🧠 Planning the best official website…</Text>
                )}
              </View>

              {phase === "running" && (
                <>
                <AgentLiveView
                  streamingUrl={live.streamingUrl}
                  steps={live.steps}
                  status={live.status}
                  elapsedMs={live.elapsed}
                  siteName={plan?.siteName ? `${plan.siteName} — ${plan.url?.replace(/^https?:\/\//, "")}` : ""}
                  demo={!hasTinyFishKey()}
                />
                  {result && <View style={{ height: SPACING.md }} />}
                </>
              )}
              {result && (phase === "done" || phase === "running" || phase === "planning") && (
                <View style={styles.resultCard}>
                  <View style={styles.resultHead}>
                    <Text style={styles.resultBadge}>
                      {phase !== "done" && result.mode === "instant" ? "🧠 Instant answer · TinyFish agent is now opening the official website to verify it live…" : phase === "running" ? `⚡ ${t("quickAnswer")} · live browser is double-checking on ${plan?.siteName || "the official site"}…` : result.mode === "agent" ? `✅ Verified live on ${plan?.siteName || "the official website"}` : "✅ Read live from official government pages"}
                    </Text>
                    <TouchableOpacity onPress={() => say(result.answer)}>
                      <Text style={styles.speaker}>🔊</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.answer}>{result.answer}</Text>

                  {result.eligibility?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>✅ {t("whoCanApply")}</Text>
                      {result.eligibility.map((f, i) => (
                        <Text key={i} style={styles.item}>• {f}</Text>
                      ))}
                    </View>
                  )}
                  {result.documents?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>📄 {t("documentsNeeded")}</Text>
                      {result.documents.map((f, i) => (
                        <Text key={i} style={styles.item}>☐ {f}</Text>
                      ))}
                    </View>
                  )}
                  {result.keyFacts?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>{t("keyFacts")}</Text>
                      {result.keyFacts.map((f, i) => (
                        <Text key={i} style={styles.item}>• {f}</Text>
                      ))}
                    </View>
                  )}
                  {result.nextSteps?.length > 0 && (
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>{t("nextSteps")}</Text>
                      {result.nextSteps.map((f, i) => (
                        <Text key={i} style={styles.item}>{i + 1}. {f}</Text>
                      ))}
                    </View>
                  )}
                  {!!result.officialLink && (
                    <TouchableOpacity style={styles.officialBtn} onPress={() => openLink(result.officialLink)}>
                      <Text style={styles.officialText}>Open official website ↗</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() =>
                      Share.share({
                        message: `${request}\n\n${result.answer}${result.documents?.length ? `\n\nDocuments needed:\n${result.documents.map((x) => `• ${x}`).join("\n")}` : ""}${result.nextSteps?.length ? `\n\nNext steps:\n${result.nextSteps.map((x, i) => `${i + 1}. ${x}`).join("\n")}` : ""}${result.officialLink ? `\n\nOfficial link: ${result.officialLink}` : ""}\n\n— verified live with Nyaya Setu`,
                      }).catch(() => {})
                    }
                  >
                    <Text style={styles.shareText}>📤 Share on WhatsApp</Text>
                  </TouchableOpacity>
                  <SourceChips sources={result.sources} />
                  {result.demo && <Text style={styles.demo}>Demo mode — add your TinyFish key in .env for real live runs.</Text>}
                </View>
              )}

              {phase === "done" && (
                <View style={{ marginTop: SPACING.sm }}>
                <AgentLiveView
                  streamingUrl={live.streamingUrl}
                  steps={live.steps}
                  status={live.status}
                  elapsedMs={live.elapsed}
                  siteName={plan?.siteName ? `${plan.siteName} — ${plan.url?.replace(/^https?:\/\//, "")}` : ""}
                  demo={!hasTinyFishKey()}
                />
                </View>
              )}

              {busy && (
                <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
                  <Text style={styles.cancelText}>{t("stop")}</Text>
                </TouchableOpacity>
              )}

              {phase === "done" && (
                <TouchableOpacity style={styles.newBtn} onPress={() => setPhase("idle")}>
                  <Text style={styles.newText}>＋ {t("newTask")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <StopSpeaking />
      <ChatInput
        onSend={start}
        onMicPress={busy ? undefined : handleMicPress}
        isRecording={isRecording}
        placeholder={t("sahayakPlaceholder")}
        sendLabel={t("go")}
      />
      </KeyboardAware>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.parchment },
  hero: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.inkSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: COLORS.white, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  powered: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  heroTitle: { color: COLORS.white, fontSize: 26, fontWeight: "800", marginTop: SPACING.md },
  heroSub: { color: "#D9CFE0", fontSize: 14, lineHeight: 20, marginTop: 6 },
  sectionTitle: { fontSize: 12.5, fontWeight: "800", color: COLORS.ink, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACING.sm },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionIcon: { fontSize: 22 },
  suggestionText: { flex: 1, fontSize: 14, color: COLORS.ink900 },
  go: { fontSize: 22, color: COLORS.gold, fontWeight: "800" },
  howItWorks: { fontSize: 12, color: COLORS.midGray, lineHeight: 18, marginTop: SPACING.md, textAlign: "center" },
  taskCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.gold },
  taskLabel: { fontSize: 11, fontWeight: "800", color: COLORS.goldDark, letterSpacing: 0.6, textTransform: "uppercase" },
  taskText: { fontSize: 15, fontWeight: "700", color: COLORS.ink900, marginTop: 2 },
  planText: { fontSize: 12.5, color: COLORS.darkGray, marginTop: 6 },
  cancelBtn: { alignSelf: "center", marginTop: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.rose },
  cancelText: { color: COLORS.rose, fontWeight: "700" },
  resultCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.teal },
  resultHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultBadge: { flex: 1, color: COLORS.teal, fontWeight: "800", fontSize: 12.5 },
  speaker: { fontSize: 22 },
  answer: { fontSize: 15, lineHeight: 23, color: COLORS.ink900, marginTop: SPACING.sm },
  block: { marginTop: SPACING.md, backgroundColor: COLORS.parchment, borderRadius: RADIUS.sm, padding: SPACING.md },
  blockTitle: { fontWeight: "800", color: COLORS.ink, fontSize: 12.5, marginBottom: 4 },
  item: { fontSize: 13.5, color: COLORS.darkGray, lineHeight: 20 },
  officialBtn: { marginTop: SPACING.md, backgroundColor: COLORS.ink, borderRadius: RADIUS.pill, paddingVertical: 11, alignItems: "center" },
  shareBtn: { marginTop: SPACING.sm, borderRadius: RADIUS.pill, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#25D366", backgroundColor: "#EAFBF0" },
  shareText: { color: "#128C4A", fontWeight: "800" },
  officialText: { color: COLORS.white, fontWeight: "700" },
  demo: { marginTop: SPACING.sm, fontSize: 11, color: COLORS.midGray },
  newBtn: { alignSelf: "center", marginTop: SPACING.lg, backgroundColor: COLORS.gold, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.xl, paddingVertical: 10 },
  newText: { color: COLORS.white, fontWeight: "800" },
  errorCard: { backgroundColor: "#FDECEC", borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  errorText: { color: "#B42318", fontSize: 13.5 },
  retry: { color: "#B42318", fontWeight: "800", marginTop: 6 },
});
