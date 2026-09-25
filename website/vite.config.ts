import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function googleSiteVerification(token: string | undefined): Plugin {
  return {
    name: 'npl-google-site-verification',
    transformIndexHtml() {
      if (!token?.trim()) return []
      return [
        {
          tag: 'meta',
          attrs: {
            name: 'google-site-verification',
            content: token.trim(),
          },
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim()
  return {
    plugins: [react(), googleSiteVerification(env.VITE_GOOGLE_SITE_VERIFICATION)],
    server: apiProxyTarget
      ? {
          proxy: {
            '/api/v1': {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})
