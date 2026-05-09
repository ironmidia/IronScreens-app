// Iron Screens — WebView Renderer (Web preview fallback — uses iframe)
import React, { memo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';

interface WebViewRendererProps {
  uri: string;
}

const { width, height } = Dimensions.get('window');

function WebViewRenderer({ uri }: WebViewRendererProps) {
  return (
    <View style={styles.container}>
      <iframe
        src={uri}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#000',
        }}
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
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
});

export default memo(WebViewRenderer);
