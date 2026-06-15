// Iron Screens — Instagram Renderer (Native)
//
// Objetivo: reproduzir o vídeo do Reel/Post do Instagram como se fosse um
// vídeo nativo — tela cheia, sem UI social, autoplay com loop.
//
// Estratégia:
//   1. Normaliza qualquer URL do Instagram para /embed/captioned/
//      (remove query params como igsh= e utm_source= que causam redirect
//       para o app ou para a página de login)
//
//   2. User-Agent de Smart TV → o Instagram serve o embed sem exigir login
//      e sem o cookie-gate que aparece para UAs de browser desktop/mobile
//
//   3. injectedJavaScriptBeforeContentLoaded → injetado ANTES do HTML ser
//      parseado; captura o vídeo assim que o DOM é criado, sem race condition
//
//   4. O JS injetado:
//      a) Esconde todos os elementos de UI social via CSS dinâmico
//      b) Força o elemento <video> a ocupar 100vw × 100vh com position:fixed
//      c) Chama .play() com fallback muted para contornar a política de autoplay
//      d) Observa mutações do DOM (MutationObserver) para re-aplicar quando
//         o Instagram renderiza conteúdo de forma lazy/async
import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// UA de Smart TV — bypass do login-gate do Instagram embed
const TV_UA =
  'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) ' +
  'AppleWebKit/538.1 (KHTML, like Gecko) ' +
  'Version/6.0 TV Safari/538.1';

/**
 * Normaliza qualquer URL do Instagram para o formato /embed/captioned/
 * Suporta: /reel/, /p/, /tv/
 * Remove TODOS os query params (igsh, utm_source, img_index, etc.)
 */
function toEmbedUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname.includes('instagram.com')) {
      // Remove sufixo /embed ou /embed/captioned se já existir
      const path = url.pathname
        .replace(/\/+$/, '')
        .replace(/\/embed(\/captioned)?$/, '');
      url.pathname = path + '/embed/captioned/';
      // Remove TODOS os query params — qualquer param pode causar redirect
      url.search = '';
      url.hash = '';
      return url.toString();
    }
  } catch {
    // URI inválida — retorna como está
  }
  return uri;
}

/**
 * CSS que esconde toda a UI social do Instagram /embed/captioned/
 * e força o vídeo a ocupar 100% da tela.
 *
 * As classes ._ac* são as classes internas do Instagram embed;
 * combinamos com seletores semânticos para robustez.
 */
const HIDE_UI_CSS = [
  // Classes internas do Instagram embed (UI social)
  '._acan', '._acao', '._acap', '._acas', '._acat',
  '._acax', '._acay', '._acaz', '._acau', '._acav', '._acaw',
  // Seletores semânticos
  'header', 'footer', 'nav',
  '[role="banner"]', '[role="navigation"]', '[role="contentinfo"]',
  // Caption e controles
  '.EmbedIGCoreCaption', '.EmbedSocialContext',
  // Botão de play overlay (o vídeo deve tocar sozinho)
  '._9zmk', '.x1lliihq.x1plvlek',
].join(',');

/**
 * JS injetado ANTES do conteúdo carregar.
 * Usa MutationObserver para capturar o vídeo assim que aparecer no DOM.
 */
const INJECTED_JS_BEFORE = `
(function() {
  'use strict';

  function injectCSS() {
    var existing = document.getElementById('__iron_css');
    if (existing) return;
    var s = document.createElement('style');
    s.id = '__iron_css';
    s.textContent = [
      '${HIDE_UI_CSS} { display: none !important; }',
      'html, body { background: #000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }',
      'video {',
      '  position: fixed !important;',
      '  top: 0 !important; left: 0 !important;',
      '  width: 100vw !important; height: 100vh !important;',
      '  object-fit: cover !important;',
      '  z-index: 9999 !important;',
      '  pointer-events: none !important;',
      '}',
    ].join('\\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function playVideo(video) {
    video.loop = true;
    video.muted = false;
    video.playsInline = true;
    video.autoplay = true;
    var p = video.play();
    if (p && typeof p.then === 'function') {
      p.catch(function() {
        // Fallback: muted permite autoplay em qualquer contexto
        video.muted = true;
        video.play().catch(function() {});
      });
    }
  }

  function applyToAll() {
    injectCSS();
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      playVideo(videos[i]);
    }
  }

  // Aplica imediatamente
  applyToAll();

  // MutationObserver para capturar vídeos que carregam de forma lazy
  var observer = new MutationObserver(function(mutations) {
    var hasVideo = false;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
          hasVideo = true;
          break;
        }
      }
      if (hasVideo) break;
    }
    if (hasVideo) applyToAll();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Segurança: para de observar após 10s para não vazar memória
  setTimeout(function() { observer.disconnect(); }, 10000);
})();
true;
`;

interface InstagramRendererProps {
  uri: string;
}

function InstagramRenderer({ uri }: InstagramRendererProps) {
  const embedUrl = toEmbedUrl(uri);

  const onMessage = useCallback((_e: WebViewMessageEvent) => {
    // reservado para comunicação futura
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embedUrl }}
        userAgent={TV_UA}
        style={styles.webview}
        onMessage={onMessage}
        // injectedJavaScriptBeforeContentLoaded → roda antes do HTML ser parseado
        // garante que o CSS e o observer estejam prontos antes de qualquer render
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE}
        // injectedJavaScript → segunda camada de segurança após o DOMContentLoaded
        injectedJavaScript={INJECTED_JS_BEFORE}
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

export default memo(InstagramRenderer);
