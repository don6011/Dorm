import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Only our sources: reference clones and scratch folders can sit beside src/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
