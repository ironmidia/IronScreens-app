// Iron Screens — WebView Renderer (Native: iOS / Android)
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebViewRendererProps {
  uri: string;
}

// User-Agent de Chrome desktop — evita bloqueios do Instagram e outros sites
// que recusam WebViews Android com UA padrão.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const INJECTED_JS = `
  (function() {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000';

    // Tenta esconder UI nativa do Instagram (header, nav, etc)
    var selectors = [
      'header', 'nav', 'footer',
      '[role="banner"]', '[role="navigation"]',
      '._acaz', // barra inferior do Instagram
    ];
    selectors.forEach(function(sel) {
      var els = document.querySelectorAll(sel);
      els.forEach(function(el) { el.style.display = 'none'; });
    });
  })();
  true;
`;

function WebViewRenderer({ uri }: WebViewRendererProps) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
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
        // Necessário para Instagram carregar mídia corretamente
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
