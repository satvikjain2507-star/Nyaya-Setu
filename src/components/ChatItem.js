import React from "react";
import ChatBubble from "./ChatBubble";
import LiveCard, { LiveWorking } from "./LiveCard";

/**
 * Renders any chat message: normal bubbles, TinyFish "working" cards,
 * and TinyFish live result cards.
 */
export default function ChatItem({ item, accentColor, actions }) {
  if (item.kind === "live") return <LiveCard data={item.data} />;
  if (item.kind === "liveLoading") return <LiveWorking lines={item.lines || ["Checking live…"]} />;
  if (item.kind === "liveError") return <ChatBubble role="bot" text={item.text} accentColor="#B42318" />;
  return <ChatBubble role={item.role} text={item.text} loading={item.loading} accentColor={accentColor} actions={actions} />;
}

/**
 * Shared helper: runs a TinyFish live check for a bot message and inserts the
 * result card right below it.
 *
 *   task(question, answer) → Promise<liveData>
 */
export async function runLiveCheckForMessage({ messages, item, setMessages, persist, task, lines, onResult }) {
  const idx = messages.findIndex((m) => m.id === item.id);
  const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user")?.text || "";
  const loadingId = `${item.id}-live-${Date.now()}`;

  const insertAfter = (list, afterId, msg) => {
    const i = list.findIndex((m) => m.id === afterId);
    const next = [...list];
    next.splice(i + 1, 0, msg);
    return next;
  };

  setMessages((prev) =>
    insertAfter(
      prev.map((m) => (m.id === item.id ? { ...m, liveChecked: true } : m)),
      item.id,
      { id: loadingId, kind: "liveLoading", loading: true, lines }
    )
  );

  let replacement;
  let failed = false;
  try {
    const data = await task(question, item.text);
    replacement = { id: loadingId, kind: "live", role: "bot", data };
    onResult?.(data);
  } catch (e) {
    failed = true;
    replacement = { id: loadingId, kind: "liveError", role: "bot", text: "⚠️ The live check couldn't finish (slow network or busy service). Tap the button again in a moment." };
  }

  setMessages((prev) => {
    const next = prev.map((m) =>
      m.id === loadingId ? replacement : failed && m.id === item.id ? { ...m, liveChecked: false } : m
    );
    persist(next);
    return next;
  });
}
