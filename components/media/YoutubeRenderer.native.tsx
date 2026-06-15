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

const END_MARGIN_MS = 3000;
const DEFAULT_WATCHDOG_MS = 120000;
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

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (endCalledRef.current) return;

      try {
        const msg = JSON.parse(e.nativeEvent.data);

        if (msg.type === "ENDED") {
          console.log("[YoutubeRenderer] ENDED recebido");
          triggerEnd();
          return;
        }

        if (msg.type === "DURATION" && typeof msg.value === "number" && msg.value > 0) {
          console.log("[YoutubeRenderer] Duração real:", msg.value, "s");

          if (!durationArmedRef.current) {
            durationArmedRef.current = true;

            if (watchdogRef.current) {
              clearTimeout(watchdogRef.current);
              watchdogRef.current = null;
            }

            const watchdogMs = Math.min(
              msg.value * 1000 + END_MARGIN_MS,
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

        if (
          msg.type === "TIME" &&
          typeof msg.value === "number" &&
          typeof msg.duration === "number" &&
          msg.duration > 0
        ) {
          if (msg.value >= msg.duration - 0.5) {
            console.log("[YoutubeRenderer] currentTime perto do fim, avançando");
            triggerEnd();
          }
        }
      } catch {
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd],
  );

  // JS injetado:
  // 1. Injeta CSS para esconder TODOS os controles/overlay do YouTube
  // 2. Detecta fim via postMessage + evento nativo 'ended'
  // 3. Lê duração real e envia ao React Native
  // 4. Polling de posição como fallback
  const INJECTED_JS = `
(function() {
  var endSent = false;
  var durationSent = false;
  var pollInterval = null;

  // ---- Ocultar controles do YouTube via CSS ----
  var style = document.createElement('style');
  style.textContent = [
    /* Barra de controles inferior */
    '.ytp-chrome-bottom',
    /* Botões de próximo/anterior/pause na tela */
    '.ytp-chrome-top',
    /* Gradient overlay clicável */
    '.ytp-gradient-top',
    '.ytp-gradient-bottom',
    /* Painel de pausa com título e capa */
    '.ytp-pause-overlay',
    '.ytp-pause-overlay-container',
    /* Cards e end-screen */
    '.ytp-ce-element',
    '.ytp-endscreen-content',
    /* Watermark do YouTube */
    '.ytp-watermark',
    /* Logo no canto */
    '.ytp-youtube-button',
    /* Caixa de título no topo */
    '.ytp-title',
    /* Tela de autoplay */
    '.ytp-autonav-endscreen',
    /* Spinner de loading (mantém, mas pode esconder se quiser) */
    /* '.ytp-spinner', */
    /* Info cards */
    '.ytp-cards-teaser',
    '.ytp-cards-button',
    /* Botões de contexto */
    '.ytp-contextmenu',
    /* Overlay geral de click/tap */
    '.ytp-click-to-play'
  ].join(',') + ' { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
  document.head.appendChild(style);

  // Re-injeta o CSS após iframes internos carregarem (YouTube usa iframes aninhados)
  var cssInjected = false;
  function injectCssIntoIframes() {
    try {
      var frames = document.querySelectorAll('iframe');
      frames.forEach(function(f) {
        try {
          var doc = f.contentDocument || f.contentWindow.document;
          if (doc && !doc.__ironCssInjected) {
            doc.__ironCssInjected = true;
            var s = doc.createElement('style');
            s.textContent = style.textContent;
            doc.head && doc.head.appendChild(s);
          }
        } catch(e) {}
      });
    } catch(e) {}
  }
  setInterval(injectCssIntoIframes, 800);

  // ---- Detecção de fim e duração ----
  function send(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }

  function notifyEnd() {
    if (endSent) return;
    endSent = true;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    send({ type: 'ENDED' });
  }

  function watchVideo() {
    var v = document.querySelector('video');
    if (!v) {
      setTimeout(watchVideo, 500);
      return;
    }

    function sendDuration() {
      if (!durationSent && v.duration && isFinite(v.duration) && v.duration > 0) {
        durationSent = true;
        send({ type: 'DURATION', value: v.duration });
      }
    }

    v.addEventListener('durationchange', sendDuration);
    v.addEventListener('loadedmetadata', sendDuration);
    sendDuration();

    v.addEventListener('ended', function() { notifyEnd(); });

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(function() {
      if (endSent) { clearInterval(pollInterval); pollInterval = null; return; }
      sendDuration();
      if (v.duration && isFinite(v.duration) && v.duration > 0) {
        send({ type: 'TIME', value: v.currentTime, duration: v.duration });
      }
    }, 1000);
  }

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

  const webviewRef = useRef<WebView>(null);

  const onLoadEnd = useCallback(() => {
    if (endCalledRef.current) return;
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
