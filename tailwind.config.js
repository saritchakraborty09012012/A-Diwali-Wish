/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#070b14',
        flame: '#ff9f1c',
        gold: '#ffd166',
        deepred: '#c1121f',
        warmwhite: '#f4e9d8',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        tiro: ['"Tiro Devanagari Hindi"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
