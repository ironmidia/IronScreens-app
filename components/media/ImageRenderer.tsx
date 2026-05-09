// Iron Screens — Image Renderer
import React, { memo } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface ImageRendererProps {
  uri: string;
}

const { width, height } = Dimensions.get('window');

function ImageRenderer({ uri }: ImageRendererProps) {
  return (
    <Image
      source={{ uri }}
      style={styles.image}
      contentFit="cover"
      transition={0}
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width,
    height,
    backgroundColor: '#000',
  },
});

export default memo(ImageRenderer);
