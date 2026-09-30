export const FREETRUST_ADMIN_EMAILS = [
  'davidocallaghan100@gmail.com',
] as const

export function isFreeTrustAdminEmail(email: string | null | undefined): boolean {
  const normalised = email?.trim().toLowerCase()
  return FREETRUST_ADMIN_EMAILS.some(adminEmail => normalised === adminEmail.toLowerCase())
}
