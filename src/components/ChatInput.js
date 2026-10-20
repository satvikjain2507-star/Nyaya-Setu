import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import AttachSheet from "./AttachSheet";

/**
 * Chat input bar.
 *  - onAttach(source)  → shows 📎 with a sheet: camera / gallery / PDF-file
 *  - onImagePress()    → legacy single camera button (still supported)
 *  - onMicPress        → 🎤 voice
 *  - allowEmptySend    → Send works with an empty box (e.g. "explain this photo")
 */
export default function ChatInput({ onSend, onMicPress, onImagePress, onAttach, isRecording, placeholder, sendLabel, allowEmptySend, attachTitle }) {
  const [value, setValue] = useState("");
  const [sheet, setSheet] = useState(false);

  const handleSend = () => {
    if (!value.trim() && !allowEmptySend) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <View style={styles.container}>
      {onAttach ? (
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet(true)} accessibilityLabel="Attach photo or document">
          <Text style={styles.iconText}>📎</Text>
        </TouchableOpacity>
      ) : onImagePress ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onImagePress}>
          <Text style={styles.iconText}>📷</Text>
        </TouchableOpacity>
      ) : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder || "Type your message..."}
        placeholderTextColor={COLORS.midGray}
        multiline
      />
      {onMicPress && (
        <TouchableOpacity style={[styles.iconBtn, isRecording && styles.iconBtnRecording]} onPress={onMicPress}>
          <Text style={styles.iconText}>{isRecording ? "■" : "🎤"}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
        <Text style={styles.sendText}>{sendLabel || "Send"}</Text>
      </TouchableOpacity>
      {onAttach && <AttachSheet visible={sheet} onClose={() => setSheet(false)} onPick={onAttach} title={attachTitle} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    backgroundColor: COLORS.parchment,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg - 2,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs + 2,
    fontSize: 14.5,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.parchment,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtnRecording: { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  iconText: { fontSize: 18 },
  sendBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md - 2,
    marginLeft: SPACING.xs,
    shadowColor: COLORS.goldDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  sendText: { color: COLORS.white, fontWeight: "bold", fontSize: 13.5 },
});
