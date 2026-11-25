import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Academy Lite is its own app. It borrows the main project's installed packages (../node_modules)
// and its public folder, so the training videos, covers and avatars are shared, not copied.
//
// `--mode deploy` builds it into the main app's output at /academy-lite/ (used by the main `npm run build`,
// so the deployed site serves it at https://<site>/academy-lite). The shared files already sit at the
// site root there, so they are not copied again.
export default defineConfig(({ mode }) => {
  const deploy = mode === 'deploy'
  return {
    plugins: [react(), tailwindcss()],
    base: deploy ? '/academy-lite/' : '/',
    publicDir: deploy ? false : '../public',
    // host: true lets phones on the same Wi-Fi open the dev server (http://<this computer's IP>:5180).
    server: { port: 5180, host: true },
    build: deploy ? { outDir: '../dist/academy-lite', emptyOutDir: true } : { outDir: 'dist' },
  }
})
