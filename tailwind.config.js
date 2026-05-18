/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Parchment / ink / gold palette ported from arcane-workshop's
        // fantasy theming so the look-and-feel carries over.
        parchment: {
          50:  '#f7eed3',
          100: '#f0e3bb',
          200: '#e3d199',
          300: '#caac74',
          400: '#a8895a',
          500: '#8a6d44',
        },
        ink: {
          400: '#5a4d3a',
          500: '#3d3325',
          600: '#2b2418',
          700: '#1e1810',
          800: '#140f08',
        },
        gold: {
          300: '#dbb45f',
          400: '#c79d44',
          500: '#a98032',
          600: '#866529',
        },
        ember:    { 300: '#e08070', 400: '#c95846', 500: '#a8412f', 600: '#8a2f1f', 700: '#5a1f15', 800: '#3c130d', 900: '#260a07' },
        moss:     { 300: '#9fb371', 400: '#7a9b54', 500: '#5d7e3f', 600: '#43622c', 700: '#2f481e', 800: '#1f3014', 900: '#162208' },
        iris:     { 300: '#a98ad3', 400: '#8a68c1', 500: '#6a4dac', 600: '#523a8b', 700: '#3d2c6b', 800: '#291d49' },
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', '"Cormorant Garamond"', 'serif'],
        quill:   ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
