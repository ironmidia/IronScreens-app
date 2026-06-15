// Iron Screens — Instagram Renderer (Native)
//
// Duração: o renderer aguarda o fim natural do vídeo via evento 'ended'
// do elemento <video> e então chama onEnd().
// O player.tsx NÃO arma timer para type=instagram — ver VIDEO_EVENT_TYPES.
import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const TV_UA =
  'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) ' +
  'AppleWebKit/538.1 (KHTML, like Gecko) ' +
  'Version/6.0 TV Safari/538.1';

function toEmbedUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname.includes('instagram.com')) {
      const path = url.pathname
        .replace(/\/+$/, '')
        .replace(/\/embed(\/captioned)?$/, '');
      url.pathname = path + '/embed/captioned/';
      url.search = '';
      url.hash = '';
      return url.toString();
    }
  } catch {
    // URI inválida — retorna como está
  }
  return uri;
}

const HIDE_UI_CSS = [
  '._acan', '._acao', '._acap', '._acas', '._acat',
  '._acax', '._acay', '._acaz', '._acau', '._acav', '._acaw',
  'header', 'footer', 'nav',
  '[role="banner"]', '[role="navigation"]', '[role="contentinfo"]',
  '.EmbedIGCoreCaption', '.EmbedSocialContext',
  '._9zmk', '.x1lliihq.x1plvlek',
].join(',');

// JS injetado antes do conteúdo carregar.
// Além de esconder a UI social e forçar tela cheia,
// ouve o evento 'ended' no <video> e envia 'ENDED' para o React Native.
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

  function setupVideo(video) {
    if (video.__iron_setup) return;
    video.__iron_setup = true;
    video.loop = false;  // não faz loop: queremos detectar o fim
    video.muted = false;
    video.playsInline = true;
    video.autoplay = true;

    // Quando o vídeo terminar, avisa o React Native
    video.addEventListener('ended', function() {
      try { window.ReactNativeWebView.postMessage('ENDED'); } catch(e) {}
    });

    var p = video.play();
    if (p && typeof p.then === 'function') {
      p.catch(function() {
        video.muted = true;
        video.play().catch(function() {});
      });
    }
  }

  function applyToAll() {
    injectCSS();
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      setupVideo(videos[i]);
    }
  }

  applyToAll();

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

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function() { observer.disconnect(); }, 10000);
})();
true;
`;

interface InstagramRendererProps {
  uri: string;
  onEnd?: () => void;
}

function InstagramRenderer({ uri, onEnd }: InstagramRendererProps) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endCalledRef = useRef(false);

  const embedUrl = toEmbedUrl(uri);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'ENDED' && !endCalledRef.current) {
      endCalledRef.current = true;
      onEndRef.current?.();
    }
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embedUrl }}
        userAgent={TV_UA}
        style={styles.webview}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE}
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
