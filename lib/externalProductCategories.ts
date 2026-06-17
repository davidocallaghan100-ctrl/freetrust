export interface ProductCategory {
  id: string
  label: string
  serpQuery: string
  subcategories?: string[]
  icon: string
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'tech',
    label: 'Tech',
    serpQuery: 'trending tech gadgets electronics',
    subcategories: ['smartphones', 'laptops', 'audio', 'smart home', 'cameras'],
    icon: '💻',
  },
  {
    id: 'art',
    label: 'Art',
    serpQuery: 'trending art supplies craft materials',
    subcategories: ['painting', 'drawing', 'sculpture', 'photography prints'],
    icon: '🎨',
  },
  {
    id: 'music',
    label: 'Music',
    serpQuery: 'trending musical instruments accessories',
    subcategories: ['instruments', 'recording', 'DJ', 'sheet music'],
    icon: '🎵',
  },
  {
    id: 'fashion',
    label: 'Fashion',
    serpQuery: 'trending fashion clothing accessories',
    subcategories: ['mens', 'womens', 'footwear', 'bags', 'jewellery'],
    icon: '👗',
  },
  {
    id: 'home',
    label: 'Home',
    serpQuery: 'trending home decor furniture living',
    subcategories: ['furniture', 'decor', 'kitchen', 'bedding', 'lighting'],
    icon: '🏠',
  },
  {
    id: 'sports',
    label: 'Sports',
    serpQuery: 'trending sports equipment outdoor gear',
    subcategories: ['fitness', 'cycling', 'running', 'team sports', 'camping'],
    icon: '⚽',
  },
  {
    id: 'books',
    label: 'Books',
    serpQuery: 'trending books bestsellers education',
    subcategories: ['fiction', 'non-fiction', 'children', 'textbooks', 'self-help'],
    icon: '📚',
  },
  {
    id: 'beauty',
    label: 'Beauty',
    serpQuery: 'trending beauty skincare personal care products',
    subcategories: ['skincare', 'makeup', 'haircare', 'fragrance', 'wellness'],
    icon: '✨',
  },
  {
    id: 'toys',
    label: 'Toys',
    serpQuery: 'trending toys kids games educational',
    subcategories: ['toddler', 'board games', 'outdoor play', 'STEM', 'dolls'],
    icon: '🧸',
  },
  {
    id: 'food',
    label: 'Food',
    serpQuery: 'trending food grocery supermarket products',
    subcategories: ['snacks', 'drinks', 'health food', 'ingredients', 'meal kits'],
    icon: '🛒',
  },
  {
    id: 'garden',
    label: 'Garden',
    serpQuery: 'trending garden tools plants outdoor',
    subcategories: ['tools', 'plants', 'furniture', 'BBQ', 'lawn care'],
    icon: '🌱',
  },
  {
    id: 'pets',
    label: 'Pets',
    serpQuery: 'trending pet supplies accessories food',
    subcategories: ['dogs', 'cats', 'fish', 'birds', 'small animals'],
    icon: '🐾',
  },
  {
    id: 'digital',
    label: 'Digital',
    serpQuery: 'trending digital products software subscriptions',
    subcategories: ['software', 'games', 'courses', 'templates', 'stock media'],
    icon: '💾',
  },
  {
    id: 'physical',
    label: 'Physical',
    serpQuery: 'trending general merchandise products',
    subcategories: ['storage', 'tools', 'cleaning', 'stationery', 'gifts'],
    icon: '📦',
  },
]

export const PRODUCTS_PER_CATEGORY = 15

export const ARCHIVE_AFTER_DAYS = 30

export function normaliseExternalCategory(category: string | null | undefined) {
  if (!category) return 'tech'
  if (category === 'technology') return 'tech'
  if (category === 'food-groceries') return 'food'
  if (PRODUCT_CATEGORIES.some(item => item.id === category)) return category
  return category
}

export function categoryMeta(category: string | null | undefined) {
  const normalized = normaliseExternalCategory(category)
  return PRODUCT_CATEGORIES.find(item => item.id === normalized) ?? PRODUCT_CATEGORIES[0]
}
