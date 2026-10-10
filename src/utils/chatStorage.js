import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadMessages(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return fallback;
}

export async function saveMessages(key, messages) {
  try {
    // never persist a message currently mid-loading
    const toSave = messages.filter((m) => !m.loading);
    await AsyncStorage.setItem(key, JSON.stringify(toSave));
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
}

export async function clearMessages(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to clear chat history:", e);
  }
}
