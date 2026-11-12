export interface EngineDescriptor {
  id: 'autoconsent' | 'consentomatic';
  /** Can set individual purposes. False means whole banner actions only. */
  purposeLevel: boolean;
  /** Ships checks that read back what the CMP stored. */
  selfTest: boolean;
  enabled: boolean;
}

/** Consent O Matic is planned for purpose level execution (Milestone 2) and is not bundled yet. */
export const ENGINES: readonly EngineDescriptor[] = Object.freeze([
  { id: 'autoconsent', purposeLevel: false, selfTest: true, enabled: true },
  { id: 'consentomatic', purposeLevel: true, selfTest: false, enabled: false },
]);
