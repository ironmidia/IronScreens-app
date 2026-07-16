// Iron Screens — Media Renderer (Native: iOS / Android)
import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Media } from "@/services/models";
import { extractYouTubeId } from "@/services/youtubeService";
import ImageRenderer from "./ImageRenderer";
import VideoRenderer from "./VideoRenderer";
import YoutubeRenderer from "./YoutubeRenderer.native";
import InstagramRenderer from "./InstagramRenderer.native";
import WebViewRenderer from "./WebViewRenderer.native";
import NewsRenderer, { isNewsMedia } from "./NewsRenderer";

interface MediaRendererProps {
  media: Media;
  durationSec?: number;
  transitionImageUrl?: string | null;
  onVideoEnd?: () => void;
}

function MediaRenderer({
  media,
  durationSec,
  transitionImageUrl,
  onVideoEnd,
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

    case "video":
      if (!resolvedUri) return <View style={styles.black} />;
      return (
        <VideoRenderer
          uri={resolvedUri}
          durationSec={durationSec}
          onEnd={onVideoEnd}
        />
      );

    case "youtube": {
      if (!media.external_url) return <View style={styles.black} />;
      const videoId = extractYouTubeId(media.external_url);
      if (!videoId) return <View style={styles.black} />;
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
      if (!media.external_url) return <View style={styles.black} />;
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
