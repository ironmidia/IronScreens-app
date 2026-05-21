// Iron Screens — Tela de lista de Terminais
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { fetchTerminals } from '@/services/terminalService';
import { Terminal } from '@/services/models';
import { Ionicons } from '@expo/vector-icons';

export default function TerminalsScreen() {
  const router = useRouter();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTerminals();
      setTerminals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }: { item: Terminal }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/terminals/${item.id}`)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.dot, item.status === 'online' ? styles.dotOnline : styles.dotOffline]} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.type.replace('_', ' ').toUpperCase()}
            {item.location ? `  ·  ${item.location}` : ''}
            {item.client ? `  ·  ${item.client}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.statusBadge, item.status === 'online' ? styles.statusOnline : styles.statusOffline]}>
          {item.status === 'online' ? 'ONLINE' : 'OFFLINE'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.TextFaint} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </Pressable>
        <Text style={styles.title}>Terminais</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.Primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={terminals}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.Primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum terminal cadastrado.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.Background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Border,
    backgroundColor: Colors.Surface2,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: { backgroundColor: Colors.Online },
  dotOffline: { backgroundColor: Colors.Offline },
  cardInfo: { flex: 1 },
  cardName: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  cardMeta: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusBadge: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  statusOnline: {
    color: Colors.Online,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  statusOffline: {
    color: Colors.Offline,
    backgroundColor: 'rgba(85,85,85,0.2)',
  },
  empty: {
    color: Colors.TextMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: Typography.sizes.sm,
  },
});
