// Iron Screens — News Renderer (playlist item flagged as a news article)
import React, { memo, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLogicalWindowDimensions } from '@/hooks/useLogicalWindowDimensions';

const NEWS_CATEGORY_PREFIX = 'Notícias - ';

const logoSource = require('../../assets/images/Iron_icon.png');

// Cor de tema por categoria — usada na faixa do título e no nome da categoria.
const CATEGORY_THEME: Record<string, string> = {
  Geral: '#2563EB',
  Esportes: '#16A34A',
  Economia: '#D97706',
  Saúde: '#E11D48',
  'Saúde e Ciência': '#E11D48',
  'Região de Campinas': '#0891B2',
};
const DEFAULT_THEME_COLOR = '#16A34A';

// Texto exibido na tela pode diferir do nome cru da categoria.
const CATEGORY_DISPLAY_LABEL: Record<string, string> = {
  Geral: 'Notícias Gerais',
};

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
  const { width, height } = useLogicalWindowDimensions();
  const isPortrait = height > width;
  const categoryLabel = newsCategoryLabel(category);
  const categoryDisplayLabel = CATEGORY_DISPLAY_LABEL[categoryLabel] ?? categoryLabel;
  const themeColor = CATEGORY_THEME[categoryLabel] ?? DEFAULT_THEME_COLOR;
  const showImage = !!imageUrl && !imageFailed;

  const image = showImage ? (
    <Image
      source={{ uri: imageUrl! }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={0}
      cachePolicy="memory-disk"
      onError={() => setImageFailed(true)}
    />
  ) : null;

  // ─── Terminal vertical: mesma estrutura do horizontal, só que empilhada —
  // foto em cima, faixa branca com logo + categoria no meio, faixa colorida
  // com o título embaixo.
  if (isPortrait) {
    return (
      <View style={styles.container}>
        <View style={styles.verticalImageWrap}>{image}</View>

        <View style={styles.topBar}>
          <RNImage source={logoSource} style={styles.logoVertical} resizeMode="contain" />
          <Text
            style={[styles.categoryTextVertical, { color: themeColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {categoryDisplayLabel.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.bottomStripVertical, { backgroundColor: themeColor }]}>
          <Text
            style={styles.titleTextVertical}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {title}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Terminal horizontal: faixa inferior com logo/categoria à esquerda e
  // título sobre a cor do tema à direita.
  return (
    <View style={styles.container}>
      {image}

      <View style={styles.bottomBar}>
        <View style={styles.leftPanel}>
          <RNImage source={logoSource} style={styles.logo} resizeMode="contain" />
          <Text
            style={[styles.categoryText, { color: themeColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
          >
            {categoryDisplayLabel.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.rightPanel, { backgroundColor: themeColor }]}>
          <Text
            style={styles.titleText}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
          >
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
  topBar: {
    height: '8%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '5%',
    gap: 12,
  },
  logoVertical: {
    width: '30%',
    height: '55%',
  },
  categoryTextVertical: {
    flex: 1,
    fontFamily: 'Arial',
    fontWeight: '900',
    fontSize: 24,
    letterSpacing: 0.3,
  },
  verticalImageWrap: {
    flex: 1,
    backgroundColor: '#111',
  },
  bottomStripVertical: {
    minHeight: '20%',
    justifyContent: 'center',
    paddingHorizontal: '6%',
    paddingVertical: 18,
  },
  titleTextVertical: {
    fontFamily: 'Arial',
    fontWeight: '800',
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
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
    paddingHorizontal: '6%',
    paddingVertical: 14,
  },
  logo: {
    width: '100%',
    height: '42%',
    marginBottom: 1,
  },
  categoryText: {
    flex: 1,
    width: '100%',
    fontFamily: 'Arial',
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: 0.3,
    textAlignVertical: 'center',
  },
  rightPanel: {
    flex: 1,
    paddingHorizontal: '4.5%',
    paddingVertical: 10,
  },
  titleText: {
    flex: 1,
    width: '100%',
    fontFamily: 'Arial',
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
    textAlignVertical: 'center',
  },
});

export default memo(NewsRenderer);
