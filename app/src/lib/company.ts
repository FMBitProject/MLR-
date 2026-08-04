// Legal identity of the operator behind MLR Flow, surfaced on the public
// Terms, Privacy, and FAQ pages.
//
// These are deliberately NOT hardcoded: they are legal facts, not product
// copy, and a wrong value on a published privacy policy is a real problem.
// Set them as environment variables (Vercel → Settings → Environment
// Variables). Until a value is set, the page renders a visible placeholder
// so an unfilled field can't quietly ship.

const TODO = (what: string) => `[BELUM DIISI: ${what}]`;

export const COMPANY = {
  /** Registered legal entity, or full name if operating as a sole proprietor. */
  legalName: process.env.COMPANY_LEGAL_NAME || TODO("nama badan hukum"),
  /** Product/trading name — this one is known. */
  productName: "MLR Flow",
  /** Full registered address. */
  address: process.env.COMPANY_ADDRESS || TODO("alamat terdaftar"),
  /** General/support contact. */
  email: process.env.COMPANY_EMAIL || TODO("email layanan pelanggan"),
  /** Where data-protection requests go; falls back to the general address. */
  privacyEmail:
    process.env.COMPANY_PRIVACY_EMAIL ||
    process.env.COMPANY_EMAIL ||
    TODO("email urusan data pribadi"),
  phone: process.env.COMPANY_PHONE || TODO("nomor telepon"),
  /** Last substantive revision of the legal documents (YYYY-MM-DD). */
  legalUpdatedAt: process.env.LEGAL_UPDATED_AT || "2026-08-04",
} as const;

/** True when any legal detail is still an unfilled placeholder. */
export function companyDetailsIncomplete(): boolean {
  return Object.values(COMPANY).some((v) => v.startsWith("[BELUM DIISI"));
}
