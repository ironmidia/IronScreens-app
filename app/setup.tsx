// Iron Screens — Terminal Setup Screen
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSetup } from '@/hooks/useSetup';
import { Terminal } from '@/services/models';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

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

  const handleSelect = useCallback(
    async (terminal: Terminal) => {
      await actions.selectTerminal(terminal);
      router.replace('/player');
    },
    [actions, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Terminal }) => (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => handleSelect(item)}
        disabled={state.confirming}
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
            {item.client && (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.client}
                {item.location ? ` · ${item.location}` : ''}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusDot, item.status === 'online' ? styles.online : styles.offline]} />
          <MaterialIcons name="chevron-right" size={20} color={Colors.TextMuted} />
        </View>
      </Pressable>
    ),
    [handleSelect, state.confirming]
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/iron-screens-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.headerTitle}>Iron Screens</Text>
          <Text style={styles.headerSubtitle}>Selecione o terminal deste dispositivo</Text>
        </View>

        {/* Content */}
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
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        {/* Confirming overlay */}
        {state.confirming && (
          <View style={styles.confirmingOverlay}>
            <ActivityIndicator size="large" color={Colors.Primary} />
            <Text style={styles.confirmingText}>Configurando terminal...</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.Background,
  },
  safe: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
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
  cardPressed: {
    backgroundColor: Colors.SurfaceElevated,
    borderColor: Colors.Primary,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
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
  cardInfo: {
    flex: 1,
  },
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
  cardMeta: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  online: {
    backgroundColor: Colors.Online,
  },
  offline: {
    backgroundColor: Colors.Offline,
  },
  separator: {
    height: Spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: Colors.Error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.Primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  retryBtnPressed: {
    backgroundColor: Colors.PrimaryDark,
  },
  retryBtnText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  confirmingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.Overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  confirmingText: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
});
