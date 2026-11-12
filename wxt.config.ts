import { defineConfig } from 'wxt';
import { EXTENSION_NAME, STORE_NAME } from './src/config/brand';

// Permissions are reviewed one by one in docs/store/permissions.md.
// Any change here must update tests/unit/manifest.test.ts.
export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  imports: false,
  // Vite's module preload polyfill calls fetch(); extension pages must make no requests.
  vite: () => ({ build: { modulePreload: { polyfill: false } } }),
  manifest: {
    name: STORE_NAME,
    short_name: EXTENSION_NAME,
    action: { default_title: EXTENSION_NAME },
    // English and French descriptions live in public/_locales.
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://pievra.com',
    // The browser's document identifier, used to pin every page injection, exists from Chrome 106.
    minimum_chrome_version: '120',
    permissions: ['storage', 'scripting', 'declarativeNetRequestWithHostAccess', 'webRequest'],
    host_permissions: ['http://*/*', 'https://*/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
    },
  },
});
