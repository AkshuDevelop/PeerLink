/**
 * Tailwind CSS configuration for PeerLink.
 * Extends the default theme with the full "Kinetic Block" design system:
 * custom colors, Space Grotesk / Space Mono fonts, and custom utilities.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Kinetic Block Primary Palette ──────────────────────────
        cobalt:          '#1F3BFF',
        cream:           '#F4F1EA',
        ink:             '#0E0E10',
        sand:            '#E3DCCB',
        coral:           '#FF7A59',
        'cream-muted':   'rgba(244, 241, 234, 0.72)',
        'ink-muted':     '#55534E',
        'cream-hairline':'rgba(244, 241, 234, 0.16)',
        'ink-hairline':  'rgba(14, 14, 16, 0.14)',
      },
      fontFamily: {
        // Space Grotesk for headlines and body
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Space Mono for labels, hashes, and telemetry counters
        mono: ['"Space Mono"', 'monospace'],
      },
      // Custom keyframes for the rotating disc animations
      keyframes: {
        spinDisc: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        wireDashes: {
          to: { strokeDashoffset: '-32' },
        },
      },
      animation: {
        'disc-spin': 'spinDisc 24s linear infinite',
        'disc-fast': 'spinDisc 6s linear infinite',
      },
    },
  },
  plugins: [],
};
