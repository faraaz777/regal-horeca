/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a1a1a',
        'primary-700': '#0a0a0a',
        secondary: '#2d2d2d',
        medium: '#e5e5e5',
        light: '#f5f5f5',
        premium: {
          dark: '#3D402D',    // Dark Olive Green background
          light: '#C9A86A',   // Gold for borders and accents
          text: '#F3F4F6',   // Off-white for text
        },
      },
    },
  },
  plugins: [],
};

