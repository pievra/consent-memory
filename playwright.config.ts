import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  // On the hosted runner the first browser start of a job has timed out twice (Edge, 2026-11-11,
  // both times before any test code ran). One retry there; a test that needed it is listed as flaky.
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
});
