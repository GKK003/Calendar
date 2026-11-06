import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_SUPABASE_URL } = loadEnv(mode, process.cwd())
  const supabaseUrl = URL.canParse(VITE_SUPABASE_URL) ? new URL(VITE_SUPABASE_URL) : null
  const canPreconnect = supabaseUrl && ['https:', 'http:'].includes(supabaseUrl.protocol)

  return {
    plugins: [
      react(),
      {
        name: 'supabase-preconnect',
        transformIndexHtml() {
          if (!canPreconnect) return
          return [{
            tag: 'link',
            attrs: { rel: 'preconnect', href: supabaseUrl.origin, crossorigin: true },
            injectTo: 'head-prepend',
          }]
        },
      },
    ],
  }
})
