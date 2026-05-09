// Iron Screens — Design Tokens
export const Colors = {
  // Core palette — pure black player aesthetic
  Background: '#000000',
  Surface: '#0D0D0D',
  SurfaceElevated: '#1A1A1A',
  Border: '#2A2A2A',

  // Brand
  Primary: '#C8102E',     // Iron red accent
  PrimaryLight: '#E8304E',
  PrimaryDark: '#9A0020',

  // Text
  TextPrimary: '#FFFFFF',
  TextSecondary: '#AAAAAA',
  TextMuted: '#555555',

  // Semantic
  Success: '#22C55E',
  Warning: '#F59E0B',
  Error: '#EF4444',
  Online: '#22C55E',
  Offline: '#EF4444',

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
