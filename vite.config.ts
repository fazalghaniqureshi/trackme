import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const traccarTarget = env.VITE_TRACCAR_URL || 'https://demo2.traccar.org'

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 3001,
      proxy: {
        '/traccar': {
          target: traccarTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/traccar/, ''),
          secure: false,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  }
})
