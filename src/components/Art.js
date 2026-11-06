/**
 * Nyaya Setu illustrations — drawn in SVG so they stay sharp on every phone and cost no image weight.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path, Circle, Rect, G, Line, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from "react-native-svg";

/* ---------- brand mark: a bridge (setu) inside a saffron tile ---------- */
export function BrandMark({ size = 34, light = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <SvgGrad id="bm" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFB547" />
          <Stop offset="1" stopColor="#FF5A1F" />
        </SvgGrad>
      </Defs>
      <Rect x="0" y="0" width="40" height="40" rx="12" fill={light ? "#FFFFFF" : "url(#bm)"} />
      <Path d="M7 26 Q20 9 33 26" stroke={light ? "#FF5A1F" : "#FFFFFF"} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <Line x1="7" y1="29" x2="33" y2="29" stroke={light ? "#FF5A1F" : "#FFFFFF"} strokeWidth="3.2" strokeLinecap="round" />
      <Line x1="14" y1="19.5" x2="14" y2="29" stroke={light ? "#FF5A1F" : "#FFFFFF"} strokeWidth="2.4" strokeLinecap="round" />
      <Line x1="20" y1="16.5" x2="20" y2="29" stroke={light ? "#FF5A1F" : "#FFFFFF"} strokeWidth="2.4" strokeLinecap="round" />
      <Line x1="26" y1="19.5" x2="26" y2="29" stroke={light ? "#FF5A1F" : "#FFFFFF"} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

/* ---------- Ashoka-chakra style pattern for the header ---------- */
export function Chakra({ size = 260, color = "#FFFFFF", opacity = 0.09, style }) {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    return <Line key={i} x1={50} y1={50} x2={50 + 44 * Math.cos(a)} y2={50 + 44 * Math.sin(a)} stroke={color} strokeWidth="1.4" />;
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style} opacity={opacity}>
      <Circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" fill="none" />
      <Circle cx="50" cy="50" r="8" stroke={color} strokeWidth="2.5" fill="none" />
      {spokes}
    </Svg>
  );
}

/* ---------- Sahayak Live: a browser window being worked on ---------- */
export function LiveArt({ width = 150 }) {
  return (
    <Svg width={width} height={width * 0.86} viewBox="0 0 150 129">
      {/* back window */}
      <Rect x="34" y="6" width="110" height="82" rx="12" fill="#FFFFFF" opacity="0.18" />
      {/* main window */}
      <Rect x="10" y="22" width="118" height="88" rx="13" fill="#FFFFFF" />
      <Rect x="10" y="22" width="118" height="20" rx="13" fill="#EEEBFF" />
      <Rect x="10" y="34" width="118" height="8" fill="#EEEBFF" />
      <Circle cx="22" cy="32" r="3" fill="#FF5F57" />
      <Circle cx="32" cy="32" r="3" fill="#FEBC2E" />
      <Circle cx="42" cy="32" r="3" fill="#28C840" />
      <Rect x="52" y="28" width="62" height="8" rx="4" fill="#FFFFFF" />
      {/* page content */}
      <Rect x="22" y="52" width="58" height="7" rx="3.5" fill="#4B36F0" />
      <Rect x="22" y="65" width="88" height="5" rx="2.5" fill="#D9D6F5" />
      <Rect x="22" y="75" width="72" height="5" rx="2.5" fill="#D9D6F5" />
      <Rect x="22" y="88" width="40" height="12" rx="6" fill="#FF7A3D" />
      {/* verified badge */}
      <Circle cx="118" cy="104" r="16" fill="#12B76A" stroke="#FFFFFF" strokeWidth="3" />
      <Path d="M110.5 104 L116 109.5 L126 99" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* cursor */}
      <Path d="M70 84 L70 104 L75.5 99 L80 108 L84 106 L79.5 97.5 L86.5 97 Z" fill="#0B0B0C" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
      {/* sparkles */}
      <Path d="M140 18 L142.5 24 L148 26 L142.5 28 L140 34 L137.5 28 L132 26 L137.5 24 Z" fill="#FFD27A" />
      <Path d="M8 8 L9.6 12 L13.5 13.5 L9.6 15 L8 19 L6.4 15 L2.5 13.5 L6.4 12 Z" fill="#FFFFFF" opacity="0.8" />
    </Svg>
  );
}

/* ---------- Scam Shield ---------- */
export function ShieldArt({ size = 110 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 110 110">
      <Path d="M55 6 L96 20 V52 C96 78 78 96 55 104 C32 96 14 78 14 52 V20 Z" fill="#FFFFFF" opacity="0.22" />
      <Path d="M55 18 L86 29 V53 C86 72 73 86 55 92 C37 86 24 72 24 53 V29 Z" fill="#FFFFFF" />
      <Path d="M41 55 L51 65 L71 44" stroke="#E5383E" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* warning bubble */}
      <Circle cx="92" cy="86" r="14" fill="#FFC53D" stroke="#FFFFFF" strokeWidth="3" />
      <Rect x="90" y="77" width="4" height="10" rx="2" fill="#7A2E00" />
      <Circle cx="92" cy="92" r="2.3" fill="#7A2E00" />
    </Svg>
  );
}

/* ---------- Help near you: map with a pin ---------- */
export function MapArt({ size = 110 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 110 110">
      <G opacity="0.28" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round">
        <Line x1="0" y1="70" x2="110" y2="48" />
        <Line x1="30" y1="0" x2="52" y2="110" />
        <Line x1="76" y1="0" x2="92" y2="110" />
      </G>
      <Circle cx="55" cy="88" r="20" fill="#FFFFFF" opacity="0.25" />
      <Circle cx="55" cy="88" r="9" fill="#FFFFFF" opacity="0.45" />
      <Path d="M55 90 C55 90 30 62 30 44 C30 30 41 19 55 19 C69 19 80 30 80 44 C80 62 55 90 55 90 Z" fill="#FFFFFF" />
      <Circle cx="55" cy="44" r="11" fill="#0A9466" />
      <Circle cx="55" cy="44" r="4.5" fill="#FFFFFF" />
    </Svg>
  );
}

/* ---------- language banner: letters from Indian scripts ---------- */
export function ScriptsArt({ width = 140 }) {
  const items = [
    { x: 22, y: 30, r: 20, ch: "अ", c: "#FF5A1F" },
    { x: 66, y: 22, r: 17, ch: "த", c: "#4B36F0" },
    { x: 108, y: 34, r: 20, ch: "ক", c: "#0A9466" },
    { x: 46, y: 70, r: 18, ch: "ગ", c: "#E5383E" },
    { x: 92, y: 74, r: 17, ch: "A", c: "#2563EB" },
  ];
  return (
    <Svg width={width} height={width * 0.68} viewBox="0 0 140 95">
      {items.map((it, i) => (
        <G key={i}>
          <Circle cx={it.x} cy={it.y} r={it.r} fill="#FFFFFF" />
          <SvgText x={it.x} y={it.y + it.r * 0.36} fontSize={it.r * 1.05} fontWeight="bold" fill={it.c} textAnchor="middle">
            {it.ch}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

/* ---------- soft pulsing ring (used behind the live dot / mic) ---------- */
export function Pulse({ size = 12, color = "#FF4D4F" }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
