/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        brand: {
          primary: '#0f766e',   // teal-700 — flat logo color
          accent:  '#2dd4bf',   // teal-400 — glowing highlight
          bg:      '#0a1412',   // near-black with teal undertone
          surface: '#0f1f1c',   // card / panel background
          muted:   '#134e4a',   // subtle borders / dividers
        },
        // Warm, premium, editorial palette used ONLY by the client-facing
        // report. Kept separate from `brand` so admin/auth styling is untouched.
        report: {
          bg:        '#1a1512',  // deep warm charcoal
          surface:   '#241e19',  // warm neutral card
          elevated:  '#2d2620',  // slightly raised surface
          line:      '#3a322a',  // very subtle warm divider
          text:      '#f3ede4',  // soft warm off-white
          muted:     '#aaa093',  // warm grey secondary text
          faint:     '#80776a',  // faint tertiary text
          accent:    '#6fb3a5',  // muted teal accent (not neon)
          'accent-deep': '#2f4a44',
          sand:      '#d8b48a',  // soft warm highlight for gradients
        },
      },
    },
  },
  plugins: [],
}
