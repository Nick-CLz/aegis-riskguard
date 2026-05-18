/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aegis: {
          midnight: '#0A1628',
          navy: '#0E2240',
          teal: '#1C7293',
          deep: '#065A82',
          sand: '#E8EDF2',
          alert: '#D62828',
          warn: '#F77F00',
          ok: '#2A9D8F'
        }
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo'] }
    }
  },
  plugins: []
};
