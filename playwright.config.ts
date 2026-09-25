import { defineConfig, devices } from '@playwright/test'

/** Порты превью; переопределяются, если занято (например, соседним worktree): `E2E_PORT=4273 npm run test:e2e`. */
const PORT = Number(process.env.E2E_PORT ?? 4173)
const PAGES_PORT = Number(process.env.E2E_PAGES_PORT ?? 4174)
/** Подпапка на GitHub Pages — как в deploy-job `ci.yml`. */
const PAGES_BASE = '/myAuto/'
/** Сборки e2e не берут ClientID Яндекса из `.env.local`: сценарии не должны зависеть от машины. */
const NO_CLIENT_ID = { VITE_YANDEX_CLIENT_ID: '' }

const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile-chromium',
      testIgnore: 'pages-base.spec.ts',
      use: { ...phone, baseURL: `http://localhost:${PORT}/` },
    },
    {
      name: 'pages-base',
      testMatch: 'pages-base.spec.ts',
      use: { ...phone, baseURL: `http://localhost:${PAGES_PORT}${PAGES_BASE}` },
    },
  ],
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      env: NO_CLIENT_ID,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Отдельная папка сборки: `dist` занят сборкой с корнем `/`.
      command:
        `npx vite build --outDir dist-pages && ` +
        `npx vite preview --outDir dist-pages --base ${PAGES_BASE} --port ${PAGES_PORT} --strictPort`,
      url: `http://localhost:${PAGES_PORT}${PAGES_BASE}`,
      env: { ...NO_CLIENT_ID, VITE_BASE: PAGES_BASE },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
