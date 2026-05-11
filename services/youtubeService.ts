// Iron Screens — YouTube Service

/** Extrai o videoId de qualquer formato de URL do YouTube */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null;
    }
    // youtube.com/watch?v=VIDEO_ID
    const v = parsed.searchParams.get('v');
    if (v) return v;
    // youtube.com/embed/VIDEO_ID
    const match = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (match) return match[1];
  } catch {
    // fallback para regex
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );
    if (m) return m[1];
  }
  return null;
}

/**
 * Monta a URL de embed do YouTube com todos os parâmetros necessários
 * para autoplay silencioso em TVs/quiosques:
 * - autoplay=1        → inicia automaticamente
 * - mute=1            → necessário para autoplay sem interação
 * - controls=0        → sem controles visíveis
 * - loop=1 + playlist → loop infinito (YouTube exige playlist=VIDEO_ID para loop)
 * - playsinline=1     → não entra em fullscreen nativo no Android
 * - rel=0             → sem vídeos relacionados no final
 * - modestbranding=1  → sem logo do YouTube
 * - enablejsapi=1     → habilita API JS (para controle futuro)
 * - iv_load_policy=3  → sem anotações
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: videoId,
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
    iv_load_policy: '3',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
