import React, { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLORS, FONT, RADIUS, themed } from "../constants/theme";
import AttachSheet from "./AttachSheet";

/**
 * Chat input bar.
 *  - onAttach(source)  → paperclip with a sheet: camera / gallery / PDF-file
 *  - onImagePress()    → single camera button
 *  - onMicPress        → voice
 *  - allowEmptySend    → Send works with an empty box (e.g. "explain this photo")
 */
export default function ChatInput({ onSend, onMicPress, onImagePress, onAttach, isRecording, placeholder, allowEmptySend, attachTitle }) {
  const [value, setValue] = useState("");
  const [sheet, setSheet] = useState(false);
  const canSend = !!value.trim() || allowEmptySend;

  const handleSend = () => {
    if (!value.trim() && !allowEmptySend) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        {onAttach ? (
          <Pressable style={styles.iconBtn} onPress={() => setSheet(true)} accessibilityLabel="Attach photo or document" hitSlop={6}>
            <Feather name="paperclip" size={20} color={COLORS.ink600} />
          </Pressable>
        ) : onImagePress ? (
          <Pressable style={styles.iconBtn} onPress={onImagePress} hitSlop={6}>
            <Feather name="camera" size={20} color={COLORS.ink600} />
          </Pressable>
        ) : (
          <View style={{ width: 12 }} />
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder || "Type your message..."}
          placeholderTextColor={COLORS.faint}
          multiline
        />
        {onMicPress && !value.trim() && (
          <Pressable style={[styles.iconBtn, isRecording && styles.recording]} onPress={onMicPress} accessibilityLabel="Speak" hitSlop={6}>
            <Feather name={isRecording ? "square" : "mic"} size={20} color={isRecording ? COLORS.onAccent : COLORS.ink600} />
          </Pressable>
        )}
      </View>
      <Pressable style={[styles.sendBtn, !canSend && { backgroundColor: COLORS.surfaceAlt }]} onPress={handleSend} accessibilityLabel="Send">
        <Feather name="arrow-up" size={21} color={canSend ? COLORS.white : COLORS.faint} />
      </Pressable>
      {onAttach && <AttachSheet visible={sheet} onClose={() => setSheet(false)} onPick={onAttach} title={attachTitle} />}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border },
  field: { flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: COLORS.surface, borderRadius: 24, minHeight: 48, paddingHorizontal: 4 },
  input: { flex: 1, maxHeight: 120, fontFamily: FONT.medium, fontSize: 15.5, color: COLORS.ink, paddingHorizontal: 6, paddingTop: 13, paddingBottom: 13 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  recording: { backgroundColor: COLORS.rose },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center" },
}));
