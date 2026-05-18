/** @type {import('tailwindcss').Config} */
export default {
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
        canvas: '#F1F5F9',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'modal-in': 'modal-in 0.2s ease-out',
        'toast-in': 'toast-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
