import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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
import { COLORS, RADIUS } from "./src/constants/theme";
import { LanguageProvider, useLanguage } from "./src/context/LanguageContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: COLORS.ink },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: "700", fontSize: 18 },
  headerShadowVisible: false,
};

// Home tab has its own internal stack so it can push into Help Centers
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

const ICONS = {
  HomeTab: "🏠",
  SchemeTab: "📋",
  LiveTab: "🛰️",
  LegalTab: "⚖️",
  DocumentTab: "📄",
  SettingsTab: "⚙️",
};

function TabIcon({ symbol, focused, live }) {
  if (live) {
    return (
      <View
        style={{
          width: 52,
          height: 52,
          marginTop: -18,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? COLORS.gold : COLORS.ink,
          borderWidth: 3,
          borderColor: COLORS.white,
          elevation: 6,
          shadowColor: COLORS.inkDeep,
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Text style={{ fontSize: 22 }}>{symbol}</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: 40,
        height: 32,
        borderRadius: RADIUS.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? COLORS.goldSoft : "transparent",
      }}
    >
      <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.55 }}>{symbol}</Text>
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
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.midGray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused }) => <TabIcon symbol={ICONS[route.name]} focused={focused} live={route.name === "LiveTab"} />,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: t("home") }} />
      <Tab.Screen name="SchemeTab" component={SchemeNavigatorScreen} options={{ title: t("schemeNavigator"), headerShown: true, ...HEADER_OPTIONS }} />
      <Tab.Screen name="LiveTab" component={SahayakLiveScreen} options={{ title: t("liveTab") }} />
      <Tab.Screen name="LegalTab" component={LegalCompanionScreen} options={{ title: t("legalCompanion"), headerShown: true, ...HEADER_OPTIONS }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: t("settings"), headerShown: true, ...HEADER_OPTIONS }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
    <LanguageProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tabs />
      </NavigationContainer>
    </LanguageProvider>
    </SafeAreaProvider>
  );
}
