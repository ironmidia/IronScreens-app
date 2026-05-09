// Iron Screens — Connection Status Banner
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface ConnectionBannerProps {
  visible: boolean;
}

function ConnectionBanner({ visible }: ConnectionBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner} pointerEvents="none">
      <MaterialIcons name="wifi-off" size={14} color={Colors.TextPrimary} />
      <Text style={styles.text}>Sem conexão — tentando reconectar...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  text: {
    color: Colors.TextSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
});

export default memo(ConnectionBanner);
