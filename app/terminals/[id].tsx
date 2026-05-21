// Iron Screens — Detalhe do Terminal
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import {
  fetchTerminalById,
  sendRemoteCommand,
  updateTerminal,
} from '@/services/terminalService';
import { fetchTerminals } from '@/services/terminalService';
import { Terminal, Playlist } from '@/services/models';
import { supabase } from '@/services/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function typeLabel(type: Terminal['type']) {
  const map: Record<Terminal['type'], string> = {
    tv_horizontal: 'TV Horizontal',
    tv_vertical:   'TV Vertical',
    led_panel:     'Painel LED',
  };
  return map[type] ?? type;
}

// ─── Botão de ação ────────────────────────────────────────────────────────────
function ActionButton({
  icon, label, color = Colors.TextSecondary, onPress, disabled = false,
}: {
  icon: string; label: string; color?: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        pressed && styles.actionBtnPressed,
        disabled && styles.actionBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon as any} size={22} color={disabled ? Colors.TextFaint : color} />
      <Text style={[styles.actionLabel, disabled && { color: Colors.TextFaint }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Linha de info ────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function TerminalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmdLoading, setCmdLoading] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [playlistModal, setPlaylistModal] = useState(false);
  const [screenshotModal, setScreenshotModal] = useState(false);

  // Campos do modal de edição
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const t = await fetchTerminalById(id);
      setTerminal(t);
      if (t) {
        setEditName(t.name);
        setEditClient(t.client ?? '');
        setEditLocation(t.location ?? '');
        // Buscar playlists do terminal
        const { data } = await supabase
          .from('playlists')
          .select('*')
          .eq('terminal_id', t.id)
          .order('created_at', { ascending: false });
        setPlaylists((data as Playlist[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: atualiza terminal quando dados mudam (screenshot, status, etc)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`terminal-detail-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'terminals',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setTerminal((prev) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleCommand = async (cmd: 'RELOAD' | 'RESTART' | 'SCREENSHOT') => {
    if (!terminal) return;
    const labels: Record<string, string> = {
      RELOAD:     'Recarregar playlist',
      RESTART:    'Reiniciar player',
      SCREENSHOT: 'Capturar screenshot',
    };
    Alert.alert(
      labels[cmd],
      `Enviar comando "${cmd}" para ${terminal.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setCmdLoading(cmd);
            try {
              await sendRemoteCommand(terminal.id, cmd);
              if (cmd === 'SCREENSHOT') {
                setScreenshotModal(true);
              }
            } catch (e: any) {
              Alert.alert('Erro', e.message);
            } finally {
              setCmdLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!terminal || !editName.trim()) return;
    setEditSaving(true);
    try {
      await updateTerminal(terminal.id, {
        name: editName.trim(),
        client: editClient.trim() || null,
        location: editLocation.trim() || null,
      });
      setTerminal((prev) => prev ? {
        ...prev,
        name: editName.trim(),
        client: editClient.trim() || null,
        location: editLocation.trim() || null,
      } : prev);
      setEditModal(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.Primary} />
      </View>
    );
  }

  if (!terminal) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Terminal não encontrado.</Text>
      </View>
    );
  }

  const isOnline = terminal.status === 'online';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{terminal.name}</Text>
        <Pressable onPress={() => setEditModal(true)} style={styles.backBtn}>
          <Ionicons name="settings-outline" size={22} color={Colors.TextSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <View>
            <Text style={[styles.statusText, isOnline ? styles.textOnline : styles.textOffline]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <Text style={styles.heartbeatText}>
              Último heartbeat: {formatDate(terminal.last_heartbeat)}
            </Text>
          </View>
        </View>

        {/* Ações remotas */}
        <Text style={styles.sectionTitle}>Comandos Remotos</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="refresh-circle-outline"
            label="Recarregar"
            color={Colors.Primary}
            onPress={() => handleCommand('RELOAD')}
            disabled={!isOnline || cmdLoading !== null}
          />
          <ActionButton
            icon="power-outline"
            label="Reiniciar"
            color={Colors.Warning}
            onPress={() => handleCommand('RESTART')}
            disabled={!isOnline || cmdLoading !== null}
          />
          <ActionButton
            icon="camera-outline"
            label="Screenshot"
            color={Colors.TextSecondary}
            onPress={() => {
              if (terminal.last_screenshot_url) {
                setScreenshotModal(true);
              } else {
                handleCommand('SCREENSHOT');
              }
            }}
            disabled={!isOnline || cmdLoading !== null}
          />
          <ActionButton
            icon="list-outline"
            label="Playlists"
            color={Colors.TextSecondary}
            onPress={() => setPlaylistModal(true)}
          />
        </View>

        {cmdLoading && (
          <View style={styles.cmdRow}>
            <ActivityIndicator size="small" color={Colors.Primary} />
            <Text style={styles.cmdText}>Enviando comando {cmdLoading}...</Text>
          </View>
        )}

        {/* Informações gerais */}
        <Text style={styles.sectionTitle}>Informações</Text>
        <View style={styles.infoCard}>
          <InfoRow label="ID" value={terminal.id} />
          <InfoRow label="Tipo" value={typeLabel(terminal.type)} />
          <InfoRow label="Orientação" value={terminal.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} />
          <InfoRow label="Cliente" value={terminal.client ?? '—'} />
          <InfoRow label="Localização" value={terminal.location ?? '—'} />
          <InfoRow label="Device ID" value={terminal.device_id ?? '—'} />
          <InfoRow label="PIN" value={terminal.setup_pin ?? '—'} />
          <InfoRow label="Criado em" value={formatDate(terminal.created_at)} />
          <InfoRow label="Atualizado em" value={formatDate(terminal.updated_at)} />
        </View>

        {/* Último screenshot */}
        {terminal.last_screenshot_url && (
          <>
            <Text style={styles.sectionTitle}>Último Screenshot</Text>
            <Pressable
              style={styles.screenshotThumb}
              onPress={() => setScreenshotModal(true)}
            >
              <Image
                source={{ uri: terminal.last_screenshot_url }}
                style={styles.screenshotImg}
                resizeMode="cover"
              />
              <Text style={styles.screenshotDate}>
                Capturado em: {formatDate(terminal.last_screenshot_at)}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Modal de configurações */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Configurações do Terminal</Text>

            <Text style={styles.inputLabel}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nome do terminal"
              placeholderTextColor={Colors.TextFaint}
            />

            <Text style={styles.inputLabel}>Cliente</Text>
            <TextInput
              style={styles.input}
              value={editClient}
              onChangeText={setEditClient}
              placeholder="Nome do cliente"
              placeholderTextColor={Colors.TextFaint}
            />

            <Text style={styles.inputLabel}>Localização</Text>
            <TextInput
              style={styles.input}
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Ex: Recepção - 2º andar"
              placeholderTextColor={Colors.TextFaint}
            />

            <Text style={styles.inputLabel}>Tipo: {typeLabel(terminal.type)}</Text>
            <Text style={styles.inputLabel}>Orientação: {terminal.orientation}</Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveText}>Salvar</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de playlists */}
      <Modal visible={playlistModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Playlists do Terminal</Text>
            {playlists.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma playlist vinculada.</Text>
            ) : (
              playlists.map((p) => (
                <View key={p.id} style={styles.playlistRow}>
                  <Ionicons name="play-circle-outline" size={18} color={Colors.Primary} />
                  <Text style={styles.playlistName}>{p.name}</Text>
                  <Text style={styles.playlistDate}>{formatDate(p.created_at)}</Text>
                </View>
              ))
            )}
            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => setPlaylistModal(false)}
            >
              <Text style={styles.modalCancelText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de screenshot */}
      <Modal visible={screenshotModal} transparent animationType="fade">
        <View style={styles.screenshotOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setScreenshotModal(false)}
          />
          {terminal.last_screenshot_url ? (
            <Image
              source={{ uri: terminal.last_screenshot_url }}
              style={styles.screenshotFull}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.screenshotWaiting}>
              <ActivityIndicator color={Colors.Primary} />
              <Text style={styles.screenshotWaitText}>
                Aguardando o terminal capturar a tela...
              </Text>
            </View>
          )}
          <Pressable
            style={styles.screenshotClose}
            onPress={() => setScreenshotModal(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.Background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.Background },
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
  backBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    flex: 1,
    textAlign: 'center',
  },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotOnline: { backgroundColor: Colors.Online },
  dotOffline: { backgroundColor: Colors.Offline },
  statusText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold },
  textOnline: { color: Colors.Online },
  textOffline: { color: Colors.Offline },
  heartbeatText: { color: Colors.TextMuted, fontSize: Typography.sizes.xs, marginTop: 2 },
  sectionTitle: {
    color: Colors.TextSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionBtnPressed: { opacity: 0.65 },
  actionBtnDisabled: { opacity: 0.35 },
  actionLabel: {
    color: Colors.TextSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
  },
  cmdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cmdText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm },
  infoCard: {
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Border,
  },
  infoLabel: { color: Colors.TextMuted, fontSize: Typography.sizes.sm },
  infoValue: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    maxWidth: '60%',
    textAlign: 'right',
  },
  screenshotThumb: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  screenshotImg: { width: '100%', height: 180 },
  screenshotDate: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.Surface4,
  },
  emptyText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm, textAlign: 'center', marginVertical: Spacing.md },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.Overlay,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.Surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: {
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.Surface4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.Border,
    color: Colors.TextPrimary,
    fontSize: Typography.sizes.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { color: Colors.TextSecondary, fontWeight: Typography.weights.semibold },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.Primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontWeight: Typography.weights.bold },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Border,
  },
  playlistName: { flex: 1, color: Colors.TextPrimary, fontSize: Typography.sizes.sm },
  playlistDate: { color: Colors.TextFaint, fontSize: Typography.sizes.xs },
  // Screenshot modal
  screenshotOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenshotFull: { width: '95%', height: '75%' },
  screenshotWaiting: { alignItems: 'center', gap: Spacing.md },
  screenshotWaitText: { color: Colors.TextMuted, fontSize: Typography.sizes.sm, textAlign: 'center', maxWidth: 260 },
  screenshotClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 6,
  },
});
