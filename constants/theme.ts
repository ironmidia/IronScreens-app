// Iron Screens — Design Tokens (Ruby + Snow White palette)
// Mirrors: src/index.css CSS custom properties
export const Colors = {
  // ── Background layers (matches --color-bg / --color-surface-*) ──
  Background:      '#000000',  // --color-bg
  Surface1:        '#0A0A0A',  // --color-surface-1 (Sidebar)
  Surface2:        '#0D0D0D',  // --color-surface-2 (TopBar)
  Surface:         '#111111',  // --color-surface-3 (Content area)
  Surface4:        '#161616',  // --color-surface-4 (Cards)
  SurfaceElevated: '#1A1A1A',  // --color-surface-5 (Borders/separators)
  Border:          '#2A2A2A',

  // ── Brand — Rubi (matches --color-ruby-*) ──
  Primary:          '#70001B',  // --color-ruby
  PrimaryLight:     '#8A0021',  // --color-ruby-hover
  PrimaryDark:      '#500014',
  PrimaryHighlight: '#3A000E',  // --color-ruby-subtle

  // ── Text (matches --color-text-*) ──
  TextPrimary:   '#FBFBFB',  // --color-text-primary
  TextSecondary: '#AAAAAA',  // --color-text-secondary
  TextMuted:     '#888888',
  TextFaint:     '#555555',  // --color-text-disabled

  // ── Semantic ──
  Success: '#22C55E',
  Warning: '#F59E0B',
  Error:   '#EF4444',
  Online:  '#22C55E',
  Offline: '#555555',

  // ── Overlay ──
  Overlay:      'rgba(0,0,0,0.85)',
  OverlayLight: 'rgba(0,0,0,0.5)',
};

export const Typography = {
  sizes: {
    xs:   11,
    sm:   13,
    base: 16,
    md:   18,
    lg:   20,
    xl:   24,
    xxl:  32,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

// ── Shadow presets (matches --shadow-*) ──
export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  ruby: {
    shadowColor: '#70001B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  sidebar: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 16,
  },
};
