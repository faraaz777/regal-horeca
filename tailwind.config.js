/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
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
      },
    },
  },
  plugins: [],
};

