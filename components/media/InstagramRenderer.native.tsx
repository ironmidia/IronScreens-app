// Iron Screens — Instagram Renderer (Native)
// Estratégia: source={{ uri }} apontando para /embed/captioned/ com
// User-Agent de TV — o Instagram serve o embed puro para dispositivos
// de mídia sem exigir login e com autoplay habilitado.
// O INJECTED_JS oculta toda a UI social (header, footer, botões sociais)
// e força o vídeo a ocupar 100% da tela.
import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// UA de Smart TV — bypass do gate de login do Instagram embed
const TV_UA =
  'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) ' +
  'AppleWebKit/538.1 (KHTML, like Gecko) ' +
  'Version/6.0 TV Safari/538.1';

/**
 * Normaliza qualquer URL do Instagram para /embed/captioned/
 * Suporta: /reel/, /p/, /tv/
 * Remove todos os query params (utm_source, igsh, etc.) que causam redirects
 */
function toEmbedUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname.includes('instagram.com')) {
      const path = url.pathname.replace(/\/+$/, '').replace(/\/embed(\/captioned)?$/, '');
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

// JS injetado após o carregamento:
// 1. Esconde toda a UI social do Instagram embed
// 2. Força o vídeo a ocupar a tela toda e fazer autoplay
const INJECTED_JS = `
(function() {
  function applyStyles() {
    // Esconde UI social — seletores das classes do Instagram /embed/
    var hide = [
      '._acan','._acao','._acap','._acas','._acat',
      '._acax','._acay','._acaz','._acau','._acav','._acaw',
      'header','footer','nav',
      '[role="banner"]','[role="navigation"]','[role="contentinfo"]',
      '.EmbedIGCoreCaption'
    ];
    var style = document.getElementById('__iron_ui_hide');
    if (!style) {
      style = document.createElement('style');
      style.id = '__iron_ui_hide';
      document.head && document.head.appendChild(style);
    }
    style.textContent = hide.join(',') + ' { display: none !important; }\n'
      + 'body, html { background: #000 !important; overflow: hidden !important; margin: 0 !important; }\n'
      + 'video { object-fit: cover !important; width: 100vw !important; height: 100vh !important; position: fixed !important; top: 0 !important; left: 0 !important; }\n'
      + 'div[role="button"] { pointer-events: none !important; }';

    // Força autoplay em todos os vídeos encontrados
    document.querySelectorAll('video').forEach(function(v) {
      v.muted = false;
      v.autoplay = true;
      v.loop = true;
      if (v.paused) v.play().catch(function() { v.muted = true; v.play(); });
    });
  }

  // Aplica imediatamente e a cada 1s por 5s (conteúdo carrega de forma assíncrona)
  applyStyles();
  var count = 0;
  var interval = setInterval(function() {
    applyStyles();
    if (++count >= 5) clearInterval(interval);
  }, 1000);
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
