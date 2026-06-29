export type ProfileCompletionRecord = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  location?: string | null
  hobbies?: unknown
  onboarding_complete?: boolean | null
  created_at?: string | null
  deleted_at?: string | null
}

export const STRICT_PROFILE_REQUIREMENTS_STARTED_AT = '2026-06-22T20:22:00.000Z'

const GENERIC_NAME_PARTS = new Set([
  'anonymous',
  'anon',
  'free',
  'freetrust',
  'member',
  'user',
  'unknown',
  'test',
  'demo',
  'sample',
  'null',
  'none',
])

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function hasMeaningfulText(value: unknown, minLength = 2) {
  return cleanText(value).length >= minLength
}

function meaningfulNamePart(value: unknown) {
  const text = cleanText(value)
  if (text.length < 2) return false
  if (!/[a-z]/i.test(text)) return false
  if (text.includes('@')) return false
  const normalized = text.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized || GENERIC_NAME_PARTS.has(normalized)) return false
  return true
}

export function hasRealName(profile: ProfileCompletionRecord | null | undefined) {
  if (!profile) return false
  if (meaningfulNamePart(profile.first_name) && meaningfulNamePart(profile.last_name)) {
    return true
  }

  const fullName = cleanText(profile.full_name)
  if (!fullName || fullName.includes('@')) return false
  const parts = fullName.split(/\s+/).filter(meaningfulNamePart)
  return parts.length >= 2
}

export function hasProfilePhoto(profile: ProfileCompletionRecord | null | undefined) {
  const avatar = cleanText(profile?.avatar_url)
  return /^https?:\/\//i.test(avatar) || avatar.startsWith('/')
}

export function hasHobbies(profile: ProfileCompletionRecord | null | undefined) {
  const hobbies = profile?.hobbies
  return Array.isArray(hobbies) && hobbies.some(item => hasMeaningfulText(item, 2))
}

export function getProfileCompletionIssues(profile: ProfileCompletionRecord | null | undefined) {
  const issues: string[] = []
  if (!profile) return ['profile_missing']
  if (profile.deleted_at) issues.push('deleted')
  if (!isStrictProfileCompletionRequired(profile)) {
    return issues
  }
  if (!hasRealName(profile)) issues.push('real_name_missing')
  if (!hasProfilePhoto(profile)) issues.push('profile_photo_missing')
  if (!hasMeaningfulText(profile.location, 2)) issues.push('location_missing')
  if (profile.onboarding_complete !== true) issues.push('onboarding_incomplete')
  if (!hasHobbies(profile)) issues.push('hobbies_missing')
  return issues
}

export function isStrictProfileCompletionRequired(profile: ProfileCompletionRecord | null | undefined) {
  if (!profile?.created_at) return false
  const createdAt = Date.parse(profile.created_at)
  const cutoff = Date.parse(STRICT_PROFILE_REQUIREMENTS_STARTED_AT)
  return Number.isFinite(createdAt) && createdAt >= cutoff
}

export function needsSignupProfileSetup(profile: ProfileCompletionRecord | null | undefined) {
  return isStrictProfileCompletionRequired(profile) && getProfileCompletionIssues(profile).length > 0
}

export function isCommunityVisibleProfile(profile: ProfileCompletionRecord | null | undefined) {
  return getProfileCompletionIssues(profile).length === 0
}
