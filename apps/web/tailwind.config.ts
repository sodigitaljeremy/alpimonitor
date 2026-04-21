import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F2847',
          hover: '#1A3B66',
        },
        glacier: {
          DEFAULT: '#F4F8FB',
          soft: '#ECF2F7',
        },
        slate: {
          alpi: '#5C6B7A',
        },
        alpine: {
          DEFAULT: '#F4C542',
          soft: '#FBE9AD',
        },
        graphite: {
          DEFAULT: '#2C3640',
          strong: '#1C242C',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 40, 71, 0.04), 0 2px 8px rgba(15, 40, 71, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
