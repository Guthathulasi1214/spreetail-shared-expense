/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Brand color scale based on indigo — used throughout the app.
      // "brand-500" is the primary action color; "brand-600" for hover states.
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Semantic colors for balance display
        // "success" = you are owed (positive balance) — green
        // "danger"  = you owe (negative balance)     — rose/red
        success: {
          DEFAULT: '#10b981',
          50:      '#ecfdf5',
          100:     '#d1fae5',
          400:     '#34d399',
          500:     '#10b981',
          900:     '#064e3b',
        },
        danger: {
          DEFAULT: '#f43f5e',
          50:      '#fff1f2',
          100:     '#ffe4e6',
          400:     '#fb7185',
          500:     '#f43f5e',
          900:     '#881337',
        },
        warning: {
          DEFAULT: '#f59e0b',
          50:      '#fffbeb',
          400:     '#fbbf24',
          500:     '#f59e0b',
        },
      },
      fontFamily: {
        // Inter via Google Fonts CDN — loaded in index.css
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // Micro-animation tokens used on cards, modals, buttons
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Soft glow for brand-colored elements (buttons, active states)
        'brand-glow': '0 0 20px rgba(99, 102, 241, 0.3)',
        'card':       '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
