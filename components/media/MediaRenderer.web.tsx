// Iron Screens — Media Renderer (Web preview)
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Media } from '@/services/models';
import { extractYouTubeId, buildYouTubeEmbedUrl } from '@/services/youtubeService';
import ImageRenderer from './ImageRenderer';
import VideoRenderer from './VideoRenderer';
import WebViewRenderer from './WebViewRenderer.web';
import NewsRenderer, { isNewsMedia } from './NewsRenderer';

interface MediaRendererProps {
  media: Media;
  transitionImageUrl?: string | null;
  onVideoEnd?: () => void;
  rotated?: boolean;
}

function MediaRenderer({
  media,
  transitionImageUrl,
  onVideoEnd,
  rotated,
}: MediaRendererProps) {
  switch (media.type) {
    case 'image':
      if (isNewsMedia(media.category)) {
        return (
          <NewsRenderer
            imageUrl={media.file_url}
            backgroundUrl={transitionImageUrl ?? null}
            title={media.name}
            category={media.category}
            source={media.company}
            externalUrl={media.external_url}
          />
        );
      }
      if (!media.file_url) return <View style={styles.black} />;
      return <ImageRenderer uri={media.file_url} />;

    case 'video':
      if (!media.file_url) return <View style={styles.black} />;
      return <VideoRenderer uri={media.file_url} onEnd={onVideoEnd} rotated={rotated} />;

    case 'youtube': {
      if (!media.external_url) return <View style={styles.black} />;
      const videoId = extractYouTubeId(media.external_url);
      if (!videoId) return <View style={styles.black} />;
      return <WebViewRenderer uri={buildYouTubeEmbedUrl(videoId)} />;
    }

    case 'external_link':
      if (!media.external_url) return <View style={styles.black} />;
      return <WebViewRenderer uri={media.external_url} />;

    case 'instagram':
      if (!media.external_url) return <View style={styles.black} />;
      return <WebViewRenderer uri={media.external_url} />;

    case 'programmatic':
    default:
      return <View style={styles.black} />;
  }
}

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default memo(MediaRenderer);
