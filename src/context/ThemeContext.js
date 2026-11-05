import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyThemeMode } from "../constants/theme";

const KEY = "nyaya_setu_theme"; // "system" | "light" | "dark"
const ThemeContext = createContext({ mode: "system", isDark: false, setMode: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((m) => setModeState(m === "light" || m === "dark" ? m : "system"))
      .catch(() => setModeState("system"));
  }, []);

  const setMode = (m) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };

  if (!mode) return null;
  const isDark = mode === "dark" || (mode === "system" && system === "dark");
  applyThemeMode(isDark); // swaps COLORS before anything below renders

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {/* remount the tree on a switch so every screen re-reads the new colours */}
      <React.Fragment key={isDark ? "dark" : "light"}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
