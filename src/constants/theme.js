/**
 * Nyaya Setu design system
 * Black + white base (CRED / Linear), one saffron accent, soft grey surfaces (Notion),
 * big bold type (Airbnb), quiet borders instead of shadows.
 */
export const COLORS = {
  // core
  ink: "#0B0B0C",
  inkDeep: "#000000",
  inkSoft: "#1C1C1F",
  white: "#FFFFFF",
  bg: "#FFFFFF",
  surface: "#F4F4F2",
  surfaceAlt: "#EDEDEA",
  border: "#EAEAE7",

  // text
  ink900: "#0B0B0C",
  ink600: "#3A3A40",
  ink400: "#71717A",

  // accent (saffron)
  gold: "#F2611D",
  goldDark: "#C94C12",
  goldSoft: "#FFF1E9",

  // semantic
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

  // legacy aliases (older screens still read these)
  parchment: "#F7F7F5",
  navy: "#0B0B0C",
  orange: "#F2611D",
  saffron: "#F2611D",
  saffronDark: "#C94C12",
  cream: "#F7F7F5",
  purple: "#6E56CF",
  green: "#0B8A5B",
  black: "#0B0B0C",
  darkGray: "#3A3A40",
  midGray: "#71717A",
  lightBg: "#F1F1EF",
};

/** Plus Jakarta Sans — loaded in App.js. Use these instead of fontWeight (Android needs one family per weight). */
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
