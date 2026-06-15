// Iron Screens — YouTube Renderer (Native)
// Usa source={{ html }} para evitar que o YouTube valide o domínio de origem,
// o que bloquearia embeds de apps com Referer/Origin não registrado.
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { getYouTubeEmbedUrl } from "@/services/youtubeService";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

interface YoutubeRendererProps {
  videoId: string;
}

function buildHtml(embedUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen="false"
    frameborder="0"
  ></iframe>
</body>
</html>`;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  const embedUrl = getYouTubeEmbedUrl(videoId);
  const html = buildHtml(embedUrl);

  return (
    <View style={styles.container}>
      <WebView
        // source={{ html }} faz o YouTube tratar como origem local (file://)
        // e não bloqueia o embed por domínio não registrado
        source={{ html, baseUrl: "https://www.youtube.com" }}
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
