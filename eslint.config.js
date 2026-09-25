import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const LAYERS = ['domain', 'db', 'sync', 'ui', 'features', 'app']
const forbid = (layer, banned) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: banned.map((b) => ({
          group: [`**/${b}/**`, `**/${b}`, `@/${b}/**`],
          message: `Слой ${layer}/ не может импортировать ${b}/ (см. CLAUDE.md, «Границы слоёв»)`,
        })),
      },
    ],
  },
})

export default tseslint.config(
  { ignores: ['dist', 'dist-pages', 'dev-dist', 'coverage', 'playwright-report', 'test-results', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  forbid(
    'domain',
    LAYERS.filter((l) => l !== 'domain'),
  ),
  forbid('db', ['sync', 'ui', 'features', 'app']),
  forbid('sync', ['ui', 'features', 'app']),
  forbid('ui', ['domain', 'db', 'sync', 'features', 'app']),
)
