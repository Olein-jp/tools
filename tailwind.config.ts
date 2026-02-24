import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-ink)',
        paper: 'var(--color-paper)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        panel: 'var(--color-panel)',
        panelSoft: 'var(--color-panel-soft)'
      }
    }
  },
  plugins: []
} satisfies Config;
