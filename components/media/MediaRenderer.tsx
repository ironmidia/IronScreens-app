// Iron Screens — Media Renderer (Native: iOS / Android)
import React, { memo } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Media } from "@/services/models";
import { extractYouTubeId } from "@/services/youtubeService";
import ImageRenderer from "./ImageRenderer";
import VideoRenderer from "./VideoRenderer";
import WebVideoRenderer from "./WebVideoRenderer.native";
import YoutubeRenderer from "./YoutubeRenderer.native";
import WebViewRenderer from "./WebViewRenderer.native";
import NewsRenderer, { isNewsMedia } from "./NewsRenderer";

// ─── Selo de diagnóstico temporário: mostra, pro vídeo que está tocando de
// verdade no loop, qual caminho de renderização foi usado (webview/native)
// e se a URI é o arquivo cacheado local ou a remota — pra descobrir, com
// dado real, por que o vídeo às vezes volta a tocar na horizontal mesmo com
// a rotação simulada ativa (o resto da tela gira certo, só o vídeo não).
function VideoDebugBadge({ rotated, isLocal }: { rotated: boolean; isLocal: boolean }) {
  return (
    <View style={styles.debugBadge} pointerEvents="none">
      <Text style={styles.debugBadgeText}>
        R:{rotated ? "1" : "0"} P:{rotated ? "webview" : "native"} U:{isLocal ? "local" : "remoto"}
      </Text>
    </View>
  );
}

interface MediaRendererProps {
  media: Media;
  durationSec?: number;
  transitionImageUrl?: string | null;
  onVideoEnd?: () => void;
  rotated?: boolean;
}

function MediaRenderer({
  media,
  durationSec,
  transitionImageUrl,
  onVideoEnd,
  rotated,
}: MediaRendererProps) {
  const resolvedUri = media.local_file_url || media.file_url || null;

  switch (media.type) {
    case "image":
      if (isNewsMedia(media.category)) {
        return (
          <NewsRenderer
            imageUrl={resolvedUri}
            backgroundUrl={transitionImageUrl ?? null}
            title={media.name}
            category={media.category}
            source={media.company}
            externalUrl={media.external_url}
          />
        );
      }
      if (!resolvedUri) return <View style={styles.black} />;
      return <ImageRenderer uri={resolvedUri} />;

    case "video": {
      if (!resolvedUri) return <View style={styles.black} />;
      const isLocal = !!media.local_file_url;
      // ─── Vídeos próprios (upload no sistema) via expo-video não respeitam
      // a rotação simulada nesse hardware, mesmo com surfaceType=textureView
      // — mas o WebView (usado pro YouTube/Instagram) respeita certinho.
      // Só troca pra esse caminho quando a rotação simulada está ativa;
      // fora disso mantém o player nativo (mais leve/eficiente).
      if (rotated) {
        return (
          <>
            <WebVideoRenderer
              uri={resolvedUri}
              durationSec={durationSec}
              onEnd={onVideoEnd}
            />
            <VideoDebugBadge rotated={rotated} isLocal={isLocal} />
          </>
        );
      }
      return (
        <>
          <VideoRenderer
            uri={resolvedUri}
            durationSec={durationSec}
            onEnd={onVideoEnd}
            rotated={rotated}
          />
          <VideoDebugBadge rotated={rotated} isLocal={isLocal} />
        </>
      );
    }

    case "youtube": {
      if (!media.external_url) return <View style={styles.black} />;
      const videoId = extractYouTubeId(media.external_url);
      if (!videoId) return <View style={styles.black} />;
      return <YoutubeRenderer videoId={videoId} />;
    }

    case "external_link":
    case "instagram":
      if (!media.external_url) return <View style={styles.black} />;
      return <WebViewRenderer uri={media.external_url} />;

    case "programmatic":
    default:
      return <View style={styles.black} />;
  }
}

const styles = StyleSheet.create({
  // Transparente pra deixar o backdrop de transição do player aparecer
  // em vez de tela preta quando não há mídia válida pra mostrar.
  black: { flex: 1, backgroundColor: "transparent" },
  debugBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  debugBadgeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "600",
  },
});

export default memo(MediaRenderer);
