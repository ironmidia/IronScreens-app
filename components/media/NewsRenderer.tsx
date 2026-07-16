// Iron Screens — News Renderer (playlist item flagged as a news article)
import React, { memo, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

const NEWS_CATEGORY_PREFIX = 'Notícias - ';

const logoSource = require('../../assets/images/Logo_menor_preto.png');

// Cor de tema por categoria — usada na faixa do título e no nome da categoria.
const CATEGORY_THEME: Record<string, string> = {
  Geral: '#2563EB',
  Esportes: '#16A34A',
  Economia: '#D97706',
  Saúde: '#E11D48',
  'Região de Campinas': '#0891B2',
};
const DEFAULT_THEME_COLOR = '#16A34A';

interface NewsRendererProps {
  imageUrl: string | null;
  backgroundUrl: string | null;
  title: string;
  category: string | null;
  source: string | null;
  externalUrl: string | null;
}

export function isNewsMedia(category: string | null | undefined): boolean {
  return !!category?.startsWith(NEWS_CATEGORY_PREFIX);
}

export function newsCategoryLabel(category: string | null | undefined): string {
  return category?.startsWith(NEWS_CATEGORY_PREFIX)
    ? category.slice(NEWS_CATEGORY_PREFIX.length)
    : category || '';
}

function NewsRenderer({ imageUrl, title, category }: NewsRendererProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const categoryLabel = newsCategoryLabel(category);
  const themeColor = CATEGORY_THEME[categoryLabel] ?? DEFAULT_THEME_COLOR;
  const showImage = !!imageUrl && !imageFailed;

  return (
    <View style={styles.container}>
      {showImage && (
        <Image
          source={{ uri: imageUrl! }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={() => setImageFailed(true)}
        />
      )}

      <View style={styles.bottomBar}>
        <View style={styles.leftPanel}>
          <RNImage source={logoSource} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.categoryText, { color: themeColor }]}>
            {categoryLabel.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.rightPanel, { backgroundColor: themeColor }]}>
          <Text style={styles.titleText} numberOfLines={3}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '26%',
    flexDirection: 'row',
  },
  leftPanel: {
    width: '22%',
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: '6%',
    paddingVertical: 18,
  },
  logo: {
    width: '85%',
    height: '34%',
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: 'Arial',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.6,
  },
  rightPanel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: '4.5%',
    paddingVertical: 18,
  },
  titleText: {
    fontFamily: 'Arial',
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
  },
});

export default memo(NewsRenderer);
