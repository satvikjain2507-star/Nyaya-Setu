import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { COLORS, RADIUS, SPACING } from "../constants/theme";

const OPTIONS = [
  { key: "camera", icon: "📷", title: "Take a photo", sub: "Use the camera now" },
  { key: "gallery", icon: "🖼️", title: "Choose from gallery", sub: "Photos, screenshots, WhatsApp images" },
  { key: "file", icon: "📄", title: "Upload a PDF or file", sub: "From Downloads, WhatsApp or Files" },
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
              <Text style={styles.icon}>{o.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{o.title}</Text>
              <Text style={styles.rowSub}>{o.sub}</Text>
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22,13,25,0.45)" },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg, paddingBottom: SPACING.xl + 8 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.ink900, marginBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldSoft, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 20 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: COLORS.ink900 },
  rowSub: { fontSize: 12.5, color: COLORS.midGray, marginTop: 2 },
  cancel: { marginTop: SPACING.md, alignItems: "center", paddingVertical: SPACING.sm },
  cancelText: { color: COLORS.rose, fontWeight: "700", fontSize: 14.5 },
});
