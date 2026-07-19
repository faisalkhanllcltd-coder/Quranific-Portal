/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0d1738',
          primary: '#512bd4',
          secondary: '#fa991c',
          bg: '#f6f9fc',
          text: '#061b31',
          success: '#1c768f',
          surface: '#ffffff',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          600: '#059669',
          700: '#047857', // Main primary
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22', // Deep dark
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b', // Main accent
          600: '#d97706',
          700: '#b45309',
        },
        cream: {
          50: '#fefdf9',  // Main BG
          100: '#fdf9ed', // Hero BG
        }
      },
      backgroundImage: {
        'gradient-text': 'linear-gradient(to right, #047857, #059669, #f59e0b)',
        'gradient-cta-outer': 'linear-gradient(to bottom right, #047857, #065f46, #064e3b)',
      },
      boxShadow: {
        // Equivalent to shadow-xl shadow-emerald-900/10 for cards
        'card-hover': '0 20px 25px -5px rgb(6 78 59 / 0.1), 0 8px 10px -6px rgb(6 78 59 / 0.1)',
      }
    },
  },
  plugins: [],
}