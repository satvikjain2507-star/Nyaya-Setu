/**
 * Central text-to-speech controller.
 * Every screen speaks through here so a single "Stop" button can stop any reply,
 * and the UI always knows whether the app is currently speaking.
 */
import * as Speech from "expo-speech";
import { cleanForSpeech } from "./language";
import { getSpeechLocale } from "./speechLocale";

let speaking = false;
const listeners = new Set();
const set = (v) => {
  speaking = v;
  listeners.forEach((fn) => fn(v));
};

export function isSpeaking() {
  return speaking;
}

export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Speak text in the given app language (e.g. "Hindi"). Stops anything already playing. */
export function speak(text, languageName = "English", rate = 1.0) {
  const clean = cleanForSpeech(text);
  Speech.stop();
  if (!clean) return set(false);
  set(true);
  Speech.speak(clean, {
    language: getSpeechLocale(languageName),
    rate,
    onDone: () => set(false),
    onStopped: () => set(false),
    onError: () => set(false),
  });
}

export function stopSpeaking() {
  Speech.stop();
  set(false);
}
