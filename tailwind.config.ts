import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        paper: '#f8f6f2',
        brand: '#006d77',
        accent: '#e29578'
      }
    }
  },
  plugins: []
} satisfies Config;
