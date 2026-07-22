// Iron Screens — Media Renderer (Native: iOS / Android)
import React, { memo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Media } from "@/services/models";
import { extractYouTubeId } from "@/services/youtubeService";
import ImageRenderer from "./ImageRenderer";
import VideoRenderer from "./VideoRenderer";
import WebVideoRenderer from "./WebVideoRenderer.native";
import YoutubeRenderer from "./YoutubeRenderer.native";
import InstagramRenderer from "./InstagramRenderer.native";
import WebViewRenderer from "./WebViewRenderer.native";
import NewsRenderer, { isNewsMedia } from "./NewsRenderer";

interface MediaRendererProps {
  media: Media;
  durationSec?: number;
  transitionImageUrl?: string | null;
  onVideoEnd?: () => void;
  rotated?: boolean;
}

// ─── Item sem os dados necessários pra tocar (ex: "instagram"/"youtube" sem
// external_url, "video" sem arquivo resolvido). Antes disso caía num
// <View> preta simples e travava pra sempre — esses tipos não têm timer de
// avanço em player.tsx (dependem só do onVideoEnd do próprio renderer), e
// um renderer que nunca chega a montar nunca dispara esse evento. Loga o
// motivo e avança sozinho depois de um tempo curto em vez de travar o loop.
function BrokenMediaFallback({ reason, onEnd }: { reason: string; onEnd?: () => void }) {
  useEffect(() => {
    console.error("[MediaRenderer] Item sem dados pra tocar:", reason);
    const t = setTimeout(() => {
      console.warn("[MediaRenderer] Avançando após item quebrado:", reason);
      onEnd?.();
    }, 3000);
    return () => clearTimeout(t);
  }, [reason, onEnd]);

  return <View style={styles.black} />;
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
      if (!resolvedUri) {
        return <BrokenMediaFallback reason={`vídeo "${media.name}" sem arquivo`} onEnd={onVideoEnd} />;
      }
      // ─── Vídeos próprios (upload no sistema) via expo-video não respeitam
      // a rotação simulada nesse hardware, mesmo com surfaceType=textureView
      // — mas o WebView (usado pro YouTube/Instagram) respeita certinho.
      // Só troca pra esse caminho quando a rotação simulada está ativa;
      // fora disso mantém o player nativo (mais leve/eficiente).
      if (rotated) {
        return (
          <WebVideoRenderer
            uri={resolvedUri}
            durationSec={durationSec}
            onEnd={onVideoEnd}
          />
        );
      }
      return (
        <VideoRenderer
          uri={resolvedUri}
          durationSec={durationSec}
          onEnd={onVideoEnd}
          rotated={rotated}
        />
      );
    }

    case "youtube": {
      if (!media.external_url) {
        return <BrokenMediaFallback reason={`youtube "${media.name}" sem external_url`} onEnd={onVideoEnd} />;
      }
      const videoId = extractYouTubeId(media.external_url);
      if (!videoId) {
        return <BrokenMediaFallback reason={`youtube "${media.name}" com URL inválida: ${media.external_url}`} onEnd={onVideoEnd} />;
      }
      // onVideoEnd é passado para que o YouTube dispare o avanço ao terminar
      return (
        <YoutubeRenderer
          videoId={videoId}
          onEnd={onVideoEnd}
          startSec={media.youtube_start_sec}
          endSec={media.youtube_end_sec}
        />
      );
    }

    case "instagram":
      if (!media.external_url) {
        return <BrokenMediaFallback reason={`instagram "${media.name}" sem external_url`} onEnd={onVideoEnd} />;
      }
      // onVideoEnd é passado para que o Instagram dispare o avanço ao terminar
      return <InstagramRenderer uri={media.external_url} onEnd={onVideoEnd} />;

    case "external_link":
      if (!media.external_url) return <View style={styles.black} />;
      return <WebViewRenderer uri={media.external_url} />;

    case "programmatic":
    default:
      return <View style={styles.black} />;
  }
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
});

export default memo(MediaRenderer);
