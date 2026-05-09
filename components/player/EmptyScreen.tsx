// Iron Screens — Empty / No Scheduled Media Screen
import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

function EmptyScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/Logo_menor_branco.png')}
        style={styles.logo}
        contentFit="contain"
        transition={300}
      />
      <Text style={styles.subtitle}>Aguardando conteúdo agendado...</Text>
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: Spacing.lg,
    opacity: 0.75,
  },
  subtitle: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.Primary,
    marginTop: Spacing.xl,
    opacity: 0.6,
  },
});

export default memo(EmptyScreen);
