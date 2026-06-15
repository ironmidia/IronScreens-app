// Iron Screens — YouTube Renderer (Native)
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

// Margem mínima após fim real do vídeo
const END_MARGIN_MS = 500;
const DEFAULT_WATCHDOG_MS = 120000;
const MAX_WATCHDOG_MS = 300000;

// CSS injetado ANTES do conteúdo para garantir que os controles nunca aparecem
const HIDE_CONTROLS_CSS = `
  .ytp-chrome-bottom,
  .ytp-chrome-top,
  .ytp-gradient-top,
  .ytp-gradient-bottom,
  .ytp-pause-overlay,
  .ytp-pause-overlay-container,
  .ytp-ce-element,
  .ytp-endscreen-content,
  .ytp-watermark,
  .ytp-youtube-button,
  .ytp-title,
  .ytp-autonav-endscreen,
  .ytp-cards-teaser,
  .ytp-cards-button,
  .ytp-contextmenu,
  .ytp-click-to-play,
  .ytp-share-button,
  .ytp-subtitles-button,
  .ytp-settings-button,
  .ytp-size-button,
  .ytp-next-button,
  .ytp-prev-button,
  .ytp-fullerscreen-edu-button,
  .ytp-overflow-button,
  .ytp-button,
  .ytp-iv-player-content,
  .ytp-suggestions-title {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
  }
  /* Esconde toda a UI mas mantém o video visível */
  .html5-video-container video {
    pointer-events: none !important;
  }
`;

// JS injetado ANTES do conteúdo (injectedJavaScriptBeforeContentLoaded)
const BEFORE_JS = `
(function() {
  var s = document.createElement('style');
  s.textContent = ${JSON.stringify(HIDE_CONTROLS_CSS)};
  document.documentElement.appendChild(s);

  // Observer para re-injetar quando novos nós entrarem no DOM
  var observer = new MutationObserver(function() {
    // garante que o style continua no head
    if (!document.head.contains(s)) {
      document.head.appendChild(s);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });
})();
true;
`;

// JS injetado APÓS o conteúdo (injectedJavaScript) para detecção de duração e fim
const AFTER_JS = `
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

  function watchVideo() {
    var v = document.querySelector('video');
    if (!v) { setTimeout(watchVideo, 500); return; }

    function sendDuration() {
      if (!durationSent && v.duration && isFinite(v.duration) && v.duration > 0) {
        durationSent = true;
        send({ type: 'DURATION', value: v.duration });
      }
    }

    v.addEventListener('durationchange', sendDuration);
    v.addEventListener('loadedmetadata', sendDuration);
    sendDuration();
    v.addEventListener('ended', notifyEnd);

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(function() {
      if (endSent) { clearInterval(pollInterval); return; }
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
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    console.log("[YoutubeRenderer] Avançando");
    onEndRef.current?.();
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (endCalledRef.current) return;
      try {
        const msg = JSON.parse(e.nativeEvent.data);

        if (msg.type === "ENDED") {
          console.log("[YoutubeRenderer] ENDED");
          triggerEnd();
          return;
        }

        if (msg.type === "DURATION" && typeof msg.value === "number" && msg.value > 0) {
          console.log("[YoutubeRenderer] Duração real:", msg.value, "s");
          if (!durationArmedRef.current) {
            durationArmedRef.current = true;
            if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
            const watchdogMs = Math.min(msg.value * 1000 + END_MARGIN_MS, MAX_WATCHDOG_MS);
            console.log("[YoutubeRenderer] Watchdog armado:", watchdogMs, "ms");
            watchdogRef.current = setTimeout(() => {
              console.warn("[YoutubeRenderer] Watchdog disparou");
              triggerEnd();
            }, watchdogMs);
          }
          return;
        }

        if (msg.type === "TIME" && typeof msg.value === "number" && typeof msg.duration === "number" && msg.duration > 0) {
          if (msg.value >= msg.duration - 0.5) {
            console.log("[YoutubeRenderer] TIME perto do fim");
            triggerEnd();
          }
        }
      } catch {
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd],
  );

  const onLoadEnd = useCallback(() => {
    if (endCalledRef.current || watchdogRef.current) return;
    console.log("[YoutubeRenderer] Watchdog inicial:", DEFAULT_WATCHDOG_MS, "ms");
    watchdogRef.current = setTimeout(() => {
      console.warn("[YoutubeRenderer] Watchdog inicial disparou");
      triggerEnd();
    }, DEFAULT_WATCHDOG_MS);
  }, [triggerEnd]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embedUri, headers: { Referer: REFERRER, Origin: REFERRER } }}
        userAgent={TV_UA}
        style={styles.webview}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        // Injetado ANTES do conteúdo — esconde controles desde o início
        injectedJavaScriptBeforeContentLoaded={BEFORE_JS}
        // Injetado APÓS — detecção de fim e duração
        injectedJavaScript={AFTER_JS}
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
      {/* Overlay transparente sobre o WebView: bloqueia qualquer toque que
          pudesse revelar os controles do YouTube */}
      <View style={styles.overlay} pointerEvents="box-only" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 10,
  },
});

export default memo(YoutubeRenderer);
