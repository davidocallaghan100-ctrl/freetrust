export const FREETRUST_ADMIN_EMAILS = [
  'David@freetrust.co',
  'davidocallaghan100@gmail.com',
] as const

export function isFreeTrustAdminEmail(email: string | null | undefined): boolean {
  return FREETRUST_ADMIN_EMAILS.some(adminEmail => email === adminEmail)
}
