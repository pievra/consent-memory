// Compile time feature switches. Telemetry is not authorised
// (docs/telemetry/decision-register.md) and has no implementation in this build.
export const features = {
  telemetry: false,
  gpc: true,
  audit: true,
  purposeLevelExecution: true,
  /** Early test release: the welcome and results pages invite people to email a results file. Nothing is sent by the extension. */
  testerInvitation: true,
} as const;
