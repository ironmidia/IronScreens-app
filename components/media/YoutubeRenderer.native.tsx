// Iron Screens — YouTube Renderer (Native)
//
// Solução para Erro 152/153 (confirmada na issue #3889 do react-native-webview):
//
//   1. source={{ uri }} diretamente — evita que o WebView use origin=file://
//      que o YouTube rejeita desde a atualização da API de julho/2025.
//
//   2. headers: { Referer } — o YouTube exige um Referer HTTP válido (https://).
//      Sem ele, a verificação de identidade do embedder falha com código 152/153.
//
//   3. &origin= na URL — informa ao player JS do YouTube qual é o origin
//      autorizado para postMessage (mesma regra da YouTube IFrame API).
//
// Referências:
//   https://github.com/react-native-webview/react-native-webview/issues/3889
//   https://corsproxy.io/blog/fix-youtube-error-150-153-webview/
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { getYouTubeEmbedUrl } from "@/services/youtubeService";

// Bundle ID do app — deve ser um domínio https:// válido para o YouTube aceitar
const REFERRER = "https://ironscreens.app";

// UA de Smart TV — o YouTube não bloqueia autoplay nesses dispositivos
const TV_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) " +
  "AppleWebKit/538.1 (KHTML, like Gecko) " +
  "Version/6.0 TV Safari/538.1";

interface YoutubeRendererProps {
  videoId: string;
}

function YoutubeRenderer({ videoId }: YoutubeRendererProps) {
  // getYouTubeEmbedUrl já inclui autoplay=1, loop=1, playsinline=1, etc.
  // Adicionamos &origin= para que o player JS aceite postMessage do nosso WebView
  const baseUrl = getYouTubeEmbedUrl(videoId);
  const embedUri = `${baseUrl}&origin=${encodeURIComponent(REFERRER)}`;

  return (
    <View style={styles.container}>
      <WebView
        // source={{ uri }} → o WebView envia a URL diretamente ao YouTube
        // sem passar por um HTML intermediário, o que mantém o Referer correto
        source={{
          uri: embedUri,
          headers: {
            // Referer válido é obrigatório desde a API update de julho/2025
            Referer: REFERRER,
            // Origin reforça a identidade junto com o Referer
            Origin: REFERRER,
          },
        }}
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
