export type PubExperienceProfileLocation = {
  country?: string | null
  city?: string | null
  location?: string | null
  location_label?: string | null
}

const REPUBLIC_OF_IRELAND_TERMS = [
  'ie',
  'ireland',
  'republic of ireland',
  'eire',
  'éire',
]

const REPUBLIC_OF_IRELAND_PLACE_TERMS = [
  'cork',
  'dublin',
  'galway',
  'limerick',
  'waterford',
  'kilkenny',
  'wexford',
  'sligo',
  'athlone',
  'tralee',
  'kerry',
  'clare',
  'mayo',
  'donegal',
  'wicklow',
  'meath',
  'louth',
  'kildare',
  'laois',
  'offaly',
  'westmeath',
  'longford',
  'roscommon',
  'leitrim',
  'cavan',
  'monaghan',
  'carlow',
  'tipperary',
]

const NORTHERN_IRELAND_TERMS = [
  'northern ireland',
  'north of ireland',
  'belfast',
  'derry',
  'londonderry',
  'antrim',
  'armagh',
  'down',
  'fermanagh',
  'tyrone',
  'newry',
  'lisburn',
  'omagh',
  'enniskillen',
  'coleraine',
  'bangor',
  'craigavon',
  'newtownabbey',
]

function normaliseLocationPart(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isWholeIslandIrelandProfile(profile: PubExperienceProfileLocation | null | undefined) {
  if (!profile) return false

  const country = normaliseLocationPart(profile.country)
  const locationText = [profile.location_label, profile.location, profile.city, profile.country]
    .map(normaliseLocationPart)
    .filter(Boolean)
    .join(' | ')

  if (REPUBLIC_OF_IRELAND_TERMS.includes(country)) return true
  if (locationText.includes('ireland')) return true
  if (REPUBLIC_OF_IRELAND_PLACE_TERMS.some(term => locationText.includes(term))) return true
  if (country === 'gb' || country === 'uk' || country === 'united kingdom') {
    return NORTHERN_IRELAND_TERMS.some(term => locationText.includes(term))
  }

  return NORTHERN_IRELAND_TERMS.some(term => locationText.includes(term))
}

export const PUB_EXPERIENCE_RESTRICTED_MESSAGE = 'Pub Experience is currently available only to FreeTrust members based on the island of Ireland.'
