/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial Narrow', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'Arial Narrow', 'Impact', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#d7d2c8',
          accent: '#c8792a',
          bg: '#070707',
          surface: '#11100e',
          muted: '#2a2520',
          teal: '#2a8f83',
        },
        report: {
          bg: '#1a1512',
          surface: '#241e19',
          elevated: '#2d2620',
          line: '#3a322a',
          text: '#f3ede4',
          muted: '#aaa093',
          faint: '#80776a',
          accent: '#6fb3a5',
          'accent-deep': '#2f4a44',
          sand: '#d8b48a',
        },
      },
    },
  },
  plugins: [],
}
