// Iron Screens — Teclado na tela navegável por controle remoto (D-pad)
// Usado na tela de PIN: controles de TV geralmente só têm setas + OK, sem
// teclado físico, então o PIN alfanumérico precisa de um jeito de ser
// digitado sem toque. Uma única grade de foco cobre Voltar + teclas +
// Apagar/Confirmar, para a navegação fluir sem "buracos".
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useDpadGridFocus } from '@/hooks/useDpadGridFocus';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.slice(0, 36);
const COLS = 6;
const KEY_ROWS: string[][] = [];
for (let i = 0; i < KEYS.length; i += COLS) {
  KEY_ROWS.push(KEYS.slice(i, i + COLS).split(''));
}

// row 0 = Voltar · rows 1..6 = teclado · última linha = Apagar / Confirmar
const LAYOUT = [1, ...KEY_ROWS.map(() => COLS), 2];
const ACTION_ROW = LAYOUT.length - 1;

interface DpadKeyboardProps {
  value: string;
  maxLength: number;
  onChangeValue: (next: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  confirmDisabled: boolean;
  confirming: boolean;
  enabled: boolean;
}

export default function DpadKeyboard({
  value,
  maxLength,
  onChangeValue,
  onConfirm,
  onBack,
  confirmDisabled,
  confirming,
  enabled,
}: DpadKeyboardProps) {
  const handleSelect = (row: number, col: number) => {
    if (row === 0) {
      onBack();
      return;
    }
    if (row === ACTION_ROW) {
      if (col === 0) onChangeValue(value.slice(0, -1));
      else if (!confirmDisabled) onConfirm();
      return;
    }
    const char = KEY_ROWS[row - 1]?.[col];
    if (char && value.length < maxLength) {
      onChangeValue(value + char);
    }
  };

  const { isFocused } = useDpadGridFocus(LAYOUT, handleSelect, enabled);

  return (
    <View style={styles.container}>
      <FocusCell focused={isFocused(0, 0)} style={styles.backCell} onPress={onBack}>
        <MaterialIcons name="arrow-back" size={16} color={Colors.TextMuted} />
        <Text style={styles.backText}>Voltar</Text>
      </FocusCell>

      {KEY_ROWS.map((rowChars, rowIdx) => (
        <View key={rowIdx} style={styles.keyRow}>
          {rowChars.map((char, colIdx) => (
            <FocusCell
              key={char}
              focused={isFocused(rowIdx + 1, colIdx)}
              style={styles.key}
              onPress={() => value.length < maxLength && onChangeValue(value + char)}
            >
              <Text style={styles.keyText}>{char}</Text>
            </FocusCell>
          ))}
        </View>
      ))}

      <View style={styles.actionRow}>
        <FocusCell
          focused={isFocused(ACTION_ROW, 0)}
          style={styles.actionCell}
          onPress={() => onChangeValue(value.slice(0, -1))}
        >
          <MaterialIcons name="backspace" size={16} color={Colors.TextMuted} />
          <Text style={styles.actionText}>Apagar</Text>
        </FocusCell>
        <FocusCell
          focused={isFocused(ACTION_ROW, 1)}
          style={[styles.actionCell, styles.confirmCell, confirmDisabled && styles.disabledCell]}
          onPress={onConfirm}
          disabled={confirmDisabled}
        >
          <Text style={styles.confirmText}>{confirming ? '...' : 'Confirmar'}</Text>
        </FocusCell>
      </View>
    </View>
  );
}

function FocusCell({
  focused,
  style,
  onPress,
  disabled,
  children,
}: {
  focused: boolean;
  style: any;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, (focused || pressed) && styles.focused]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm, marginTop: Spacing.sm },
  backCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  backText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm },
  keyRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center' },
  key: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 2,
    borderColor: Colors.Border,
  },
  keyText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 2,
    borderColor: Colors.Border,
  },
  actionText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm },
  confirmCell: { backgroundColor: Colors.Primary, borderColor: Colors.Primary },
  confirmText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  disabledCell: { opacity: 0.4 },
  focused: {
    borderColor: Colors.TextPrimary,
    // leve destaque adicional pra ficar bem visível numa TV a alguns metros
    shadowColor: Colors.TextPrimary,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
