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
 * Gera uma página HTML completa com YouTube IFrame API.
 * O player é iniciado programaticamente via JS para contornar
 * a política de autoplay do YouTube em WebView Android.
 */
export function buildYouTubeHtml(videoId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    #player { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    var player;
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${videoId}',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          loop: 1,
          playlist: '${videoId}',
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
        },
        events: {
          onReady: function(e) { e.target.playVideo(); },
          onStateChange: function(e) {
            // Se pausou ou encerrou, reinicia
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              e.target.playVideo();
            }
          },
        },
      });
    }
  </script>
</body>
</html>
`;
}
