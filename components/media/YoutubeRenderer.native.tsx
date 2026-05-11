// Iron Screens — YouTube Renderer (Native)
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getYouTubeEmbedUrl } from '@/services/youtubeService';

// User-Agent de Chrome desktop — evita detecção de WebView pelo YouTube
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

interface YoutubeRendererProps {
  videoId: string;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  const uri = getYouTubeEmbedUrl(videoId);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        userAgent={DESKTOP_UA}
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
