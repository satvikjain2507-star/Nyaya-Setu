#!/bin/bash
# Upgrade Nyaya Setu from Expo SDK 54 -> 57. Run from the project folder:  bash scripts/upgrade-sdk57.sh
set -e
cd "$(dirname "$0")/.."
echo "== Node: $(node -v)  (SDK 57 needs Node 20.19.4+ / 22.13+ / 24.3+)"
echo "== 1/5 Clean old install"
rm -rf node_modules .expo
echo "== 2/5 Install Expo SDK 57"
npm install expo@^57.0.17
echo "== 3/5 Align every Expo/React Native package to SDK 57"
npx expo install --fix
npx expo install expo-audio expo-file-system
echo "== 4/5 React Navigation 7 (needed for the newer react-native-screens)"
npm install @react-navigation/native@^7 @react-navigation/native-stack@^7 @react-navigation/bottom-tabs@^7
echo "== 5/5 Health check"
npx expo-doctor@latest || true
echo; echo "== Done. Now run:  npx expo start --tunnel --clear"
