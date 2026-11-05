/**
 * Nyaya Setu design system — light & dark.
 * Black + white base (CRED / Linear), one saffron accent, soft grey surfaces (Notion),
 * big bold type (Airbnb). In dark mode the base inverts; the "hero" surfaces stay dark.
 *
 * COLORS is one shared object whose values are swapped by applyThemeMode().
 * Style sheets are wrapped in themed(() => StyleSheet.create(...)) so they rebuild after a switch.
 */
const SHARED = {
  onHero: "#FFFFFF",
  onAccent: "#FFFFFF",
};

const LIGHT = {
  ...SHARED,
  ink: "#0B0B0C",
  inkDeep: "#000000",
  inkSoft: "#1C1C1F",
  white: "#FFFFFF",
  bg: "#FFFFFF",
  surface: "#F4F4F2",
  surfaceAlt: "#EDEDEA",
  border: "#EAEAE7",
  hero: "#0B0B0C",
  ink900: "#0B0B0C",
  ink600: "#3A3A40",
  ink400: "#71717A",
  faint: "#A1A1AA",
  gold: "#F2611D",
  goldDark: "#C94C12",
  goldSoft: "#FFF1E9",
  teal: "#0B8A5B",
  tealSoft: "#E8F5EE",
  rose: "#E0353B",
  roseSoft: "#FDEEEE",
  blue: "#2563EB",
  blueSoft: "#EBF1FE",
  violet: "#6E56CF",
  violetSoft: "#F1EEFC",
  amber: "#B7791F",
  amberSoft: "#FDF5E6",
};

const DARK = {
  ...SHARED,
  ink: "#F4F4F5",
  inkDeep: "#FFFFFF",
  inkSoft: "#E4E4E7",
  white: "#0B0B0C",
  bg: "#0B0B0C",
  surface: "#18181B",
  surfaceAlt: "#27272A",
  border: "#232327",
  hero: "#1C1C1F",
  ink900: "#F4F4F5",
  ink600: "#C9C9D0",
  ink400: "#8E8E96",
  faint: "#5E5E66",
  gold: "#FF7A3D",
  goldDark: "#FF9A66",
  goldSoft: "#2A1A10",
  teal: "#34C98F",
  tealSoft: "#0F2A20",
  rose: "#FF5A5F",
  roseSoft: "#2C1416",
  blue: "#6B9BF2",
  blueSoft: "#121D33",
  violet: "#A08BF2",
  violetSoft: "#1F1A33",
  amber: "#E5A845",
  amberSoft: "#2A2111",
};

const legacy = (c) => ({
  parchment: c.bg,
  cream: c.bg,
  lightBg: c.surface,
  navy: c.ink,
  black: c.ink900,
  darkGray: c.ink600,
  midGray: c.ink400,
  orange: c.gold,
  saffron: c.gold,
  saffronDark: c.goldDark,
  purple: c.violet,
  green: c.teal,
});

export const COLORS = { ...LIGHT, ...legacy(LIGHT) };

let version = 0;
let dark = false;

export function applyThemeMode(isDark) {
  if (isDark === dark && version > 0) return;
  dark = isDark;
  const p = isDark ? DARK : LIGHT;
  Object.assign(COLORS, p, legacy(p));
  version += 1;
}
export const isDarkTheme = () => dark;

/** Lazily (re)built styles: rebuilt the first time they're read after a theme switch. */
export function themed(factory) {
  let cache = null;
  let v = -1;
  const get = () => {
    if (v !== version) {
      cache = factory();
      v = version;
    }
    return cache;
  };
  return new Proxy({}, { get: (_, k) => get()[k], has: (_, k) => k in get(), ownKeys: () => Reflect.ownKeys(get()), getOwnPropertyDescriptor: (_, k) => Object.getOwnPropertyDescriptor(get(), k) });
}

/** Plus Jakarta Sans — loaded in App.js. */
export const FONT = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};

export const FONT_SIZES = { title: 28, subtitle: 17, body: 15, small: 13 };
export const RADIUS = { sm: 10, md: 16, lg: 24, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
