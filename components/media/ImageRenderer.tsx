// Iron Screens — Image Renderer
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

interface ImageRendererProps {
  uri: string;
}

function ImageRenderer({ uri }: ImageRendererProps) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // ─── Transparente (não preto) pra deixar o backdrop de transição do
    // player (app/player.tsx) aparecer durante o instante em que a imagem
    // ainda está decodificando, em vez de mostrar um flash de tela preta.
    backgroundColor: 'transparent',
  },
  image: {
    flex: 1,
  },
});

export default memo(ImageRenderer);
