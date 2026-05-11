// Iron Screens — YouTube Renderer (Native)
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
        source={{ html, baseUrl: 'https://www.youtube.com' }}
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
        // originWhitelist amplo + sharedCookiesEnabled contornam o erro 152-4
        originWhitelist={['https://*', 'http://*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});

export default memo(YoutubeRenderer);
