import { defineConfig } from 'vitest/config';
// Unit tests exercise the audit with the fixture tracker, as the test build does.
export default defineConfig({ define: { __TEST_TRACKER__: 'true' }, test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' } });
