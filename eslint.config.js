import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // test/parity is a headless test page driven over CDP, not part of the app's
    // hot-reload graph — react-refresh's "a file with components must export
    // them" constraint doesn't apply to it.
    files: ['test/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
