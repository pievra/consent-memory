import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'tests/fixtures/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'],
      'no-restricted-properties': ['error', { object: 'navigator', property: 'sendBeacon' }],
    },
  },
  {
    // Import boundaries: core is browser free and knows nothing about adapters, UI or telemetry.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/adapters/**', '**/telemetry/**', '**/ui/**', '**/entrypoints/**', 'wxt', 'wxt/*', '@duckduckgo/*'] }],
    },
  },
  {
    // Telemetry is built but not authorised: nothing that ships may import it (docs/telemetry/decision-register.md).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/telemetry/**', 'src/core/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['**/telemetry/**'] }] },
  },
  { files: ['tests/**', 'scripts/**', '*.config.*'], rules: { 'no-restricted-globals': 'off' } },
);
