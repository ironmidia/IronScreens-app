// Iron Screens — YouTube Renderer (Native)
// Usa youtube-nocookie.com com iframe embed direto para evitar erro 152-4.
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildYouTubeHtml } from '@/services/youtubeService';

interface YoutubeRendererProps {
  videoId: string;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  const html = buildYouTubeHtml(videoId);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        allowsFullscreenVideo={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsProtectedMedia
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});

export default memo(YoutubeRenderer);
