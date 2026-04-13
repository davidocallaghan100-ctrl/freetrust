// ISO 3166-1 alpha-2 country reference list with display names + flags.
// Used by the LocationFilter dropdown so users can pick any country, not
// just countries that happen to be present in the current page's data.
//
// Source: ISO 3166-1 (250 territories). Trimmed list excludes territories
// without active marketplaces (Antarctica, uninhabited islands, etc.) but
// keeps every UN member state plus Hong Kong + Taiwan + Macau because they
// are common marketplace locations.
//
// Naming convention: snake_case columns in the DB, but COUNTRIES is a
// frozen array exported as-is so consumers can access COUNTRIES_BY_CODE
// for O(1) lookup or just iterate for a dropdown.

export interface Country {
  code: string  // ISO 3166-1 alpha-2 (uppercase)
  name: string
  flag: string  // emoji flag
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AF', name: 'Afghanistan',          flag: '🇦🇫' },
  { code: 'AL', name: 'Albania',              flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria',              flag: '🇩🇿' },
  { code: 'AD', name: 'Andorra',              flag: '🇦🇩' },
  { code: 'AO', name: 'Angola',               flag: '🇦🇴' },
  { code: 'AG', name: 'Antigua and Barbuda',  flag: '🇦🇬' },
  { code: 'AR', name: 'Argentina',            flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia',              flag: '🇦🇲' },
  { code: 'AU', name: 'Australia',            flag: '🇦🇺' },
  { code: 'AT', name: 'Austria',              flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan',           flag: '🇦🇿' },
  { code: 'BS', name: 'Bahamas',              flag: '🇧🇸' },
  { code: 'BH', name: 'Bahrain',              flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh',           flag: '🇧🇩' },
  { code: 'BB', name: 'Barbados',             flag: '🇧🇧' },
  { code: 'BY', name: 'Belarus',              flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium',              flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize',               flag: '🇧🇿' },
  { code: 'BJ', name: 'Benin',                flag: '🇧🇯' },
  { code: 'BT', name: 'Bhutan',               flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia',              flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: 'BW', name: 'Botswana',             flag: '🇧🇼' },
  { code: 'BR', name: 'Brazil',               flag: '🇧🇷' },
  { code: 'BN', name: 'Brunei',               flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria',             flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso',         flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi',              flag: '🇧🇮' },
  { code: 'KH', name: 'Cambodia',             flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon',             flag: '🇨🇲' },
  { code: 'CA', name: 'Canada',               flag: '🇨🇦' },
  { code: 'CV', name: 'Cape Verde',           flag: '🇨🇻' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
  { code: 'TD', name: 'Chad',                 flag: '🇹🇩' },
  { code: 'CL', name: 'Chile',                flag: '🇨🇱' },
  { code: 'CN', name: 'China',                flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia',             flag: '🇨🇴' },
  { code: 'KM', name: 'Comoros',              flag: '🇰🇲' },
  { code: 'CG', name: 'Congo',                flag: '🇨🇬' },
  { code: 'CD', name: 'Congo (DRC)',          flag: '🇨🇩' },
  { code: 'CR', name: 'Costa Rica',           flag: '🇨🇷' },
  { code: 'CI', name: 'Côte d’Ivoire',        flag: '🇨🇮' },
  { code: 'HR', name: 'Croatia',              flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba',                 flag: '🇨🇺' },
  { code: 'CY', name: 'Cyprus',               flag: '🇨🇾' },
  { code: 'CZ', name: 'Czechia',              flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark',              flag: '🇩🇰' },
  { code: 'DJ', name: 'Djibouti',             flag: '🇩🇯' },
  { code: 'DM', name: 'Dominica',             flag: '🇩🇲' },
  { code: 'DO', name: 'Dominican Republic',   flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador',              flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt',                flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador',          flag: '🇸🇻' },
  { code: 'GQ', name: 'Equatorial Guinea',    flag: '🇬🇶' },
  { code: 'ER', name: 'Eritrea',              flag: '🇪🇷' },
  { code: 'EE', name: 'Estonia',              flag: '🇪🇪' },
  { code: 'SZ', name: 'Eswatini',             flag: '🇸🇿' },
  { code: 'ET', name: 'Ethiopia',             flag: '🇪🇹' },
  { code: 'FJ', name: 'Fiji',                 flag: '🇫🇯' },
  { code: 'FI', name: 'Finland',              flag: '🇫🇮' },
  { code: 'FR', name: 'France',               flag: '🇫🇷' },
  { code: 'GA', name: 'Gabon',                flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia',               flag: '🇬🇲' },
  { code: 'GE', name: 'Georgia',              flag: '🇬🇪' },
  { code: 'DE', name: 'Germany',              flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana',                flag: '🇬🇭' },
  { code: 'GR', name: 'Greece',               flag: '🇬🇷' },
  { code: 'GD', name: 'Grenada',              flag: '🇬🇩' },
  { code: 'GT', name: 'Guatemala',            flag: '🇬🇹' },
  { code: 'GN', name: 'Guinea',               flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bissau',        flag: '🇬🇼' },
  { code: 'GY', name: 'Guyana',               flag: '🇬🇾' },
  { code: 'HT', name: 'Haiti',                flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras',             flag: '🇭🇳' },
  { code: 'HK', name: 'Hong Kong',            flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary',              flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland',              flag: '🇮🇸' },
  { code: 'IN', name: 'India',                flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia',            flag: '🇮🇩' },
  { code: 'IR', name: 'Iran',                 flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq',                 flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland',              flag: '🇮🇪' },
  { code: 'IL', name: 'Israel',               flag: '🇮🇱' },
  { code: 'IT', name: 'Italy',                flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica',              flag: '🇯🇲' },
  { code: 'JP', name: 'Japan',                flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan',               flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan',           flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya',                flag: '🇰🇪' },
  { code: 'KI', name: 'Kiribati',             flag: '🇰🇮' },
  { code: 'KW', name: 'Kuwait',               flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan',           flag: '🇰🇬' },
  { code: 'LA', name: 'Laos',                 flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia',               flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon',              flag: '🇱🇧' },
  { code: 'LS', name: 'Lesotho',              flag: '🇱🇸' },
  { code: 'LR', name: 'Liberia',              flag: '🇱🇷' },
  { code: 'LY', name: 'Libya',                flag: '🇱🇾' },
  { code: 'LI', name: 'Liechtenstein',        flag: '🇱🇮' },
  { code: 'LT', name: 'Lithuania',            flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg',           flag: '🇱🇺' },
  { code: 'MO', name: 'Macau',                flag: '🇲🇴' },
  { code: 'MG', name: 'Madagascar',           flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi',               flag: '🇲🇼' },
  { code: 'MY', name: 'Malaysia',             flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives',             flag: '🇲🇻' },
  { code: 'ML', name: 'Mali',                 flag: '🇲🇱' },
  { code: 'MT', name: 'Malta',                flag: '🇲🇹' },
  { code: 'MH', name: 'Marshall Islands',     flag: '🇲🇭' },
  { code: 'MR', name: 'Mauritania',           flag: '🇲🇷' },
  { code: 'MU', name: 'Mauritius',            flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico',               flag: '🇲🇽' },
  { code: 'FM', name: 'Micronesia',           flag: '🇫🇲' },
  { code: 'MD', name: 'Moldova',              flag: '🇲🇩' },
  { code: 'MC', name: 'Monaco',               flag: '🇲🇨' },
  { code: 'MN', name: 'Mongolia',             flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro',           flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco',              flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique',           flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar',              flag: '🇲🇲' },
  { code: 'NA', name: 'Namibia',              flag: '🇳🇦' },
  { code: 'NR', name: 'Nauru',                flag: '🇳🇷' },
  { code: 'NP', name: 'Nepal',                flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands',          flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand',          flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua',            flag: '🇳🇮' },
  { code: 'NE', name: 'Niger',                flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria',              flag: '🇳🇬' },
  { code: 'KP', name: 'North Korea',          flag: '🇰🇵' },
  { code: 'MK', name: 'North Macedonia',      flag: '🇲🇰' },
  { code: 'NO', name: 'Norway',               flag: '🇳🇴' },
  { code: 'OM', name: 'Oman',                 flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan',             flag: '🇵🇰' },
  { code: 'PW', name: 'Palau',                flag: '🇵🇼' },
  { code: 'PS', name: 'Palestine',            flag: '🇵🇸' },
  { code: 'PA', name: 'Panama',               flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea',     flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay',             flag: '🇵🇾' },
  { code: 'PE', name: 'Peru',                 flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines',          flag: '🇵🇭' },
  { code: 'PL', name: 'Poland',               flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal',             flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar',                flag: '🇶🇦' },
  { code: 'RO', name: 'Romania',              flag: '🇷🇴' },
  { code: 'RU', name: 'Russia',               flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda',               flag: '🇷🇼' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: 'LC', name: 'Saint Lucia',          flag: '🇱🇨' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  { code: 'WS', name: 'Samoa',                flag: '🇼🇸' },
  { code: 'SM', name: 'San Marino',           flag: '🇸🇲' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal',              flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia',               flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles',           flag: '🇸🇨' },
  { code: 'SL', name: 'Sierra Leone',         flag: '🇸🇱' },
  { code: 'SG', name: 'Singapore',            flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia',             flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia',             flag: '🇸🇮' },
  { code: 'SB', name: 'Solomon Islands',      flag: '🇸🇧' },
  { code: 'SO', name: 'Somalia',              flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa',         flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea',          flag: '🇰🇷' },
  { code: 'SS', name: 'South Sudan',          flag: '🇸🇸' },
  { code: 'ES', name: 'Spain',                flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka',            flag: '🇱🇰' },
  { code: 'SD', name: 'Sudan',                flag: '🇸🇩' },
  { code: 'SR', name: 'Suriname',             flag: '🇸🇷' },
  { code: 'SE', name: 'Sweden',               flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland',          flag: '🇨🇭' },
  { code: 'SY', name: 'Syria',                flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan',               flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan',           flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania',             flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand',             flag: '🇹🇭' },
  { code: 'TL', name: 'Timor-Leste',          flag: '🇹🇱' },
  { code: 'TG', name: 'Togo',                 flag: '🇹🇬' },
  { code: 'TO', name: 'Tonga',                flag: '🇹🇴' },
  { code: 'TT', name: 'Trinidad and Tobago',  flag: '🇹🇹' },
  { code: 'TN', name: 'Tunisia',              flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey',               flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan',         flag: '🇹🇲' },
  { code: 'TV', name: 'Tuvalu',               flag: '🇹🇻' },
  { code: 'UG', name: 'Uganda',               flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine',              flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom',       flag: '🇬🇧' },
  { code: 'US', name: 'United States',        flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay',              flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan',           flag: '🇺🇿' },
  { code: 'VU', name: 'Vanuatu',              flag: '🇻🇺' },
  { code: 'VA', name: 'Vatican City',         flag: '🇻🇦' },
  { code: 'VE', name: 'Venezuela',            flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam',              flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen',                flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia',               flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',             flag: '🇿🇼' },
] as const

// O(1) lookup by ISO code — built once at module load.
export const COUNTRIES_BY_CODE: Readonly<Record<string, Country>> = Object.freeze(
  Object.fromEntries(COUNTRIES.map(c => [c.code, c]))
)

/**
 * Display label for a country code, e.g. "🇮🇪 Ireland".
 * Falls back to the raw code if unknown so we never render undefined.
 */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return ''
  const c = COUNTRIES_BY_CODE[code.toUpperCase()]
  return c ? `${c.flag} ${c.name}` : code
}

/**
 * Build the LocationFilter `countryOptions` array by merging:
 *   * countries that appear in the caller's data (with counts), shown FIRST
 *   * the full ISO 3166-1 list afterwards (no counts)
 *
 * The "data first" ordering means the most relevant locations float to the
 * top of the dropdown without truncating the global list.
 *
 * @param dataCounts Map from ISO code → number of items in the current page
 *                   (e.g. derived from `services` / `jobs` / `events`)
 */
export function buildCountryOptions(
  dataCounts: Map<string, number>
): Array<{ code: string; label: string; count?: number }> {
  const seen = new Set<string>()
  const out: Array<{ code: string; label: string; count?: number }> = []

  // 1. Data-derived countries first, sorted by count desc
  const sortedFromData = Array.from(dataCounts.entries())
    .filter(([code]) => Boolean(code))
    .sort((a, b) => b[1] - a[1])

  for (const [code, count] of sortedFromData) {
    const upper = code.toUpperCase()
    seen.add(upper)
    out.push({
      code:  upper,
      label: countryLabel(upper),
      count,
    })
  }

  // 2. Then every other country alphabetically by name
  for (const c of COUNTRIES) {
    if (seen.has(c.code)) continue
    out.push({
      code:  c.code,
      label: `${c.flag} ${c.name}`,
    })
  }

  return out
}
