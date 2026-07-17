// Iron Screens — Terminal Setup Screen (v2: PIN validation)
import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSetup } from '@/hooks/useSetup';
import { Terminal } from '@/services/models';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useDpadGridFocus } from '@/hooks/useDpadGridFocus';

const { width } = Dimensions.get('window');

const TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  tv_horizontal: 'tv',
  tv_vertical: 'smartphone',
  led_panel: 'view-module',
};

const TYPE_LABELS: Record<string, string> = {
  tv_horizontal: 'TV Horizontal',
  tv_vertical: 'TV Vertical',
  led_panel: 'Painel LED',
};

export default function SetupScreen() {
  const router = useRouter();
  const [state, actions] = useSetup();
  const pinInputRef = useRef<TextInput>(null);

  const prevConfirming = useRef(false);
  React.useEffect(() => {
    if (prevConfirming.current && !state.confirming && !state.error && state.savedTerminalId) {
      router.replace('/player');
    }
    prevConfirming.current = state.confirming;
  }, [state.confirming, state.error, state.savedTerminalId, router]);

  // ─── Navegação por controle remoto (D-pad) na lista de terminais ─────────
  // Cada terminal é uma "linha" de 1 coluna só; OK seleciona o terminal em
  // foco. Só fica ativo no passo de seleção — a tela de PIN usa o teclado
  // nativo do Android (o teclado próprio ficava grande demais na TV).
  const terminalListLayout = state.terminals.map(() => 1);
  const { row: terminalFocusRow, isFocused: isTerminalFocused } = useDpadGridFocus(
    terminalListLayout,
    (row) => {
      const terminal = state.terminals[row];
      if (terminal) actions.selectTerminal(terminal);
    },
    state.step === 'select' && !state.loading && state.terminals.length > 0,
  );

  const renderTerminalItem = useCallback(
    ({ item, index }: { item: Terminal; index: number }) => (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          (pressed || isTerminalFocused(index, 0)) && styles.cardPressed,
        ]}
        onPress={() => actions.selectTerminal(item)}
      >
        <View style={styles.cardLeft}>
          <View style={styles.iconBox}>
            <MaterialIcons
              name={TYPE_ICONS[item.type] || 'tv'}
              size={24}
              color={Colors.Primary}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardType}>{TYPE_LABELS[item.type] || item.type}</Text>
            {item.client ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.client}{item.location ? ` · ${item.location}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusDot, item.status === 'online' ? styles.online : styles.offline]} />
          <MaterialIcons name="chevron-right" size={20} color={Colors.TextMuted} />
        </View>
      </Pressable>
    ),
    [actions, isTerminalFocused]
  );

  // ─── STEP: SELECT TERMINAL ───
  const renderSelectStep = () => (
    <>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/Logo_menor_branco.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.headerSubtitle}>Selecione o terminal deste dispositivo</Text>
      </View>

      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.Primary} />
          <Text style={styles.loadingText}>Carregando terminais...</Text>
        </View>
      ) : state.error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color={Colors.Error} />
          <Text style={styles.errorText}>{state.error}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
            onPress={actions.refresh}
          >
            <Text style={styles.retryBtnText}>Tentar Novamente</Text>
          </Pressable>
        </View>
      ) : state.terminals.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="tv-off" size={48} color={Colors.TextMuted} />
          <Text style={styles.emptyText}>Nenhum terminal cadastrado</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
            onPress={actions.refresh}
          >
            <Text style={styles.retryBtnText}>Recarregar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={state.terminals}
          keyExtractor={(item) => item.id}
          renderItem={renderTerminalItem}
          extraData={terminalFocusRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );

  // ─── STEP: ENTER PIN ───
  const renderPinStep = () => {
    const t = state.selectedTerminal!;

    return (
      <KeyboardAvoidingView
        style={styles.pinWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backBtn} onPress={actions.backToSelect}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.TextMuted} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>

        <View style={styles.pinCard}>
          <View style={styles.pinTerminalRow}>
            <View style={styles.iconBox}>
              <MaterialIcons
                name={TYPE_ICONS[t.type] || 'tv'}
                size={24}
                color={Colors.Primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinTerminalName}>{t.name}</Text>
              <Text style={styles.pinTerminalMeta}>
                {TYPE_LABELS[t.type]}{t.client ? ` · ${t.client}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.pinDivider} />

          <Text style={styles.pinLabel}>PIN de Acesso</Text>
          <Text style={styles.pinHint}>
            Digite o PIN de 5 dígitos gerado no sistema Iron Screens
          </Text>

          <TextInput
            ref={pinInputRef}
            style={[
              styles.pinInput,
              state.pinError ? styles.pinInputError : null,
              state.lockedOut ? styles.pinInputDisabled : null,
            ]}
            value={state.pinValue}
            onChangeText={actions.onPinChange}
            placeholder="_ _ _ _ _"
            placeholderTextColor={Colors.TextMuted}
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            editable={!state.lockedOut && !state.confirming}
            autoFocus
          />

          {state.lockedOut ? (
            <View style={styles.lockoutBanner}>
              <MaterialIcons name="lock-clock" size={16} color={Colors.Warning} />
              <Text style={styles.lockoutText}>
                Bloqueado. Tente novamente em {state.lockoutSecondsLeft}s
              </Text>
            </View>
          ) : state.pinError ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={14} color={Colors.Error} />
              <Text style={styles.pinErrorText}>{state.pinError}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              (state.lockedOut || state.confirming || state.pinValue.length !== 5) && styles.confirmBtnDisabled,
              pressed && !state.lockedOut && styles.confirmBtnPressed,
            ]}
            onPress={actions.confirmPin}
            disabled={state.lockedOut || state.confirming || state.pinValue.length !== 5}
          >
            {state.confirming ? (
              <ActivityIndicator color={Colors.TextPrimary} size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirmar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {state.step === 'select' ? renderSelectStep() : renderPinStep()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.Background },
  safe: { flex: 1 },

  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  logo: { width: 160, height: 56, marginBottom: Spacing.xs },
  headerSubtitle: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },

  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  separator: { height: Spacing.sm },

  card: {
    backgroundColor: Colors.Surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  cardPressed: { backgroundColor: Colors.SurfaceElevated, borderColor: Colors.Primary },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.SurfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  cardInfo: { flex: 1 },
  cardName: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    marginBottom: 2,
  },
  cardType: {
    color: Colors.Primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    marginBottom: 2,
  },
  cardMeta: { color: Colors.TextMuted, fontSize: Typography.sizes.xs },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginLeft: Spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  online: { backgroundColor: Colors.Online },
  offline: { backgroundColor: Colors.Offline },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm, marginTop: Spacing.sm },
  errorText: { color: Colors.Error, fontSize: Typography.sizes.sm, textAlign: 'center', lineHeight: 22 },
  emptyText: { color: Colors.TextMuted, fontSize: Typography.sizes.base, textAlign: 'center' },

  retryBtn: {
    backgroundColor: Colors.Primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  retryBtnPressed: { backgroundColor: Colors.PrimaryDark },
  retryBtnText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },

  pinWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
    padding: Spacing.xs,
  },
  backBtnText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm },

  pinCard: {
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    gap: Spacing.sm,
  },
  pinTerminalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pinTerminalName: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  pinTerminalMeta: { color: Colors.TextMuted, fontSize: Typography.sizes.xs, marginTop: 2 },
  pinDivider: { height: 1, backgroundColor: Colors.Border, marginVertical: Spacing.sm },

  pinLabel: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  pinHint: { color: Colors.TextMuted, fontSize: Typography.sizes.xs, lineHeight: 18 },

  pinInput: {
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.Primary,
    borderRadius: Radius.md,
    color: Colors.TextPrimary,
    fontSize: 26,
    fontWeight: Typography.weights.bold,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  pinInputError: { borderColor: Colors.Error },
  pinInputDisabled: { borderColor: Colors.Border, opacity: 0.5 },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pinErrorText: { color: Colors.Error, fontSize: Typography.sizes.xs, flex: 1 },

  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: 4,
  },
  lockoutText: { color: Colors.Warning, fontSize: Typography.sizes.xs, flex: 1 },

  confirmBtn: {
    backgroundColor: Colors.Primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  confirmBtnPressed: { backgroundColor: Colors.PrimaryDark },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
});
