import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
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
            ? { backgroundColor: COLORS.ink, borderBottomRightRadius: RADIUS.sm }
            : {
                backgroundColor: COLORS.white,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderLeftWidth: 4,
                borderLeftColor: accentColor || COLORS.gold,
                borderBottomLeftRadius: RADIUS.sm,
              },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isUser ? COLORS.white : COLORS.gold} />
        ) : (
          <Text style={[styles.text, { color: isUser ? COLORS.white : COLORS.darkGray }]}>
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: SPACING.xs + 2, paddingHorizontal: SPACING.md },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "82%",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md - 2,
    paddingHorizontal: SPACING.lg - 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  text: { fontSize: 14.5, lineHeight: 21 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: SPACING.md + 4, marginTop: 2, marginBottom: 4 },
  actionBtn: {
    backgroundColor: COLORS.tealSoft,
    borderColor: COLORS.teal,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { color: COLORS.teal, fontWeight: "700", fontSize: 12.5 },
});
