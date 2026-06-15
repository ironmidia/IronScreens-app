// Iron Screens — WebView Renderer (Native: iOS / Android)
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebViewRendererProps {
  uri: string;
}

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Converte URLs de post do Instagram para o endpoint público de embed,
 * que não exige login.
 *   instagram.com/p/ABC/      → instagram.com/p/ABC/embed/
 *   instagram.com/reel/ABC/   → instagram.com/reel/ABC/embed/
 *   instagram.com/tv/ABC/     → instagram.com/tv/ABC/embed/
 * Qualquer outra URL é retornada sem alteração.
 */
function resolveInstagramEmbedUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname.includes('instagram.com')) {
      // Garante que a rota termina com /embed/
      const path = url.pathname.replace(/\/+$/, '');
      if (!path.endsWith('/embed')) {
        url.pathname = path + '/embed/';
      }
      // Remove parâmetros de query que forçam redirect para login
      url.search = '';
      return url.toString();
    }
  } catch {
    // URI inválida — retorna como está
  }
  return uri;
}

const INJECTED_JS = `
  (function() {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000';
    // Esconde UI de navegação do Instagram
    var selectors = ['header', 'nav', 'footer', '[role="banner"]', '[role="navigation"]', '._acaz'];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) { el.style.display = 'none'; });
    });
  })();
  true;
`;

function WebViewRenderer({ uri }: WebViewRendererProps) {
  const resolvedUri = resolveInstagramEmbedUrl(uri);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: resolvedUri }}
        style={styles.webview}
        userAgent={DESKTOP_USER_AGENT}
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
        mixedContentMode="always"
        thirdPartyCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default memo(WebViewRenderer);
