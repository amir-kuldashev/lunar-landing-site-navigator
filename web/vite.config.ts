/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works on GitHub Pages, Vercel, or any sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
