// Iron Screens — Media Renderer (Web preview)
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Media } from '@/services/models';
import { extractYouTubeId, buildYouTubeEmbedUrl } from '@/services/youtubeService';
import ImageRenderer from './ImageRenderer';
import VideoRenderer from './VideoRenderer';
import WebViewRenderer from './WebViewRenderer.web';

interface MediaRendererProps {
  media: Media;
  onVideoEnd?: () => void;
}

function MediaRenderer({ media, onVideoEnd }: MediaRendererProps) {
  switch (media.type) {
    case 'image':
      if (!media.file_url) return <View style={styles.black} />;
      return <ImageRenderer uri={media.file_url} />;

    case 'video':
      if (!media.file_url) return <View style={styles.black} />;
      return <VideoRenderer uri={media.file_url} onEnd={onVideoEnd} />;

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
    backgroundColor: '#000',
  },
});

export default memo(MediaRenderer);
