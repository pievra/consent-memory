import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

// Runs in the page's own JavaScript world at document start, only while GPC is on and the
// site is not paused (see src/privacy/gpc.ts). It defines one read only property and does
// nothing else: no data is read, nothing is sent, no message is exchanged with the page.
export default defineUnlistedScript(() => {
  try {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
      get: () => true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    // The property already exists and is locked, for example in a browser with native support.
  }
});
