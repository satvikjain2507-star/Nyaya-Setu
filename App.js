import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import HomeScreen from "./src/screens/HomeScreen";
import SchemeNavigatorScreen from "./src/screens/SchemeNavigatorScreen";
import LegalCompanionScreen from "./src/screens/LegalCompanionScreen";
import DocumentSimplifierScreen from "./src/screens/DocumentSimplifierScreen";
import HelpCentersScreen from "./src/screens/HelpCentersScreen";
import TranslatorScreen from "./src/screens/TranslatorScreen";
import VisualSolverScreen from "./src/screens/VisualSolverScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SahayakLiveScreen from "./src/screens/SahayakLiveScreen";
import ScamShieldScreen from "./src/screens/ScamShieldScreen";
import { COLORS, FONT } from "./src/constants/theme";
import { LanguageProvider, useLanguage } from "./src/context/LanguageContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: COLORS.bg, card: COLORS.bg, border: COLORS.border, primary: COLORS.ink } };

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: COLORS.bg },
  headerTintColor: COLORS.ink,
  headerTitleStyle: { fontFamily: FONT.bold, fontSize: 18 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
};

// Home tab has its own stack so it can push into each tool
function HomeStack() {
  const { t } = useLanguage();
  return (
    <Stack.Navigator screenOptions={HEADER_OPTIONS}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SchemeNavigator" component={SchemeNavigatorScreen} options={{ title: t("schemeNavigator") }} />
      <Stack.Screen name="LegalCompanion" component={LegalCompanionScreen} options={{ title: t("legalCompanion") }} />
      <Stack.Screen name="DocumentSimplifier" component={DocumentSimplifierScreen} options={{ title: t("documentSimplifier") }} />
      <Stack.Screen name="Translator" component={TranslatorScreen} options={{ title: t("translator") }} />
      <Stack.Screen name="VisualSolver" component={VisualSolverScreen} options={{ title: t("visualSolver") }} />
      <Stack.Screen name="HelpCenters" component={HelpCentersScreen} options={{ title: t("helpCenters") }} />
      <Stack.Screen name="ScamShield" component={ScamShieldScreen} options={{ title: t("scamShield") }} />
    </Stack.Navigator>
  );
}

const ICON = {
  HomeTab: (c) => <Feather name="home" size={22} color={c} />,
  SchemeTab: (c) => <Feather name="layers" size={22} color={c} />,
  LegalTab: (c) => <MaterialCommunityIcons name="scale-balance" size={23} color={c} />,
  SettingsTab: (c) => <Feather name="settings" size={22} color={c} />,
};

function LiveTabIcon({ focused }) {
  return (
    <View
      style={{
        width: 54,
        height: 54,
        marginTop: -20,
        borderRadius: 27,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? COLORS.gold : COLORS.ink,
        borderWidth: 4,
        borderColor: COLORS.bg,
      }}
    >
      <Feather name="mic" size={22} color={COLORS.white} />
    </View>
  );
}

function Tabs() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.ink,
        tabBarInactiveTintColor: "#9A9AA1",
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.semibold },
        tabBarIcon: ({ focused, color }) => (route.name === "LiveTab" ? <LiveTabIcon focused={focused} /> : ICON[route.name](color)),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: t("home") }} />
      <Tab.Screen name="SchemeTab" component={SchemeNavigatorScreen} options={{ title: t("tabSchemes"), headerShown: true, ...HEADER_OPTIONS, headerTitle: t("schemeNavigator") }} />
      <Tab.Screen name="LiveTab" component={SahayakLiveScreen} options={{ title: t("tabLive") }} />
      <Tab.Screen name="LegalTab" component={LegalCompanionScreen} options={{ title: t("tabLegal"), headerShown: true, ...HEADER_OPTIONS, headerTitle: t("legalCompanion") }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: t("settings"), headerShown: true, ...HEADER_OPTIONS }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <NavigationContainer theme={NAV_THEME}>
          <StatusBar style="dark" />
          <Tabs />
        </NavigationContainer>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
