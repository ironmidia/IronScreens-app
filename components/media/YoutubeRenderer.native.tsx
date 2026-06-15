// Iron Screens — YouTube Renderer (Native)
//
// Duração: o player tenta detectar o fim natural do vídeo via:
//   1. postMessage da YouTube IFrame API (playerState=0)
//   2. evento nativo 'ended' no elemento <video>
//   3. Watchdog baseado na duração REAL do vídeo (lida do elemento <video>)
//      — garante que o vídeo avança mesmo que os eventos acima falhem
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

// Margem de segurança após o fim do vídeo (ms)
const END_MARGIN_MS = 3000;
// Watchdog padrão enquanto a duração real ainda é desconhecida
const DEFAULT_WATCHDOG_MS = 120000; // 2 minutos
// Máximo watchdog (5 minutos)
const MAX_WATCHDOG_MS = 300000;

function YoutubeRenderer({ videoId, onEnd }: YoutubeRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationArmedRef = useRef(false);

  const baseUrl = getYouTubeEmbedUrl(videoId);
  const embedUri =
    `${baseUrl}` +
    `&origin=${encodeURIComponent(REFERRER)}` +
    `&enablejsapi=1`;

  const triggerEnd = useCallback(() => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    console.log("[YoutubeRenderer] Avançando");
    onEndRef.current?.();
  }, []);

  // Recebe mensagens do JS injetado no WebView
  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (endCalledRef.current) return;

      try {
        const msg = JSON.parse(e.nativeEvent.data);

        // Vídeo terminou naturalmente
        if (msg.type === "ENDED") {
          console.log("[YoutubeRenderer] ENDED recebido");
          triggerEnd();
          return;
        }

        // Duração real do vídeo chegou — arma (ou re-arma) o watchdog
        if (msg.type === "DURATION" && typeof msg.value === "number" && msg.value > 0) {
          console.log("[YoutubeRenderer] Duração real:", msg.value, "s");

          // Só re-arma se ainda não armou com duração real
          if (!durationArmedRef.current) {
            durationArmedRef.current = true;

            if (watchdogRef.current) {
              clearTimeout(watchdogRef.current);
              watchdogRef.current = null;
            }

            const watchdogMs = Math.min(
              (msg.value * 1000) + END_MARGIN_MS,
              MAX_WATCHDOG_MS,
            );

            console.log("[YoutubeRenderer] Watchdog armado:", watchdogMs, "ms");

            watchdogRef.current = setTimeout(() => {
              console.warn("[YoutubeRenderer] Watchdog disparou, avançando");
              triggerEnd();
            }, watchdogMs);
          }

          return;
        }

        // currentTime atualizado — se estiver no fim, avança
        if (msg.type === "TIME" && typeof msg.value === "number" &&
            typeof msg.duration === "number" && msg.duration > 0) {
          const nearEnd = msg.value >= msg.duration - 0.5;
          if (nearEnd) {
            console.log("[YoutubeRenderer] currentTime perto do fim, avançando");
            triggerEnd();
          }
        }
      } catch {
        // Mensagem sem JSON (legado)
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd],
  );

  // JS injetado no WebView:
  // - Detecta fim via postMessage da YouTube IFrame API e evento nativo 'ended'
  // - Lê a duração real do elemento <video> e envia ao React Native
  // - Envia currentTime periodicamente para fallback por posição
  const INJECTED_JS = `
(function() {
  var endSent = false;
  var durationSent = false;
  var pollInterval = null;

  function send(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }

  function notifyEnd() {
    if (endSent) return;
    endSent = true;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    send({ type: 'ENDED' });
  }

  // Observa o elemento <video> para ler duração e eventos
  function watchVideo() {
    var v = document.querySelector('video');
    if (!v) {
      setTimeout(watchVideo, 500);
      return;
    }

    // Lê duração real assim que disponível
    function sendDuration() {
      if (!durationSent && v.duration && isFinite(v.duration) && v.duration > 0) {
        durationSent = true;
        send({ type: 'DURATION', value: v.duration });
      }
    }

    v.addEventListener('durationchange', sendDuration);
    v.addEventListener('loadedmetadata', sendDuration);
    sendDuration(); // tenta imediatamente caso já esteja disponível

    // Evento nativo de fim
    v.addEventListener('ended', function() { notifyEnd(); });

    // Polling de posição — envia TIME para detecção de fim por posição
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(function() {
      if (endSent) { clearInterval(pollInterval); pollInterval = null; return; }
      sendDuration(); // continua tentando até ter a duração
      if (v.duration && isFinite(v.duration) && v.duration > 0) {
        send({ type: 'TIME', value: v.currentTime, duration: v.duration });
      }
    }, 1000);
  }

  // Escuta postMessage da YouTube IFrame API
  window.addEventListener('message', function(e) {
    try {
      var data = JSON.parse(e.data);
      if (data && data.info && data.info.playerState === 0) notifyEnd();
      if (data && data.event === 'onStateChange' && data.info === 0) notifyEnd();
    } catch(err) {}
  });

  watchVideo();
})();
true;
`;

  // Arma watchdog padrão ao montar (será re-armado quando a duração real chegar)
  const webviewRef = useRef<WebView>(null);

  const onLoadEnd = useCallback(() => {
    if (endCalledRef.current) return;
    // Watchdog inicial conservador — será substituído quando DURATION chegar
    if (!watchdogRef.current) {
      console.log("[YoutubeRenderer] Watchdog inicial:", DEFAULT_WATCHDOG_MS, "ms");
      watchdogRef.current = setTimeout(() => {
        console.warn("[YoutubeRenderer] Watchdog inicial disparou");
        triggerEnd();
      }, DEFAULT_WATCHDOG_MS);
    }
  }, [triggerEnd]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
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
        onLoadEnd={onLoadEnd}
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
