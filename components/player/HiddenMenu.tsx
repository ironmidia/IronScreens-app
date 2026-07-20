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
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { APP_VERSION } from '@/constants/config';

const { width } = Dimensions.get('window');

interface HiddenMenuProps {
  visible: boolean;
  terminalName: string | null;
  terminalId: string | null;
  simulateRotation: boolean;
  onClose: () => void;
  onChangeTerminal: () => void;
  onReload: () => void;
  onToggleSimulateRotation: (next: boolean) => void;
}

function HiddenMenu({
  visible,
  terminalName,
  terminalId,
  simulateRotation,
  onClose,
  onChangeTerminal,
  onReload,
  onToggleSimulateRotation,
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
    setTimeout(() => onReload(), 200);
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

          {/* Header — Logo + fechar */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/Logo_menor_branco.png')}
              style={styles.logo}
              contentFit="contain"
            />
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

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Rotação simulada</Text>
              <Text style={styles.toggleHint}>
                Ative só se essa caixa não gira a tela sozinha
              </Text>
            </View>
            <Switch
              value={simulateRotation}
              onValueChange={onToggleSimulateRotation}
              trackColor={{ true: Colors.Primary }}
            />
          </View>

          <View style={styles.divider} />

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
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.SurfaceElevated,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logo: {
    height: 28,
    width: 120,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  infoText: { flex: 1 },
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.SurfaceElevated,
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
    color: Colors.TextFaint,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  toggleHint: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
});

export default memo(HiddenMenu);
