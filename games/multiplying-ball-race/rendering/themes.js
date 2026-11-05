// Multiplying Ball Race - Visual Theme System
// Provides high-contrast Dark (esports/arcade) and Light (clean/broadcast) theme palettes.

const THEMES = {
  dark: {
    name: 'dark',
    bg: {
      gradStops: ['#070a13', '#0a0e1a', '#080c16', '#04060c'],
      grid: 'rgba(255, 255, 255, 0.022)',
      ambientLeft: 'rgba(192, 132, 252, 0.08)',
      ambientRight: 'rgba(74, 222, 128, 0.08)'
    },
    header: {
      gradStops: ['#060810', '#0a0e1a', '#0d1322'],
      border: 'rgba(255, 255, 255, 0.10)',
      barBg: 'rgba(14, 19, 32, 0.94)',
      barBorder: 'rgba(255, 255, 255, 0.14)',
      titleColor: '#ffffff',
      subtitleColor: '#ffd700',
      badgeBg: 'rgba(16, 22, 38, 0.92)',
      badgeBorder: 'rgba(255, 255, 255, 0.18)',
      pipActive: '#ffd700',
      pipInactive: 'rgba(255, 255, 255, 0.20)'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.70)',
      muted: 'rgba(255, 255, 255, 0.45)',
      gold: '#ffd700'
    },
    scoreboard: {
      cardBg: 'rgba(14, 19, 32, 0.92)',
      cardBgWinner: 'rgba(255, 215, 0, 0.12)',
      cardBorder: 'rgba(255, 255, 255, 0.12)',
      numberColor: '#ffffff',
      labelColor: 'rgba(255, 255, 255, 0.72)',
      metaPillBg: 'rgba(255, 255, 255, 0.06)',
      metaPillText: 'rgba(255, 255, 255, 0.65)',
      statusActive: '#38bdf8',
      crownBg: '#ffd700',
      crownText: '#0a0e1a'
    },
    lanes: {
      left: {
        name: 'PURPLE',
        color: '#c084fc',
        accentColor: '#e879f9',
        darkBase: '#3b0764',
        trackBg: 'rgba(11, 14, 24, 0.85)',
        trackBgLeader: 'rgba(16, 21, 36, 0.94)',
        borderColor: 'rgba(192, 132, 252, 0.35)',
        glowColor: 'rgba(192, 132, 252, 0.20)'
      },
      right: {
        name: 'GREEN',
        color: '#4ade80',
        accentColor: '#86efac',
        darkBase: '#052e16',
        trackBg: 'rgba(11, 14, 24, 0.85)',
        trackBgLeader: 'rgba(16, 21, 36, 0.94)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        glowColor: 'rgba(74, 222, 128, 0.20)'
      }
    },
    pegs: {
      fillLight: '#ffffff',
      fillMid: '#94a3b8',
      fillDark: '#475569',
      shadow: 'rgba(0, 0, 0, 0.45)',
      rim: 'rgba(255, 255, 255, 0.40)'
    },
    tiles: {
      pylonBg: '#151b2b',
      pylonBorder: 'rgba(255, 255, 255, 0.20)',
      bodyGrad: ['#0b101c', '#121828', '#090d16'],
      gaugeTrack: 'rgba(4, 7, 14, 0.85)',
      gaugeBorder: 'rgba(255, 255, 255, 0.12)',
      labelColor: '#ffffff',
      labelShadow: 'rgba(0, 0, 0, 0.95)',
      borderDefault: 'rgba(255, 255, 255, 0.25)'
    },
    balls: {
      shadow: 'rgba(0, 0, 0, 0.45)',
      contour: '#05070e',
      specular: 'rgba(255, 255, 255, 0.92)',
      fresnel: 'rgba(255, 255, 255, 0.25)'
    },
    reservoir: {
      trayBg: 'rgba(255, 255, 255, 0.03)',
      trayBorder: 'rgba(255, 255, 255, 0.16)',
      finishLine: 'rgba(255, 255, 255, 0.35)',
      progressBg: 'rgba(255, 255, 255, 0.08)'
    },
    celebration: {
      cardBg: 'rgba(11, 16, 28, 0.94)',
      cardBorder: 'rgba(255, 255, 255, 0.16)',
      cardShadow: 'rgba(0, 0, 0, 0.75)',
      headline: 'rgba(255, 255, 255, 0.70)',
      divider: 'rgba(255, 255, 255, 0.08)',
      statNumber: '#ffffff',
      statLabel: 'rgba(255, 255, 255, 0.55)',
      vsBg: 'rgba(255, 255, 255, 0.04)',
      vsBorder: 'rgba(255, 255, 255, 0.12)',
      vsText: 'rgba(255, 255, 255, 0.50)',
      gold: '#ffd700'
    },
    watermark: 'rgba(255, 255, 255, 0.22)'
  },
  light: {
    name: 'light',
    bg: {
      gradStops: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#f1f5f9'],
      grid: 'rgba(0, 0, 0, 0.035)',
      ambientLeft: 'rgba(147, 51, 234, 0.04)',
      ambientRight: 'rgba(22, 163, 74, 0.04)'
    },
    header: {
      gradStops: ['#ffffff', '#f8fafc', '#edf2f7'],
      border: 'rgba(0, 0, 0, 0.10)',
      barBg: 'rgba(255, 255, 255, 0.95)',
      barBorder: 'rgba(0, 0, 0, 0.12)',
      titleColor: '#0f172a',
      subtitleColor: '#b45309',
      badgeBg: 'rgba(241, 245, 249, 0.95)',
      badgeBorder: 'rgba(0, 0, 0, 0.15)',
      pipActive: '#d97706',
      pipInactive: 'rgba(0, 0, 0, 0.16)'
    },
    text: {
      primary: '#0f172a',
      secondary: 'rgba(51, 65, 85, 0.80)',
      muted: 'rgba(100, 116, 139, 0.60)',
      gold: '#d97706'
    },
    scoreboard: {
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBgWinner: 'rgba(254, 243, 199, 0.85)',
      cardBorder: 'rgba(0, 0, 0, 0.12)',
      numberColor: '#0f172a',
      labelColor: 'rgba(51, 65, 85, 0.85)',
      metaPillBg: 'rgba(0, 0, 0, 0.05)',
      metaPillText: 'rgba(71, 85, 105, 0.85)',
      statusActive: '#0284c7',
      crownBg: '#d97706',
      crownText: '#ffffff'
    },
    lanes: {
      left: {
        name: 'PURPLE',
        color: '#7e22ce', // Deep violet for AAA contrast on light
        accentColor: '#9333ea',
        darkBase: '#581c87',
        trackBg: 'rgba(255, 255, 255, 0.90)',
        trackBgLeader: 'rgba(250, 245, 255, 0.98)',
        borderColor: 'rgba(126, 34, 206, 0.40)',
        glowColor: 'rgba(126, 34, 206, 0.15)'
      },
      right: {
        name: 'GREEN',
        color: '#15803d', // Deep emerald green for AAA contrast on light
        accentColor: '#16a34a',
        darkBase: '#14532d',
        trackBg: 'rgba(255, 255, 255, 0.90)',
        trackBgLeader: 'rgba(240, 253, 244, 0.98)',
        borderColor: 'rgba(21, 128, 61, 0.40)',
        glowColor: 'rgba(21, 128, 61, 0.15)'
      }
    },
    pegs: {
      fillLight: '#64748b',
      fillMid: '#475569',
      fillDark: '#1e293b',
      shadow: 'rgba(0, 0, 0, 0.15)',
      rim: 'rgba(0, 0, 0, 0.25)'
    },
    tiles: {
      pylonBg: '#e2e8f0',
      pylonBorder: 'rgba(0, 0, 0, 0.15)',
      bodyGrad: ['#ffffff', '#f8fafc', '#edf2f7'],
      gaugeTrack: 'rgba(226, 232, 240, 0.95)',
      gaugeBorder: 'rgba(0, 0, 0, 0.15)',
      labelColor: '#0f172a',
      labelShadow: 'rgba(255, 255, 255, 0.90)',
      borderDefault: 'rgba(0, 0, 0, 0.20)'
    },
    balls: {
      shadow: 'rgba(0, 0, 0, 0.25)',
      contour: 'rgba(15, 23, 42, 0.35)',
      specular: 'rgba(255, 255, 255, 0.95)',
      fresnel: 'rgba(255, 255, 255, 0.35)'
    },
    reservoir: {
      trayBg: 'rgba(0, 0, 0, 0.03)',
      trayBorder: 'rgba(0, 0, 0, 0.18)',
      finishLine: 'rgba(0, 0, 0, 0.35)',
      progressBg: 'rgba(0, 0, 0, 0.08)'
    },
    celebration: {
      cardBg: 'rgba(255, 255, 255, 0.96)',
      cardBorder: 'rgba(0, 0, 0, 0.14)',
      cardShadow: 'rgba(0, 0, 0, 0.25)',
      headline: 'rgba(51, 65, 85, 0.85)',
      divider: 'rgba(0, 0, 0, 0.08)',
      statNumber: '#0f172a',
      statLabel: 'rgba(71, 85, 105, 0.75)',
      vsBg: 'rgba(0, 0, 0, 0.05)',
      vsBorder: 'rgba(0, 0, 0, 0.12)',
      vsText: 'rgba(71, 85, 105, 0.85)',
      gold: '#b45309'
    },
    watermark: 'rgba(15, 23, 42, 0.35)'
  }
};

if (typeof window !== 'undefined') {
  window.THEMES = THEMES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { THEMES };
}
