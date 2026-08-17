/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core brand — deep transit blue with a signal-amber accent
        brand: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b8d1ff',
          300: '#8ab0ff',
          400: '#5586fc',
          500: '#2f5df0',
          600: '#1f42d1',
          700: '#1c34a6',
          800: '#1a2e84',
          900: '#131f5c',
          950: '#0b1338',
        },
        signal: {
          50: '#fff8ec',
          100: '#ffedc7',
          200: '#ffd98a',
          300: '#ffbe4d',
          400: '#ffa41f',
          500: '#f98407',
          600: '#dd6203',
          700: '#b74506',
          800: '#94360c',
          900: '#792d0d',
        },
        surface: {
          light: '#f5f7fb',
          dark: '#0b1120',
        },
        panel: {
          light: 'rgba(255,255,255,0.72)',
          dark: 'rgba(17,24,39,0.65)',
        },
        success: '#17b26a',
        warning: '#f79009',
        danger: '#f04438',
        info: '#2f5df0',
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(11, 19, 56, 0.12)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: 0.8 },
          '80%, 100%': { transform: 'scale(1.6)', opacity: 0 },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite',
      },
    },
  },
  plugins: [],
};
