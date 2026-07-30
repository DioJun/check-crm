/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a14',
          800: '#0f0f1a',
          700: '#15152a',
          600: '#1a1a35',
          500: '#222245',
        },
        gold: {
          900: '#b8862e',
          800: '#c9952e',
          700: '#D4A03C',
          600: '#e0ad4a',
          500: '#e8b84b',
          400: '#f0d080',
          300: '#f5e0a0',
          200: '#faf0d0',
          100: '#fdf6e0',
          50:  '#fefaee',
        },
      },
    },
  },
  plugins: [],
}

