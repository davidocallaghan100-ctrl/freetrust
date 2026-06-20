export const EVENT_CATEGORIES = [
  'All',
  'Technology',
  'Business',
  'Career & Networking',
  'Arts & Culture',
  'Music',
  'Film & Media',
  'Food & Drink',
  'Sports & Fitness',
  'Health & Wellness',
  'Outdoors & Adventure',
  'Education',
  'Science',
  'Games',
  'Parents & Family',
  'Community',
  'Charity & Causes',
  'Fashion & Beauty',
  'Travel',
] as const

export type EventCategory = typeof EVENT_CATEGORIES[number]

export const EVENT_CATEGORY_COLORS: Record<string, string> = {
  Technology: '#34d399',
  Business: '#a78bfa',
  'Career & Networking': '#38bdf8',
  'Arts & Culture': '#f472b6',
  Music: '#fb7185',
  'Film & Media': '#818cf8',
  'Food & Drink': '#f59e0b',
  'Sports & Fitness': '#22c55e',
  'Health & Wellness': '#fb923c',
  'Outdoors & Adventure': '#4ade80',
  Education: '#a78bfa',
  Science: '#2dd4bf',
  Games: '#c084fc',
  'Parents & Family': '#fbbf24',
  Community: '#38bdf8',
  'Charity & Causes': '#60a5fa',
  'Fashion & Beauty': '#f472b6',
  Travel: '#06b6d4',
  Startup: '#38bdf8',
  AI: '#e879f9',
  Design: '#f472b6',
  Marketing: '#fb923c',
  Web3: '#818cf8',
  'E-commerce': '#f59e0b',
  Sustainability: '#4ade80',
  Finance: '#fbbf24',
}

export const EVENT_CATEGORY_GRADIENTS: Record<string, string> = {
  Technology: 'linear-gradient(135deg,#059669,#047857)',
  Business: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
  'Career & Networking': 'linear-gradient(135deg,#0284c7,#1e40af)',
  'Arts & Culture': 'linear-gradient(135deg,#db2777,#9d174d)',
  Music: 'linear-gradient(135deg,#e11d48,#881337)',
  'Film & Media': 'linear-gradient(135deg,#4f46e5,#312e81)',
  'Food & Drink': 'linear-gradient(135deg,#d97706,#92400e)',
  'Sports & Fitness': 'linear-gradient(135deg,#16a34a,#14532d)',
  'Health & Wellness': 'linear-gradient(135deg,#ea580c,#c2410c)',
  'Outdoors & Adventure': 'linear-gradient(135deg,#059669,#065f46)',
  Education: 'linear-gradient(135deg,#7c3aed,#4338ca)',
  Science: 'linear-gradient(135deg,#0d9488,#115e59)',
  Games: 'linear-gradient(135deg,#9333ea,#581c87)',
  'Parents & Family': 'linear-gradient(135deg,#d97706,#b45309)',
  Community: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
  'Charity & Causes': 'linear-gradient(135deg,#2563eb,#1e3a8a)',
  'Fashion & Beauty': 'linear-gradient(135deg,#db2777,#be185d)',
  Travel: 'linear-gradient(135deg,#0891b2,#155e75)',
  Startup: 'linear-gradient(135deg,#0284c7,#1e40af)',
  AI: 'linear-gradient(135deg,#a855f7,#6d28d9)',
  Design: 'linear-gradient(135deg,#db2777,#9d174d)',
  Marketing: 'linear-gradient(135deg,#ea580c,#c2410c)',
  Web3: 'linear-gradient(135deg,#4f46e5,#3730a3)',
  'E-commerce': 'linear-gradient(135deg,#d97706,#b45309)',
  Sustainability: 'linear-gradient(135deg,#059669,#065f46)',
  Finance: 'linear-gradient(135deg,#d97706,#92400e)',
}

const CATEGORY_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Technology', patterns: [/\btech(?:nology)?\b/i, /\bsoftware\b/i, /\bdeveloper\b/i, /\bprogramming\b/i, /\bai\b/i, /\bdata\b/i, /\bweb3\b/i] },
  { category: 'Business', patterns: [/\bbusiness\b/i, /\bfounder\b/i, /\bentrepreneur\b/i, /\bstartup\b/i, /\bfinance\b/i, /\binvest(?:or|ing|ment)?\b/i] },
  { category: 'Career & Networking', patterns: [/\bnetworking\b/i, /\bcareer\b/i, /\bjob fair\b/i, /\brecruit(?:ment|ing)?\b/i, /\bprofessional\b/i] },
  { category: 'Arts & Culture', patterns: [/\barts?\b/i, /\btheatre\b/i, /\btheater\b/i, /\bculture\b/i, /\bmuseum\b/i, /\bgallery\b/i, /\bcomedy\b/i] },
  { category: 'Music', patterns: [/\bmusic\b/i, /\bconcert\b/i, /\bgig\b/i, /\bfestival\b/i, /\bdj\b/i, /\bchoir\b/i] },
  { category: 'Film & Media', patterns: [/\bfilm\b/i, /\bcinema\b/i, /\bmovie\b/i, /\bmedia\b/i, /\bphotograph(?:y|er)\b/i] },
  { category: 'Food & Drink', patterns: [/\bfood\b/i, /\bdrink\b/i, /\bcoffee\b/i, /\bwine\b/i, /\bbeer\b/i, /\bcooking\b/i, /\brestaurant\b/i] },
  { category: 'Sports & Fitness', patterns: [/\bsports?\b/i, /\bfitness\b/i, /\brunning\b/i, /\bcycling\b/i, /\byoga\b/i, /\bfootball\b/i, /\brugby\b/i] },
  { category: 'Health & Wellness', patterns: [/\bhealth\b/i, /\bwellness\b/i, /\bmental health\b/i, /\bmeditation\b/i, /\btherapy\b/i, /\bwellbeing\b/i] },
  { category: 'Outdoors & Adventure', patterns: [/\boutdoor\b/i, /\badventure\b/i, /\bhiking\b/i, /\bwalking\b/i, /\bnature\b/i, /\btravel\b/i] },
  { category: 'Education', patterns: [/\beducation\b/i, /\bclass\b/i, /\bworkshop\b/i, /\blearning\b/i, /\blanguage\b/i, /\blecture\b/i] },
  { category: 'Science', patterns: [/\bscience\b/i, /\bresearch\b/i, /\bengineering\b/i, /\bclimate\b/i] },
  { category: 'Games', patterns: [/\bgames?\b/i, /\bgaming\b/i, /\bboard game\b/i, /\bquiz\b/i, /\btrivia\b/i] },
  { category: 'Parents & Family', patterns: [/\bfamily\b/i, /\bparents?\b/i, /\bkids?\b/i, /\bchildren\b/i] },
  { category: 'Charity & Causes', patterns: [/\bcharit(?:y|ies)\b/i, /\bnon[-\s]?profit\b/i, /\bfundrais(?:er|ing)\b/i, /\bvolunteer\b/i, /\bcause\b/i] },
  { category: 'Fashion & Beauty', patterns: [/\bfashion\b/i, /\bbeauty\b/i, /\bstyle\b/i, /\bmakeup\b/i] },
  { category: 'Travel', patterns: [/\btravel\b/i, /\btour\b/i, /\btourism\b/i] },
]

export function normalizeEventCategory(category?: string | null, haystack = ''): string {
  const raw = (category ?? '').trim()
  const text = `${raw} ${haystack}`.trim()
  if (!text) return 'Community'

  const direct: Record<string, string> = {
    AI: 'Technology',
    Startup: 'Business',
    Design: 'Arts & Culture',
    Marketing: 'Business',
    Web3: 'Technology',
    'E-commerce': 'Business',
    Sustainability: 'Community',
    Finance: 'Business',
    Health: 'Health & Wellness',
    Entertainment: 'Community',
    Miscellaneous: 'Community',
    'Arts & Theatre': 'Arts & Culture',
    Theatre: 'Arts & Culture',
    Sports: 'Sports & Fitness',
    Conferences: 'Business',
    Expos: 'Business',
  }
  if (direct[raw]) return direct[raw]
  if (EVENT_CATEGORIES.includes(raw as EventCategory) && raw !== 'All') return raw

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(pattern => pattern.test(text))) return rule.category
  }
  return raw || 'Community'
}
