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
        // Admin shell — warm espresso + gold (hospitality, not cold black/red)
        shell: {
          bg: '#1A1612',
          raised: '#26211C',
          border: '#3A332C',
          text: '#F3EEE6',
          muted: '#A89F93',
          dim: '#7A7268',
          gold: '#D4B56A',
          'gold-soft': '#C5A059',
          active: '#F3EEE6',
          'active-fg': '#1A1612',
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

