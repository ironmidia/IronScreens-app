// Iron Screens — WebView Renderer (YouTube / External Link / Instagram)
import React, { memo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebViewRendererProps {
  uri: string;
}

const { width, height } = Dimensions.get('window');

const INJECTED_JS = `
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.backgroundColor = '#000';
  true;
`;

function WebViewRenderer({ uri }: WebViewRendererProps) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.webview}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default memo(WebViewRenderer);
