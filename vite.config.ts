import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const basePath = process.env.VITE_BASE_PATH ?? '/baseline-open-latex/'

// Normalize so the base path always begins and ends with a single slash.
const base = basePath.startsWith('/') ? basePath : `/${basePath}`
const normalizedBase = base.endsWith('/') ? base : `${base}/`

export default defineConfig({
  base: normalizedBase,
  plugins: [react()],
})