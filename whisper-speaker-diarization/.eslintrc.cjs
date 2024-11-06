module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:svelte3/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { 'svelte3/ignore-styles': () => true },
  plugins: [],
  rules: {
    'svelte3/no-unknown-styles': 'off',
  },
}
