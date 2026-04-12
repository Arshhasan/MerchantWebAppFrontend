/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind v4 primary scan paths are `@source` in `src/styles/archive/tailwind.css`.
  // This file helps tooling and documents the content globs for purging.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
};
