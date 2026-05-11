// Iron Screens — YouTube Service

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('?')[0] || null;
    const v = parsed.searchParams.get('v');
    if (v) return v;
    const match = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (match) return match[1];
  } catch {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Iframe embed direto via youtube.com/embed (sem IFrame API).
 * Não usa youtube_api nem buildYouTubeHtml com JS — apenas src no iframe.
 * O baseUrl no WebView deve ser 'https://www.youtube.com' para que o embed
 * reconheça a origem e não retorne erro 152/153.
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
