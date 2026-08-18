/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  safelist: ['bg-indigo-600', 'bg-emerald-600', 'text-indigo-600', 'text-indigo-400', 'text-emerald-600', 'text-emerald-400', 'dark:text-indigo-400', 'dark:text-emerald-400'],
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#7c3aed',
        'background-light': '#f0f2f5',
        'background-dark': '#050505',
        'md-primary': '#7c3aed',
        'md-on-primary': '#ffffff',
        'md-surface': 'var(--bg-color)',
        'md-on-surface': 'var(--text-main)',
        'md-on-surface-variant': 'var(--text-muted)',
        glass: 'rgba(255, 255, 255, 0.05)',
        'glass-hover': 'rgba(255, 255, 255, 0.1)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        'gradient-cta': 'linear-gradient(to right, #3b82f6, #8b5cf6)',
        'text-gradient': 'linear-gradient(to right, #3b82f6, #8b5cf6)',
      },
      animation: {
        'slide-up-fade': 'slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer: 'shimmer 2s linear infinite', breathing: 'breathing 3s ease-in-out infinite',
        'pop-in': 'popIn 0.3s ease-out forwards',
        'aurora-blob-1': 'auroraBlob1 25s infinite alternate cubic-bezier(0.4, 0, 0.2, 1)',
        'aurora-blob-2': 'auroraBlob2 30s infinite alternate-reverse cubic-bezier(0.4, 0, 0.2, 1)',
        'aurora-blob-3': 'auroraBlob3 35s infinite alternate cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        slideUpFade: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        breathing: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.85', transform: 'scale(0.98)' } },
        popIn: { '0%': { transform: 'scale(0.5)', opacity: '0' }, '70%': { transform: 'scale(1.1)', opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        auroraBlob1: { '0%': { transform: 'translate3d(0, 0, 0) scale(1)' }, '33%': { transform: 'translate3d(10%, 10%, 0) scale(1.1)' }, '66%': { transform: 'translate3d(-5%, 20%, 0) scale(0.9)' }, '100%': { transform: 'translate3d(0, 0, 0) scale(1)' } },
        auroraBlob2: { '0%': { transform: 'translate3d(0, 0, 0) rotate(0deg)' }, '50%': { transform: 'translate3d(-10%, -10%, 0) rotate(10deg)' }, '100%': { transform: 'translate3d(0, 0, 0) rotate(0deg)' } },
        auroraBlob3: { '0%': { transform: 'translate3d(0, 0, 0) scale(1)' }, '50%': { transform: 'translate3d(15%, -15%, 0) scale(1.2)' }, '100%': { transform: 'translate3d(0, 0, 0) scale(1)' } },
      },
    },
  },
};
