import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width:390,height:844 } },
  webServer: {
    command:'npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173',
    url:'http://127.0.0.1:5173/knowledge-vault/',
    env:{ VITE_SUPABASE_ANON_KEY:'synthetic-browser-test-key' },
    reuseExistingServer:false,
  },
})
