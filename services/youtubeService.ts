// Iron Screens — YouTube Service

/** Extrai o videoId de qualquer formato de URL do YouTube */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null;
    }
    const v = parsed.searchParams.get('v');
    if (v) return v;
    const match = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (match) return match[1];
  } catch {
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );
    if (m) return m[1];
  }
  return null;
}

/**
 * Gera HTML com <iframe> embed direto do YouTube.
 * Não usa IFrame API (que exige origem cadastrada e causa erro 152-4).
 * Parâmetros autoplay=1&mute=1 são suficientes para autoplay em WebView Android.
 */
export function buildYouTubeHtml(videoId: string): string {
  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}` +
    `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    allow="autoplay; encrypted-media"
    allowfullscreen="false"
    frameborder="0"
  ></iframe>
</body>
</html>`;
}
