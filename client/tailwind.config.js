/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Comfortaa"', '"Noto Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: { DEFAULT: '#fbf7f0', dark: '#14121f' },
        ink: { DEFAULT: '#1f1b2e', soft: '#5b5670' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
        draw: { from: { strokeDashoffset: '300' }, to: { strokeDashoffset: '0' } },
        fadeup: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        pop: 'pop .25s ease-out',
        shake: 'shake .3s ease-in-out',
        draw: 'draw .5s ease-out forwards',
        fadeup: 'fadeup .3s ease-out',
      },
    },
  },
  plugins: [],
};
