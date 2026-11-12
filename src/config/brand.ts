// Name, contact and legal entity as decided by the product owner (2026-11-11).
// Register facts are those in the entity's published legal notice (company register;
// VAT number checked on VIES 2026-10-22). No individual is named, by the owner's instruction.
export const EXTENSION_NAME = 'Pievra';
/** The name shown in the store and in the browser's extension list: the brand and what it is. */
export const STORE_NAME = 'Pievra: Consent Memory';
export const PIEVRA_CONTACT = 'contact@pievra.com';
export const PIEVRA_PRIVACY_CONTACT = 'dpo@mrnie.com';
export const PIEVRA_LEGAL_ENTITY = {
  name: 'MRNIE',
  legalForm: 'SAS',
  shareCapitalEur: 1000,
  register: 'RCS Paris 109 701 664',
  vatNumber: 'FR09 109 701 664',
  address: '16 rue du Dragon, 75006 Paris, France',
} as const;
export const PUBLISHER_LINE = `${PIEVRA_LEGAL_ENTITY.name} ${PIEVRA_LEGAL_ENTITY.legalForm}, ${PIEVRA_LEGAL_ENTITY.address} — ${PIEVRA_LEGAL_ENTITY.register}`;
