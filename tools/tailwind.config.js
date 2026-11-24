// Tailwind build for telemenv.co.il (replaces the Play CDN, 2026-11-23).
// Rebuild after adding Tailwind classes to any page:
//   npx tailwindcss@3.4.17 -c tools/tailwind.config.js -i tools/tailwind.in.css -o assets/tailwind.css --minify
module.exports = {
  content: ['./**/*.html', './assets/**/*.js', '!./node_modules/**'],
  theme: {
    extend: {
      colors: {
        telem: {
          moss: '#78836a',
          forest: '#475d4b',
          dark: '#243e38',
          black: '#1d1d1b',
          cream: '#f8f4f1',
          khaki: '#94937f'
        }
      },
      fontFamily: {
        sans: ['"Google Sans"', 'Assistant', 'sans-serif']
      }
    }
  }
};
