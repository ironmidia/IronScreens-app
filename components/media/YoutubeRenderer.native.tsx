// Iron Screens — YouTube Renderer (Native)
// Suporta tanto vídeos normais (watch?v=) quanto Shorts (/shorts/)
// O endpoint /embed/ID é o mesmo para ambos os formatos.
//
// Estratégia para evitar erro 152 (embed bloqueado por origin):
//   source={{ html }} + baseUrl: 'https://www.youtube.com'
//   faz o WebView reportar origin = https://www.youtube.com para o iframe,
//   que é um domínio aceito pelo player de embed do YouTube.
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { getYouTubeEmbedUrl } from "@/services/youtubeService";

// UA de Smart TV / Chromecast — o YouTube não bloqueia autoplay nesses dispositivos
const TV_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) " +
  "AppleWebKit/538.1 (KHTML, like Gecko) " +
  "Version/6.0 TV Safari/538.1";

interface YoutubeRendererProps {
  videoId: string;
}

function buildHtml(embedUrl: string): string {
  // origin=https://www.youtube.com no src do iframe é o parâmetro que
  // instrui o player a aceitar postMessage e autoplay desse contexto
  const urlWithOrigin = embedUrl + "&origin=https://www.youtube.com&widget_referrer=https://www.youtube.com";
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe
    id="yt"
    src="${urlWithOrigin}"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen="false"
    frameborder="0"
  ></iframe>
  <script>
    // Envia PLAY via postMessage logo que o iframe carregar (protocolo YouTube IFrame API)
    var iframe = document.getElementById('yt');
    iframe.addEventListener('load', function() {
      setTimeout(function() {
        try {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            'https://www.youtube.com'
          );
        } catch(e) {}
      }, 500);
    });
  </script>
</body>
</html>`;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  const embedUrl = getYouTubeEmbedUrl(videoId);
  const html = buildHtml(embedUrl);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html, baseUrl: "https://www.youtube.com" }}
        userAgent={TV_UA}
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
