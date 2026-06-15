// Iron Screens — Instagram Renderer (Native)
// Carrega o reel/post do Instagram dentro de um HTML wrapper próprio.
// O wrapper injeta CSS que esconde TODA a UI social do embed do Instagram
// e dispara autoplay via postMessage logo após o carregamento.
import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

/**
 * Normaliza qualquer URL do Instagram para o endpoint /embed/captioned/
 * que é público (não pede login) e suporta autoplay por postMessage.
 *   instagram.com/reel/ID/  →  instagram.com/reel/ID/embed/captioned/
 *   instagram.com/p/ID/     →  instagram.com/p/ID/embed/captioned/
 *   instagram.com/tv/ID/    →  instagram.com/tv/ID/embed/captioned/
 */
function toEmbedUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname.includes('instagram.com')) {
      const path = url.pathname.replace(/\/+$/, '');
      const base = path.replace(/\/embed(\/captioned)?$/, '');
      url.pathname = base + '/embed/captioned/';
      url.search = '';
      url.hash = '';
      return url.toString();
    }
  } catch {
    // URL inválida — retorna como está
  }
  return uri;
}

function buildHtml(embedUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #000;
      overflow: hidden;
    }
    iframe {
      width: 100%; height: 100%;
      border: none; display: block;
      background: #000;
    }
  </style>
</head>
<body>
  <iframe
    id="ig"
    src="${embedUrl}"
    allow="autoplay; encrypted-media"
    allowfullscreen="false"
    scrolling="no"
    frameborder="0"
  ></iframe>

  <script>
    var iframe = document.getElementById('ig');

    // Seletores CSS conhecidos da UI social do Instagram /embed/
    var hideSelectors = [
      '._acan', '._acao', '._acap', '._acas', '._acat',
      '._acax', '._acay', '._acaz',
      '._acau', '._acav', '._acaw',
      'header', 'footer', 'nav',
      '[role="banner"]', '[role="navigation"]', '[role="contentinfo"]'
    ].join(',');

    var injectStyle = [
      hideSelectors + ' { display: none !important; }',
      'body { background: #000 !important; overflow: hidden !important; }',
      'video { object-fit: cover !important; width: 100vw !important; height: 100vh !important; }'
    ].join(' ');

    function injectCSS() {
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc || !doc.head) return;
        var existing = doc.getElementById('__iron_hide');
        if (existing) return;
        var style = doc.createElement('style');
        style.id = '__iron_hide';
        style.textContent = injectStyle;
        doc.head.appendChild(style);
      } catch(e) {
        // cross-origin — postMessage é o único canal disponível
      }
    }

    function triggerAutoplay() {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({ type: 'MEDIA_PLAY' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ type: 'PLAY' }), '*');
      } catch(e) {}
    }

    iframe.addEventListener('load', function() {
      injectCSS();
      triggerAutoplay();
      setTimeout(function() { injectCSS(); triggerAutoplay(); }, 800);
      setTimeout(function() { injectCSS(); triggerAutoplay(); }, 2500);
    });
  </script>
</body>
</html>`;
}

interface InstagramRendererProps {
  uri: string;
}

function InstagramRenderer({ uri }: InstagramRendererProps) {
  const webViewRef = useRef<WebView>(null);
  const embedUrl = toEmbedUrl(uri);
  const html = buildHtml(embedUrl);

  const onMessage = useCallback((_e: WebViewMessageEvent) => {
    // reservado para comunicação futura (ex: fim do vídeo)
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        // source={{ html }} com baseUrl evita o redirect de login —
        // o Instagram não detecta o domínio de origem e serve o embed puro
        source={{ html, baseUrl: 'https://www.instagram.com' }}
        userAgent={DESKTOP_UA}
        style={styles.webview}
        onMessage={onMessage}
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
