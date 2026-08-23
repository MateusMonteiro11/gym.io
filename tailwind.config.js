/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#1457F7',
        primary: {
          DEFAULT: '#1457F7',
          hover: '#0F4AD4',
          muted: '#E8EFFE',
        },
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        danger: {
          DEFAULT: '#DC2626',
          muted: '#FEF2F2',
        },
        success: {
          DEFAULT: '#059669',
          muted: '#ECFDF5',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgb(15 23 42 / 0.06), 0 1px 2px rgb(15 23 42 / 0.04)',
        'card-hover': '0 10px 25px rgb(15 23 42 / 0.08)',
        modal: '0 25px 50px rgb(15 23 42 / 0.15)',
      },
      keyframes: {
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'modal-in': 'modal-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
