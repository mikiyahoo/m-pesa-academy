import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Academy Lite is its own app. It borrows the main project's installed packages (../node_modules)
// and its public folder, so the training videos, covers and avatars are shared, not copied.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: '../public',
  // host: true lets phones on the same Wi-Fi open it (http://<this computer's IP>:5180).
  server: { port: 5180, host: true },
  build: { outDir: 'dist' },
})
