export interface ProductCategory {
  id : string
  label: string
  serpQuery: string
  subcategories?: string[]
  icon: string
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'art-printed-products',
    label: 'Art & Printed Products',
    serpQuery: 'trending art prints posters wall art',
    subcategories: ['wall art', 'posters', 'canvas prints', 'photography', 'illustration'],
    icon: '🎨',
  },
  {
    id: 'books',
    label: 'Books',
    serpQuery: 'trending books bestsellers',
    subcategories: ['fiction', 'non-fiction', 'children', 'textbooks', 'self-help', 'biography'],
    icon: '📚',
  },
  {
    id: 'business',
    label: 'Business',
    serpQuery: 'trending business office supplies products',
    subcategories: ['office supplies', 'stationery', 'printers', 'whiteboards', 'desk accessories'],
    icon: '💼',
  },
  {
    id: 'computer-accessories',
    label: 'Computer Accessories',
    serpQuery: 'trending computer accessories peripherals',
    subcategories: ['keyboards', 'mice', 'monitors', 'webcams', 'USB hubs', 'cables'],
    icon: '🖥️',
  },
  {
    id: 'construction-supplies',
    label: 'Construction Supplies',
    serpQuery: 'trending construction building supplies materials',
    subcategories: ['timber', 'fixings', 'insulation', 'adhesives', 'safety gear', 'PPE'],
    icon: '🏗️',
  },
  {
    id: 'clothing',
    label: 'Clothing',
    serpQuery: 'trending clothing fashion apparel',
    subcategories: ['mens', 'womens', 'kids', 'activewear', 'outerwear', 'underwear'],
    icon: '👗',
  },
  {
    id: 'electronics',
    label: 'Electronics',
    serpQuery: 'trending consumer electronics gadgets',
    subcategories: ['smartphones', 'smart TVs', 'cameras', 'drones', 'audio', 'wearables'],
    icon: '⚡',
  },
  {
    id: 'fitness-equipment',
    label: 'Fitness Equipment',
    serpQuery: 'trending fitness gym equipment home workout',
    subcategories: ['weights', 'resistance bands', 'yoga mats', 'treadmills', 'kettlebells'],
    icon: '🏋️',
  },
  {
    id: 'furniture',
    label: 'Furniture',
    serpQuery: 'trending furniture home living room bedroom',
    subcategories: ['sofas', 'beds', 'desks', 'chairs', 'storage', 'shelving'],
    icon: '🛋️',
  },
  {
    id: 'gardening',
    label: 'Gardening',
    serpQuery: 'trending gardening tools plants seeds outdoor',
    subcategories: ['tools', 'seeds', 'planters', 'compost', 'lawn care', 'grow lights'],
    icon: '🌱',
  },
  {
    id: 'hardware-tools',
    label: 'Hardware Tools',
    serpQuery: 'trending hardware tools DIY power tools',
    subcategories: ['power tools', 'hand tools', 'drills', 'saws', 'measuring', 'tool storage'],
    icon: '🔧',
  },
  {
    id: 'headphones',
    label: 'Headphones',
    serpQuery: 'trending headphones earbuds noise cancelling',
    subcategories: ['over-ear', 'in-ear', 'wireless', 'noise cancelling', 'gaming headsets'],
    icon: '🎧',
  },
  {
    id: 'laptops',
    label: 'Laptops',
    serpQuery: 'trending laptops notebooks ultrabooks',
    subcategories: ['gaming laptops', 'ultrabooks', 'Chromebooks', '2-in-1', 'MacBooks'],
    icon: '💻',
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    serpQuery: 'trending outdoor camping hiking adventure gear',
    subcategories: ['tents', 'sleeping bags', 'hiking boots', 'backpacks', 'torches', 'survival'],
    icon: '⛺',
  },
  {
    id: 'smart-home',
    label: 'Smart Home',
    serpQuery: 'trending smart home automation devices',
    subcategories: ['smart speakers', 'smart bulbs', 'security cameras', 'thermostats', 'doorbells'],
    icon: '🏠',
  },
  {
    id: 'speakers',
    label: 'Speakers',
    serpQuery: 'trending speakers bluetooth portable audio',
    subcategories: ['bluetooth speakers', 'soundbars', 'home cinema', 'studio monitors', 'portable'],
    icon: '🔊',
  },
  {
    id: 'sports-outdoor',
    label: 'Sports & Outdoor',
    serpQuery: 'trending sports equipment accessories',
    subcategories: ['cycling', 'running', 'football', 'swimming', 'tennis', 'golf'],
    icon: '⚽',
  },
  {
    id: 'tablets',
    label: 'Tablets',
    serpQuery: 'trending tablets iPads Android tablets',
    subcategories: ['iPads', 'Android tablets', 'drawing tablets', 'e-readers', 'kids tablets'],
    icon: '📱',
  },
  {
    id: 'food-grocery',
    label: 'Food & Grocery',
    serpQuery: 'trending food grocery supermarket products',
    subcategories: ['snacks', 'drinks', 'health food', 'ingredients', 'meal kits', 'organic'],
    icon: '🛒',
  },
  {
    id: 'beauty',
    label: 'Beauty & Personal Care',
    serpQuery: 'trending beauty skincare personal care products',
    subcategories: ['skincare', 'makeup', 'haircare', 'fragrance', 'mens grooming', 'wellness'],
    icon: '✨',
  },
  {
    id: 'pets',
    label: 'Pets',
    serpQuery: 'trending pet supplies accessories food',
    subcategories: ['dogs', 'cats', 'fish', 'birds', 'small animals', 'pet health'],
    icon: '🐾',
  },
  {
    id: 'toys-kids',
    label: 'Toys & Kids',
    serpQuery: 'trending toys kids games educational',
    subcategories: ['toddler', 'board games', 'outdoor play', 'STEM', 'dolls', 'action figures'],
    icon: '🧸',
  },
  {
    id: 'music',
    label: 'Music',
    serpQuery: 'trending musical instruments music accessories',
    subcategories: ['guitars', 'keyboards', 'drums', 'DJ equipment', 'recording', 'accessories'],
    icon: '🎵',
  },
  {
    id: 'digital-products',
    label: 'Digital Products',
    serpQuery: 'trending digital products software online tools',
    subcategories: ['software', 'games', 'courses', 'templates', 'stock media', 'subscriptions'],
    icon: '💾',
  },
  {
    id: 'home-living',
    label: 'Home & Living',
    serpQuery: 'trending home decor living accessories',
    subcategories: ['decor', 'kitchen', 'bedding', 'lighting', 'bathroom', 'cleaning'],
    icon: '🕯️',
  },
  {
    id: 'fashion',
    label: 'Fashion',
    serpQuery: 'trending fashion accessories footwear bags',
    subcategories: ['footwear', 'bags', 'jewellery', 'watches', 'sunglasses', 'hats'],
    icon: '👠',
  },
  {
    id: 'travel-luggage',
    label: 'Travel & Luggage',
    serpQuery: 'trending travel luggage bags accessories',
    subcategories: ['suitcases', 'backpacks', 'travel accessories', 'neck pillows', 'packing cubes'],
    icon: '✈️',
  },
]

// Max products to fetch per category per cron run (SerpApi max is 100)
export const PRODUCTS_PER_CATEGORY = 100

// How many to show initially before "Load More"
export const PRODUCTS_INITIAL_DISPLAY = 20

// How many more to load per "Load More" click
export const PRODUCTS_LOAD_MORE_BATCH = 20

// Archive products not refreshed in this many days
export const ARCHIVE_AFTER_DAYS = 30

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  tech: 'electronics',
  technology: 'electronics',
  art: 'art-printed-products',
  home: 'home-living',
  sports: 'sports-outdoor',
  toys: 'toys-kids',
  food: 'food-grocery',
  'food-groceries': 'food-grocery',
  garden: 'gardening',
  digital: 'digital-products',
  physical: 'home-living',
}

export function normaliseExternalCategory(category: string | null | undefined) {
  if (!category) return 'electronics'
  const normalized = LEGACY_CATEGORY_MAP[category] ?? category
  if (PRODUCT_CATEGORIES.some(item => item.id === normalized)) return normalized
  return normalized
}

export function categoryMeta(category: string | null | undefined) {
  const normalized = normaliseExternalCategory(category)
  return PRODUCT_CATEGORIES.find(item => item.id === normalized) ?? PRODUCT_CATEGORIES[0]
}
