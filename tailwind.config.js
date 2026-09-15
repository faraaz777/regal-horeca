/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  safelist: [
    'bg-slate-200',
    'bg-sky-200',
    'bg-sky-400',
    'bg-blue-500',
    'bg-indigo-700',
  ],
  theme: {
    extend: {
      colors: {
        // Design System Colors - Strict
        white: '#FFFFFF',
        black: '#000000',
        accent: '#EE4023',
        'royal-gold': '#C5A059',
        'rich-black': '#121212',
        'warm-white': '#FAFAF9',
        // Admin shell — neutral charcoal (sidebar only; body stays light gray)
        shell: {
          bg: '#171717',
          raised: '#262626',
          border: '#404040',
          text: '#FAFAFA',
          muted: '#A3A3A3',
          dim: '#737373',
          gold: '#A3A3A3',
          'gold-soft': '#D4D4D4',
          active: '#FAFAFA',
          'active-fg': '#171717',
        },
        // Legacy support - map to design system
        primary: '#000000',
        'primary-700': '#000000',
        secondary: '#000000',
        medium: '#e5e5e5',
        light: '#f5f5f5',
        'brand-orange': '#EE4023',
        'regal-orange': '#EE4023',
        'regal-black': '#000000',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      screens: {
        '3xl': '1920px',
      },
    },
  },
  plugins: [],
};

