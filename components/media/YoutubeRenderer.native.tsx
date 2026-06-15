// Iron Screens — YouTube Renderer (Native)
//
// Duração: o player aguarda o fim natural do vídeo (evento onStateChange=0
// via postMessage da YouTube IFrame API) e então chama onEnd().
// O player.tsx NÃO arma timer para type=youtube — ver VIDEO_EVENT_TYPES.
import React, { memo, useRef, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { getYouTubeEmbedUrl } from "@/services/youtubeService";

const REFERRER = "https://ironscreens.app";

const TV_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) " +
  "AppleWebKit/538.1 (KHTML, like Gecko) " +
  "Version/6.0 TV Safari/538.1";

interface YoutubeRendererProps {
  videoId: string;
  onEnd?: () => void;
}

function YoutubeRenderer({ videoId, onEnd }: YoutubeRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endCalledRef = useRef(false);

  const baseUrl = getYouTubeEmbedUrl(videoId);
  // enablejsapi=1 ativa a YouTube IFrame API para receber postMessage de state
  const embedUri =
    `${baseUrl}` +
    `&origin=${encodeURIComponent(REFERRER)}` +
    `&enablejsapi=1`;

  // O YouTube envia postMessage com {event:"infoDelivery",info:{playerState:0}}
  // quando o vídeo termina (state 0 = ended).
  // Também escutamos o evento nativo 'ended' do <video> como fallback.
  const INJECTED_JS = `
(function() {
  // Escuta postMessage da YouTube IFrame API
  window.addEventListener('message', function(e) {
    try {
      var data = JSON.parse(e.data);
      // playerState 0 = video ended
      if (data && data.info && data.info.playerState === 0) {
        window.ReactNativeWebView.postMessage('ENDED');
      }
      // Fallback: evento 'onStateChange' direto
      if (data && data.event === 'onStateChange' && data.info === 0) {
        window.ReactNativeWebView.postMessage('ENDED');
      }
    } catch(err) {}
  });

  // Fallback nativo: ouve o evento 'ended' no elemento <video>
  function watchVideo() {
    var v = document.querySelector('video');
    if (v) {
      v.addEventListener('ended', function() {
        window.ReactNativeWebView.postMessage('ENDED');
      });
    } else {
      setTimeout(watchVideo, 500);
    }
  }
  watchVideo();
})();
true;
`;

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'ENDED' && !endCalledRef.current) {
      endCalledRef.current = true;
      onEndRef.current?.();
    }
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        source={{
          uri: embedUri,
          headers: {
            Referer: REFERRER,
            Origin: REFERRER,
          },
        }}
        userAgent={TV_UA}
        style={styles.webview}
        onMessage={onMessage}
        injectedJavaScript={INJECTED_JS}
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
        originWhitelist={["*"]}
        mixedContentMode="always"
        allowsProtectedMedia
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
});

export default memo(YoutubeRenderer);
