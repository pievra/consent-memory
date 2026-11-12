export interface PlatformCapabilities {
  mainWorldScripting: boolean;
  headerModification: boolean;
  networkObservation: boolean;
}
/** Chromium desktop. Only capabilities exercised by tests are marked true. */
export const chromiumCapabilities: PlatformCapabilities = {
  mainWorldScripting: true,
  headerModification: true,
  networkObservation: true,
};
