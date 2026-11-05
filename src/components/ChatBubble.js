import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { COLORS, RADIUS, SPACING, FONT, themed } from "../constants/theme";
import { cleanForDisplay } from "../utils/language";

export default function ChatBubble({ role, text, loading, accentColor, actions }) {
  const isUser = role === "user";
  return (
    <View>
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: COLORS.ink, borderBottomRightRadius: 6 }
            : { backgroundColor: COLORS.surface, borderBottomLeftRadius: 6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isUser ? COLORS.white : COLORS.ink} />
        ) : (
          <Text style={[styles.text, { color: isUser ? COLORS.white : COLORS.ink }]}>
            {isUser ? text : cleanForDisplay(text)}
          </Text>
        )}
      </View>
    </View>
    {!isUser && !loading && actions?.length > 0 && (
      <View style={styles.actions}>
        {actions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress} disabled={a.disabled}>
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 5, paddingHorizontal: 16 },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  bubble: { maxWidth: "84%", borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16 },
  text: { fontFamily: FONT.regular, fontSize: 15.5, lineHeight: 23 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginTop: 4, marginBottom: 6 },
  actionBtn: { backgroundColor: COLORS.bg, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontFamily: FONT.bold, color: COLORS.ink, fontSize: 13 },
}));
