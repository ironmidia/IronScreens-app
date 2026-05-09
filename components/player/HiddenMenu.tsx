// Iron Screens — Hidden Settings Menu (long press overlay)
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { APP_VERSION } from '@/constants/config';

const { width, height } = Dimensions.get('window');

interface HiddenMenuProps {
  visible: boolean;
  terminalName: string | null;
  terminalId: string | null;
  onClose: () => void;
  onChangeTerminal: () => void;
  onReload: () => void;
}

function HiddenMenu({
  visible,
  terminalName,
  terminalId,
  onClose,
  onChangeTerminal,
  onReload,
}: HiddenMenuProps) {
  const handleChangeTerminal = useCallback(() => {
    onClose();
    setTimeout(() => {
      if (Platform.OS === 'web') {
        onChangeTerminal();
      } else {
        Alert.alert(
          'Trocar Terminal',
          'Deseja voltar à tela de seleção de terminal?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Confirmar', onPress: onChangeTerminal },
          ]
        );
      }
    }, 200);
  }, [onClose, onChangeTerminal]);

  const handleReload = useCallback(() => {
    onClose();
    setTimeout(() => {
      onReload();
    }, 200);
  }, [onClose, onReload]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Iron Screens</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={Colors.TextSecondary} />
            </Pressable>
          </View>

          {/* Terminal Info */}
          <View style={styles.infoRow}>
            <MaterialIcons name="tv" size={18} color={Colors.TextMuted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Terminal ativo</Text>
              <Text style={styles.infoValue}>{terminalName || '—'}</Text>
              {terminalId && (
                <Text style={styles.infoId} numberOfLines={1} ellipsizeMode="middle">
                  {terminalId}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Actions */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleReload}
          >
            <MaterialIcons name="refresh" size={20} color={Colors.TextPrimary} />
            <Text style={styles.menuItemText}>Recarregar Playlist</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleChangeTerminal}
          >
            <MaterialIcons name="swap-horiz" size={20} color={Colors.TextPrimary} />
            <Text style={styles.menuItemText}>Trocar Terminal</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Version */}
          <Text style={styles.version}>Versão {APP_VERSION}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.Overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: Math.min(width * 0.85, 360),
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    // Shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  infoValue: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  infoId: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.Border,
    marginVertical: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  menuItemPressed: {
    backgroundColor: Colors.Surface,
  },
  menuItemText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
  version: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});

export default memo(HiddenMenu);
