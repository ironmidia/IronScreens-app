// Iron Screens — YouTube Renderer (Native)
// Carrega o embed do YouTube diretamente via source.uri (não HTML injetado),
// com baseUrl https://www.youtube.com para que o player reconheça a origem.
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getYouTubeEmbedUrl } from '@/services/youtubeService';

interface YoutubeRendererProps {
  videoId: string;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  const uri = getYouTubeEmbedUrl(videoId);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
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
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});

export default memo(YoutubeRenderer);
