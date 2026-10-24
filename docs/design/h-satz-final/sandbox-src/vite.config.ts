/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react()],
  preview: { port: 4189, strictPort: true, host: '127.0.0.1' },
  test: { include: ['src/**/*.test.ts'] },
})
