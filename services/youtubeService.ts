// Iron Screens — YouTube Service

/**
 * Extrai o videoId de qualquer formato de URL do YouTube:
 *   - youtube.com/watch?v=ID
 *   - youtube.com/shorts/ID
 *   - youtu.be/ID
 *   - youtube.com/embed/ID
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null;
    }
    // watch?v=ID
    const v = parsed.searchParams.get('v');
    if (v) return v;
    // /shorts/ID  ou  /embed/ID
    const match = parsed.pathname.match(/\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  } catch {
    // fallback regex para URLs malformadas
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );
    if (m) return m[1];
  }
  return null;
}

/**
 * Gera a URL de embed do YouTube.
 * Funciona tanto para vídeos normais quanto para Shorts —
 * o endpoint /embed/ID é o mesmo para ambos os formatos.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return (
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}` +
    `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`
  );
}

// buildYouTubeHtml mantido por compatibilidade mas não é mais usado no native
export function buildYouTubeHtml(videoId: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#000">
  <iframe src="${getYouTubeEmbedUrl(videoId)}" style="width:100%;height:100vh;border:none"
    allow="autoplay; encrypted-media" allowfullscreen="false"></iframe>
</body></html>`;
}
