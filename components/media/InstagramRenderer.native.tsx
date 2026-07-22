// Iron Screens — Instagram Renderer (Native)
//
// Duração: o renderer aguarda o fim natural do vídeo via evento 'ended'
// do elemento <video> e então chama onEnd().
// O player.tsx NÃO arma timer para type=instagram — ver VIDEO_EVENT_TYPES.
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';

// ─── Watchdog de segurança: sem isso, se o evento 'ended' do vídeo nunca
// disparar (embed que não carrega, autoplay bloqueado, post do Instagram
// removido/privado, etc.), o item nunca avançava — o player.tsx não arma
// timer nenhum pra type=instagram, então travava pra sempre, sem recovery.
const WATCHDOG_MS = 120000;

// ─── Diferente do YouTube, o Instagram parece tratar o user-agent forjado
// de Smart TV como tráfego suspeito depois de vários embeds recarregados
// em loop no mesmo aparelho, e passa a devolver a tela de LOGIN normal do
// Instagram em vez do embed do post — foi exatamente isso que apareceu
// travado na tela depois de rodar o loop por um tempo. Um user-agent de
// navegador de celular comum é bem menos propenso a acionar essa defesa.
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36';

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
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginDetectedRef = useRef(false);

  const embedUrl = toEmbedUrl(uri);

  const triggerEnd = useCallback(() => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    onEndRef.current?.();
  }, []);

  // ─── Detecta quando o WebView é redirecionado pra fora do embed (ex:
  // .../accounts/login/ ou .../challenge/), o que indica que o Instagram
  // bloqueou o embed em vez de mostrar o post. Sem isso, ficava preso
  // mostrando a tela de login pro resto da sessão (o watchdog de 2min ainda
  // avançaria eventualmente, mas só depois de ficar visível esse tempo
  // todo). Avança direto assim que detecta.
  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    if (loginDetectedRef.current || endCalledRef.current) return;
    const isLoginWall =
      /\/accounts\/login/.test(nav.url) ||
      /\/challenge/.test(nav.url) ||
      /\/accounts\/emailsignup/.test(nav.url);
    if (isLoginWall) {
      loginDetectedRef.current = true;
      console.warn('[InstagramRenderer] Redirecionado pra tela de login, avançando:', nav.url);
      triggerEnd();
    }
  }, [triggerEnd]);

  useEffect(() => {
    console.log('[InstagramRenderer] Montando:', embedUrl);
    endCalledRef.current = false;
    loginDetectedRef.current = false;

    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    console.log('[InstagramRenderer] Watchdog armado:', WATCHDOG_MS, 'ms');
    watchdogRef.current = setTimeout(() => {
      console.warn('[InstagramRenderer] Watchdog disparou, avançando');
      triggerEnd();
    }, WATCHDOG_MS);

    return () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [embedUrl, triggerEnd]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'ENDED' && !endCalledRef.current) {
      console.log('[InstagramRenderer] ENDED recebido');
      triggerEnd();
    }
  }, [triggerEnd]);

  const onError = useCallback((e: any) => {
    console.error('[InstagramRenderer] Erro no WebView:', e?.nativeEvent);
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embedUrl }}
        userAgent={MOBILE_UA}
        style={styles.webview}
        onMessage={onMessage}
        onError={onError}
        onHttpError={onError}
        onNavigationStateChange={onNavigationStateChange}
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
