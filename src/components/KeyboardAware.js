/**
 * Keeps the chat input above the on-screen keyboard.
 *
 * Android 15+ / Expo SDK 54+ run edge-to-edge: the window no longer resizes when
 * the keyboard opens, so the input box ends up behind it. Every screen in this
 * app sits above the bottom tab bar, so the part of the keyboard that covers
 * the screen is exactly: keyboard height − tab bar height. We pad by that.
 */
import React, { useContext, useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

export default function KeyboardAware({ children, style, onShow }) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) || 0;
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvt, (e) => {
      const kbHeight = e?.endCoordinates?.height || 0;
      setPad(Math.max(0, kbHeight - tabBarHeight));
      setTimeout(() => onShow?.(), 120);
    });
    const subHide = Keyboard.addListener(hideEvt, () => setPad(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [onShow, tabBarHeight]);

  return <View style={[{ flex: 1 }, style, { paddingBottom: pad }]}>{children}</View>;
}
