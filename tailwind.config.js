/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        blurFadeUp: {
          '0%': { opacity: 0, filter: 'blur(20px)', transform: 'translateY(40px)' },
          '100%': { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
        }
      },
      animation: {
        'blur-fade-up': 'blurFadeUp 1s ease-out forwards',
      }
    },
  },
  plugins: [],
}
