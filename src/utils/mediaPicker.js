/**
 * One place to get a photo / image / PDF from the user:
 *   "camera"  → take a photo now
 *   "gallery" → pick an image (screenshots, photos) from the phone
 *   "file"    → pick a PDF or image file from storage / Downloads / WhatsApp
 * Always returns { base64, mimeType, uri, name, kind } or null if cancelled.
 * Gemini reads images and PDFs directly, so no OCR step is needed.
 */
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

const MAX_BYTES = 15 * 1024 * 1024; // keeps the request under Gemini's inline limit

export async function pickMedia(source) {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission is needed to take a photo.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (r.canceled) return null;
    const a = r.assets[0];
    return { base64: a.base64, mimeType: "image/jpeg", uri: a.uri, name: "Photo", kind: "image" };
  }

  if (source === "gallery") {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
    if (r.canceled) return null;
    const a = r.assets[0];
    return { base64: a.base64, mimeType: a.mimeType || "image/jpeg", uri: a.uri, name: a.fileName || "Image", kind: "image" };
  }

  // "file": PDF or image from storage
  const r = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  if (a.size && a.size > MAX_BYTES) throw new Error("This file is too large. Please choose a file under 15 MB.");
  const name = a.name || "Document";
  const lower = name.toLowerCase();
  const mimeType =
    a.mimeType ||
    (lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".png") ? "image/png" : lower.endsWith(".txt") ? "text/plain" : "image/jpeg");
  const base64 = await new File(a.uri).base64();
  const kind = mimeType === "application/pdf" ? "pdf" : mimeType.startsWith("image") ? "image" : "file";
  return { base64, mimeType, uri: a.uri, name, kind };
}

/** Short label for the chat bubble, e.g. "📄 notice.pdf" or "🖼️ Image". */
export function mediaLabel(m) {
  if (!m) return "";
  if (m.kind === "pdf") return `📄 ${m.name}`;
  if (m.name === "Photo") return "📷 Photo";
  return `🖼️ ${m.name}`;
}
