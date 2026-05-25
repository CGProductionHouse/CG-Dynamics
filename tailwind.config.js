/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0f766e',   // teal-700 — flat logo color
          accent:  '#2dd4bf',   // teal-400 — glowing highlight
          bg:      '#0a1412',   // near-black with teal undertone
          surface: '#0f1f1c',   // card / panel background
          muted:   '#134e4a',   // subtle borders / dividers
        },
      },
    },
  },
  plugins: [],
}

