// Iron Screens — Tela de diagnóstico isolado de rotação
// Sem playlist, sem CrossfadeView, sem lógica de agendamento — só pra
// descobrir, com o mínimo de variáveis possível, se ALGUMA coisa consegue
// respeitar a rotação simulada nessa box: uma caixa parada, uma caixa
// animada, o vídeo nativo (expo-video) e o vídeo via WebView+canvas.
// Ajuda a isolar se o problema é "vídeo" especificamente, ou algo mais
// amplo (ex: qualquer conteúdo animado/dinâmico não gira nessa box).
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import RotatedViewport from "@/components/player/RotatedViewport";
import VideoRenderer from "@/components/media/VideoRenderer";
import WebVideoRenderer from "@/components/media/WebVideoRenderer.native";

// Um dos vídeos verticais reais que já reproduzem o problema.
const TEST_VIDEO_URL =
  "https://qfqolsrnneerccagrunm.supabase.co/storage/v1/object/public/media-files/videos/1784242670935_ed0g6zmz8l4.mp4";

type Mode = "static" | "animated" | "video-native" | "video-webview";

const MODES: { key: Mode; label: string }[] = [
  { key: "static", label: "1. Caixa parada" },
  { key: "animated", label: "2. Caixa animada" },
  { key: "video-native", label: "3. Vídeo nativo (expo-video)" },
  { key: "video-webview", label: "4. Vídeo WebView (canvas)" },
];

function StaticBox() {
  return (
    <View style={styles.box}>
      <Text style={styles.boxText}>ESTÁTICO{"\n"}TOPO = TOPO?</Text>
    </View>
  );
}

function AnimatedBox() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#16A34A", "#D97706", "#2563EB"],
  });

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.animatedDot, { transform: [{ translateY }], backgroundColor }]} />
      <Text style={styles.boxText}>ANIMADO{"\n"}(sobe/desce, muda de cor)</Text>
    </View>
  );
}

export default function DebugRotationScreen() {
  const [mode, setMode] = useState<Mode>("static");

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <View style={styles.root}>
      <RotatedViewport rotate>
        <View style={styles.content}>
          {mode === "static" && <StaticBox />}
          {mode === "animated" && <AnimatedBox />}
          {mode === "video-native" && (
            <VideoRenderer uri={TEST_VIDEO_URL} rotated />
          )}
          {mode === "video-webview" && (
            <WebVideoRenderer uri={TEST_VIDEO_URL} />
          )}

          <View style={styles.label}>
            <Text style={styles.labelText}>{MODES.find((m) => m.key === mode)?.label}</Text>
          </View>
        </View>
      </RotatedViewport>

      {/* Botões de troca de modo ficam FORA do RotatedViewport de propósito —
          não fazem parte do teste, só precisam continuar tocáveis. */}
      <View style={styles.controls} pointerEvents="box-none">
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.controlBtn, mode === m.key && styles.controlBtnActive]}
            onPress={() => setMode(m.key)}
          >
            <Text style={styles.controlBtnText}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  boxText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  animatedDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 24,
  },
  label: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 8,
  },
  labelText: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  controls: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  controlBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  controlBtnActive: {
    backgroundColor: "#70001B",
    borderColor: "#70001B",
  },
  controlBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
