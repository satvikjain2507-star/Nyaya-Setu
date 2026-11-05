import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { COLORS, RADIUS, SPACING, FONT, themed } from "../constants/theme";
import { Feather } from "@expo/vector-icons";

const OPTIONS = [
  { key: "camera", icon: "camera", title: "Take a photo" },
  { key: "gallery", icon: "image", title: "Choose from gallery" },
  { key: "file", icon: "file", title: "Upload a PDF or file" },
];

/** Bottom sheet: camera · gallery · PDF/file. */
export default function AttachSheet({ visible, onClose, onPick, title = "Add a photo or document" }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={styles.row}
            activeOpacity={0.85}
            onPress={() => {
              onClose();
              setTimeout(() => onPick(o.key), 250);
            }}
          >
            <View style={styles.iconWrap}>
              <Feather name={o.icon} size={20} color={COLORS.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{o.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg, paddingBottom: SPACING.xl + 8 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  title: { fontFamily: FONT.extrabold, fontSize: 18, color: COLORS.ink900, marginBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  icon: { fontFamily: FONT.regular, fontSize: 20 },
  rowTitle: { fontFamily: FONT.bold, fontSize: 15, color: COLORS.ink900 },
  rowSub: { fontFamily: FONT.regular, fontSize: 12.5, color: COLORS.midGray, marginTop: 2 },
  cancel: { marginTop: SPACING.md, alignItems: "center", paddingVertical: SPACING.sm },
  cancelText: { fontFamily: FONT.bold, color: COLORS.ink, fontSize: 15 },
}));
