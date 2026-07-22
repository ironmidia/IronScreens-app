// Iron Screens — YouTube Renderer (Native)
import React, { memo, useRef, useCallback, useEffect } from "react";
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
  startSec?: number | null; // ← novo
  endSec?: number | null; // ← novo
}

const END_MARGIN_MS = 500;
const DEFAULT_WATCHDOG_MS = 120000;
const MAX_WATCHDOG_MS = 300000;

// ─── Seletores de tudo que precisa sumir ─────────────────────────────────────
// Usamos tanto display:none quanto height:0/overflow:hidden porque o YouTube
// consegue sobrescrever display:none via JS inline, mas não consegue sobrescrever
// height:0 + overflow:hidden + pointer-events:none ao mesmo tempo.
const HIDE_SELECTORS = [
  ".ytp-chrome-bottom", // barra com pause / anterior / próximo
  ".ytp-chrome-top", // título e botão de compartilhar
  ".ytp-gradient-top",
  ".ytp-gradient-bottom",
  ".ytp-pause-overlay",
  ".ytp-pause-overlay-container",
  ".ytp-ce-element", // cards de fim de vídeo
  ".ytp-endscreen-content", // tela de sugestões
  ".ytp-watermark", // logo do YouTube
  ".ytp-youtube-button",
  ".ytp-title",
  ".ytp-title-channel",
  ".ytp-title-text",
  ".ytp-autonav-endscreen",
  ".ytp-cards-teaser",
  ".ytp-cards-button",
  ".ytp-contextmenu",
  ".ytp-click-to-play",
  ".ytp-share-button",
  ".ytp-subtitles-button",
  ".ytp-settings-button",
  ".ytp-size-button",
  ".ytp-next-button",
  ".ytp-prev-button",
  ".ytp-fullerscreen-edu-button",
  ".ytp-overflow-button",
  ".ytp-iv-player-content",
  ".ytp-suggestions-title",
  ".ytp-spinner", // spinner do YouTube (usamos o nativo do app)
  ".ytp-button", // qualquer botão genérico do player
  ".ytp-progress-bar-container", // barra de progresso
  ".ytp-time-display", // relógio de tempo
  ".ytp-volume-panel", // controle de volume
  ".ytp-mute-button",
  ".annotation", // anotações antigas
  "#movie_player .ytp-chrome-controls",
].join(",");

// CSS injetado via <style> — primeira camada de defesa.
// !important em tudo + height:0 + overflow:hidden impede que o YouTube
// exiba os controles mesmo se sobrescrever display:none via JS.
const HIDE_CSS = `
  ${HIDE_SELECTORS} {
    display: none !important;
    height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
  }

  /* ─── "Lista branca" em vez de "lista negra": em vez de tentar adivinhar
     o nome de cada elemento de UI (barra de progresso, título, setas de
     navegação do Shorts, botões de like/inscrever etc.), esconde TUDO que
     for filho direto do player além do próprio vídeo. Cobre qualquer
     elemento de UI novo/desconhecido (inclusive o overlay específico do
     Shorts) de uma vez, sem depender de listar cada classe. */
  #movie_player > *:not(.html5-video-container):not(video),
  .html5-video-player > *:not(.html5-video-container):not(video),
  .html5-video-container > *:not(video) {
    display: none !important;
    height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
  }

  html, body {
    background: #000 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    user-select: none !important;
    -webkit-user-select: none !important;
  }

  #movie_player,
  .html5-video-player,
  .html5-video-container {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: #000 !important;
    overflow: hidden !important;
  }

  video {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    object-position: center center !important;
    pointer-events: none !important;
    background: #000 !important;
  }

  iframe {
    border: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }
`;

// JS injetado ANTES do conteúdo carregar.
// Cria o <style> e usa um MutationObserver para re-injetá-lo sempre que o
// YouTube tentar removê-lo ou adicionar novos controles ao DOM.
const BEFORE_JS = `
(function() {
  'use strict';

  var SELECTORS = ${JSON.stringify(HIDE_SELECTORS)};
  var CSS = ${JSON.stringify(HIDE_CSS)};

  // ── Injeta / re-injeta o bloco de CSS ──────────────────────────────────────
  function injectStyle() {
    var existing = document.getElementById('__iron_hide');
    if (existing) {
      existing.textContent = CSS;
      return existing;
    }
    var s = document.createElement('style');
    s.id = '__iron_hide';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
    return s;
  }

  function hideEl(el) {
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('max-height', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
  }

  // ── Aplica estilos inline diretamente nos elementos encontrados ──────────────
  // Mais difícil de sobrescrever do que uma regra CSS porque tem especificidade máxima.
  function applyInline() {
    var els = document.querySelectorAll(SELECTORS);
    for (var i = 0; i < els.length; i++) hideEl(els[i]);

    // ─── Reforça a "lista branca": esconde qualquer filho direto do player
    // que não seja o próprio vídeo (ou o container dele), pego pelo nome
    // real do elemento em vez de uma classe fixa — cobre UI nova/desconhecida
    // (ex: setas de navegação do Shorts) que a lista de seletores acima
    // ainda não conhece.
    var players = document.querySelectorAll('#movie_player, .html5-video-player');
    for (var p = 0; p < players.length; p++) {
      var kids = players[p].children;
      for (var k = 0; k < kids.length; k++) {
        var kid = kids[k];
        if (kid.tagName === 'VIDEO' || kid.classList.contains('html5-video-container')) continue;
        hideEl(kid);
      }
    }
    var containers = document.querySelectorAll('.html5-video-container');
    for (var c = 0; c < containers.length; c++) {
      var vKids = containers[c].children;
      for (var v = 0; v < vKids.length; v++) {
        if (vKids[v].tagName !== 'VIDEO') hideEl(vKids[v]);
      }
    }
  }

  var styleEl = injectStyle();

  // ── MutationObserver: re-aplica sempre que o DOM muda ──────────────────────
  // Observa head E body para capturar quando o YouTube recria controles.
  var debounceTimer = null;
  var observer = new MutationObserver(function() {
    // Re-injeta o style caso tenha sido removido
    if (!document.head || !document.head.contains(styleEl)) {
      styleEl = injectStyle();
    }
    // Aplica inline com debounce para não travar a thread do browser
    if (debounceTimer) return;
    debounceTimer = setTimeout(function() {
      debounceTimer = null;
      applyInline();
    }, 50);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  // ── setInterval: aplica a cada 500ms como última linha de defesa ────────────
  // Garante que mesmo que o MutationObserver perca alguma mudança, os controles
  // sumam rapidamente.
  var intervalId = setInterval(function() {
    injectStyle();
    applyInline();
  }, 500);

  // Para de observar e limpa o intervalo após 30s (vídeo já deve ter iniciado)
  setTimeout(function() {
    clearInterval(intervalId);
    // Mantém o observer rodando para o caso de tela de sugestões no final
  }, 30000);

  // Aplica imediatamente na carga inicial
  injectStyle();
  applyInline();
})();
true;
`;

// JS injetado APÓS o conteúdo — detecção de duração e fim de vídeo.
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

  // Escuta eventos da IFrame API do YouTube como fallback
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

function YoutubeRenderer({
  videoId,
  onEnd,
  startSec,
  endSec,
}: YoutubeRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationArmedRef = useRef(false);

  useEffect(() => {
    endCalledRef.current = false;
    durationArmedRef.current = false;

    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, [videoId, startSec, endSec]);

  const baseUrl = getYouTubeEmbedUrl(videoId, startSec, endSec);
  const embedUri =
    `${baseUrl}` + `&origin=${encodeURIComponent(REFERRER)}` + `&enablejsapi=1`;

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
          console.log("[YoutubeRenderer] ENDED");
          triggerEnd();
          return;
        }

        if (
          msg.type === "DURATION" &&
          typeof msg.value === "number" &&
          msg.value > 0
        ) {
          // ─── Mesmo motivo do guard de TIME: uma duração minúscula/
          // transitória reportada antes dos metadados reais carregarem
          // "travava" aqui (durationArmedRef só aceita a primeira vinda),
          // armando um watchdog quase instantâneo e avançando o vídeo cedo
          // demais. Ignora valores implausíveis e espera uma duração real.
          const MIN_PLAUSIBLE_DURATION_SEC = 5;
          if (msg.value < MIN_PLAUSIBLE_DURATION_SEC) {
            console.log("[YoutubeRenderer] DURATION ignorada (implausível):", msg.value, "s");
            return;
          }

          console.log("[YoutubeRenderer] Duração real:", msg.value, "s");

          if (!durationArmedRef.current) {
            durationArmedRef.current = true;

            if (watchdogRef.current) {
              clearTimeout(watchdogRef.current);
              watchdogRef.current = null;
            }

            const effectiveDurationSec =
              typeof endSec === "number" && endSec > 0
                ? Math.max(
                    0,
                    endSec -
                      (typeof startSec === "number" && startSec > 0
                        ? startSec
                        : 0),
                  )
                : msg.value;

            const watchdogMs = Math.min(
              effectiveDurationSec * 1000 + END_MARGIN_MS,
              MAX_WATCHDOG_MS,
            );

            console.log("[YoutubeRenderer] Watchdog armado:", watchdogMs, "ms");

            watchdogRef.current = setTimeout(() => {
              console.warn("[YoutubeRenderer] Watchdog disparou");
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
          // ─── Logo no início da reprodução, antes dos metadados reais
          // carregarem, o <video> às vezes reporta uma "duration" minúscula/
          // transitória. Se isso coincidir com qualquer buffering inicial
          // (currentTime já > 0), a checagem "perto do fim" batia na hora,
          // disparando um avanço falso que remontava o player do zero —
          // o vídeo "tocava um pouco e voltava a carregar" de novo. Exige
          // uma duração minimamente plausível antes de confiar nela.
          const MIN_PLAUSIBLE_DURATION_SEC = 5;
          if (msg.duration < MIN_PLAUSIBLE_DURATION_SEC) {
            console.log(
              "[YoutubeRenderer] TIME ignorado (duração implausível):",
              msg.value, "/", msg.duration,
            );
            return;
          }
          if (msg.value >= msg.duration - 0.5) {
            console.log(
              "[YoutubeRenderer] TIME perto do fim:", msg.value, "/", msg.duration,
            );
            triggerEnd();
          }
        }
      } catch {
        if (e.nativeEvent.data === "ENDED") triggerEnd();
      }
    },
    [triggerEnd, startSec, endSec],
  );

  const onLoadEnd = useCallback(() => {
    if (endCalledRef.current || watchdogRef.current) return;

    console.log(
      "[YoutubeRenderer] Watchdog inicial:",
      DEFAULT_WATCHDOG_MS,
      "ms",
    );

    watchdogRef.current = setTimeout(() => {
      console.warn("[YoutubeRenderer] Watchdog inicial disparou");
      triggerEnd();
    }, DEFAULT_WATCHDOG_MS);
  }, [triggerEnd]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <WebView
        source={{
          uri: embedUri,
          headers: { Referer: REFERRER, Origin: REFERRER },
        }}
        userAgent={TV_UA}
        style={styles.webview}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        injectedJavaScriptBeforeContentLoaded={BEFORE_JS}
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

      <View style={styles.touchBlocker} pointerEvents="box-only" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  // Ocupa exatamente o mesmo espaço do WebView e fica acima dele (zIndex alto)
  touchBlocker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 999,
  },
});

export default memo(YoutubeRenderer);
