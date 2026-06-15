import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.documentDirectory}media-cache/`;
const MANIFEST_PATH = `${CACHE_DIR}manifest.json`;

export type CacheManifestItem = {
  mediaId: string;
  playlistItemId: string;
  remoteUrl: string;
  localUri: string;
  type: string;
  updatedAt: string;
};

export type CacheManifest = {
  updatedAt: string;
  items: CacheManifestItem[];
};

function getFileExtension(url: string, fallback = "bin") {
  try {
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();
    return ext && ext.length <= 5 ? ext.toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export async function readCacheManifest(): Promise<CacheManifest> {
  try {
    await ensureCacheDir();
    const info = await FileSystem.getInfoAsync(MANIFEST_PATH);
    if (!info.exists) {
      return { updatedAt: new Date().toISOString(), items: [] };
    }

    const raw = await FileSystem.readAsStringAsync(MANIFEST_PATH);
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), items: [] };
  }
}

export async function writeCacheManifest(manifest: CacheManifest): Promise<void> {
  await ensureCacheDir();
  await FileSystem.writeAsStringAsync(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2),
  );
}

export async function syncMediaFile(params: {
  mediaId: string;
  playlistItemId: string;
  remoteUrl: string;
  type: string;
  updatedAt?: string | null;
}): Promise<CacheManifestItem | null> {
  const { mediaId, playlistItemId, remoteUrl, type, updatedAt } = params;

  if (!remoteUrl) return null;

  await ensureCacheDir();

  const manifest = await readCacheManifest();
  const current = manifest.items.find(
    (item) =>
      item.mediaId === mediaId &&
      item.playlistItemId === playlistItemId &&
      item.remoteUrl === remoteUrl &&
      item.updatedAt === (updatedAt || ""),
  );

  if (current) {
    const fileInfo = await FileSystem.getInfoAsync(current.localUri);
    if (fileInfo.exists) {
      return current;
    }
  }

  const ext =
    type === "image"
      ? getFileExtension(remoteUrl, "jpg")
      : type === "video"
        ? getFileExtension(remoteUrl, "mp4")
        : getFileExtension(remoteUrl);

  const localUri = `${CACHE_DIR}${playlistItemId}-${mediaId}.${ext}`;
  const tempUri = `${localUri}.download`;

  const existing = await FileSystem.getInfoAsync(localUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }

  const tempExists = await FileSystem.getInfoAsync(tempUri);
  if (tempExists.exists) {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  }

  const result = await FileSystem.downloadAsync(remoteUrl, tempUri);
  if (result.status !== 200) {
    throw new Error(`Falha ao baixar mídia: HTTP ${result.status}`);
  }

  await FileSystem.moveAsync({
    from: tempUri,
    to: localUri,
  });

  const manifestItem: CacheManifestItem = {
    mediaId,
    playlistItemId,
    remoteUrl,
    localUri,
    type,
    updatedAt: updatedAt || "",
  };

  const filtered = manifest.items.filter(
    (item) => !(item.mediaId === mediaId && item.playlistItemId === playlistItemId),
  );

  const nextManifest: CacheManifest = {
    updatedAt: new Date().toISOString(),
    items: [...filtered, manifestItem],
  };

  await writeCacheManifest(nextManifest);
  return manifestItem;
}

export async function syncPlaylistMediaCache(
  items: Array<{
    playlistItemId: string;
    media: {
      id: string;
      type: string;
      file_url?: string | null;
      updated_at?: string | null;
    };
  }>,
): Promise<Record<string, string>> {
  const manifest = await readCacheManifest();
  const validKeys = new Set<string>();
  const localMap: Record<string, string> = {};

  for (const item of items) {
    const remoteUrl = item.media.file_url;
    const type = item.media.type;

    if (!remoteUrl || !["image", "video"].includes(type)) continue;

    try {
      const cached = await syncMediaFile({
        mediaId: item.media.id,
        playlistItemId: item.playlistItemId,
        remoteUrl,
        type,
        updatedAt: item.media.updated_at || null,
      });

      if (cached) {
        const key = `${item.playlistItemId}:${item.media.id}`;
        validKeys.add(key);
        localMap[key] = cached.localUri;
      }
    } catch (error) {
      console.warn("[Cache] Falha ao sincronizar mídia:", remoteUrl, error);
    }
  }

  const nextItems = manifest.items.filter((item) => {
    const key = `${item.playlistItemId}:${item.mediaId}`;
    return validKeys.has(key);
  });

  const nextManifest: CacheManifest = {
    updatedAt: new Date().toISOString(),
    items: nextItems,
  };

  await writeCacheManifest(nextManifest);

  return localMap;
}

export async function getCachedUri(
  playlistItemId: string,
  mediaId: string,
): Promise<string | null> {
  const manifest = await readCacheManifest();
  const found = manifest.items.find(
    (item) =>
      item.playlistItemId === playlistItemId &&
      item.mediaId === mediaId,
  );

  if (!found) return null;

  const info = await FileSystem.getInfoAsync(found.localUri);
  return info.exists ? found.localUri : null;
}
