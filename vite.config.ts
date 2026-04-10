import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/** Keep default in sync with `getLeaderboardWebSocketUrl` in `src/app/utils/api.ts`. */
const DEFAULT_DEV_API_ORIGIN = 'http://127.0.0.1:5000'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_DEV_API_ORIGIN || DEFAULT_DEV_API_ORIGIN).replace(/\/$/, '')

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
