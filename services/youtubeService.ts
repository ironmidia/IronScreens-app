// Iron Screens — YouTube Utility
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  return (
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&controls=0&loop=1&playlist=${videoId}&mute=0&rel=0&modestbranding=1&playsinline=1`
  );
}
