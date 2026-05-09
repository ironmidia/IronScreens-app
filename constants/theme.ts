// Iron Screens — Design Tokens v2 (Ruby + Snow White palette)
export const Colors = {
  // Core
  Background: '#000000',       // Preto absoluto
  Surface: '#111111',
  SurfaceElevated: '#1A1A1A',
  Border: '#2A2A2A',

  // Brand — Rubi
  Primary: '#70001B',
  PrimaryLight: '#8A0022',
  PrimaryDark: '#500014',
  PrimaryHighlight: 'rgba(112,0,27,0.15)',

  // Text — Branco Neve
  TextPrimary: '#FBFBFB',
  TextSecondary: '#AAAAAA',
  TextMuted: '#888888',
  TextFaint: '#555555',

  // Semantic
  Success: '#22C55E',
  Warning: '#F59E0B',
  Error: '#EF4444',
  Online: '#22C55E',
  Offline: '#555555',

  // Overlay
  Overlay: 'rgba(0,0,0,0.85)',
  OverlayLight: 'rgba(0,0,0,0.5)',
};

export const Typography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 16,
    md: 18,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
