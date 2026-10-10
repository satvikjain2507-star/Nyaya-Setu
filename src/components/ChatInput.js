import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";

export default function ChatInput({ onSend, onMicPress, onImagePress, isRecording, placeholder, sendLabel }) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <View style={styles.container}>
      {onImagePress && (
        <TouchableOpacity style={styles.iconBtn} onPress={onImagePress}>
          <Text style={styles.iconText}>📷</Text>
        </TouchableOpacity>
      )}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder || "Type your message..."}
        placeholderTextColor={COLORS.midGray}
        multiline
      />
      {onMicPress && (
        <TouchableOpacity
          style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
          onPress={onMicPress}
        >
          <Text style={styles.iconText}>{isRecording ? "●" : "🎤"}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
        <Text style={styles.sendText}>{sendLabel || "Send"}</Text>
      </TouchableOpacity>
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
    maxHeight: 100,
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
  iconBtnRecording: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
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
