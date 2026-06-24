export interface ProductCategory {
  id : string
  label: string
  serpQuery: string
  serpQueries?: string[]
  subcategories?: string[]
  icon: string
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'appliances', label: 'Appliances', serpQuery: 'home appliances Ireland washing machine fridge freezer dishwasher',
    serpQueries: ['home appliances Ireland washing machine fridge freezer dishwasher', 'small appliances Ireland air fryer microwave kettle toaster'],
    subcategories: ['washing machines', 'fridges', 'freezers', 'dishwashers', 'microwaves', 'small appliances'], icon: '🔌',
  },
  { id: 'art-printed-products', label: 'Art & Printed Products', serpQuery: 'trending art prints posters wall art', subcategories: ['wall art', 'posters', 'canvas prints', 'photography', 'illustration'], icon: '🎨' },
  { id: 'beauty', label: 'Beauty & Personal Care', serpQuery: 'trending beauty skincare personal care products', subcategories: ['skincare', 'makeup', 'haircare', 'fragrance', 'mens grooming', 'wellness'], icon: '✨' },
  { id: 'books', label: 'Books', serpQuery: 'trending books bestsellers', subcategories: ['fiction', 'non-fiction', 'children', 'textbooks', 'self-help', 'biography'], icon: '📚' },
  {
    id: 'bulk-buy', label: 'Bulk Buy', serpQuery: 'bulk buy household essentials multipack Ireland',
    serpQueries: ['bulk buy household essentials multipack Ireland', 'bulk buy groceries toiletries cleaning supplies Ireland'],
    subcategories: ['multipacks', 'household essentials', 'cleaning supplies', 'toiletries', 'pantry staples', 'office bulk'], icon: '📦',
  },
  { id: 'business', label: 'Business', serpQuery: 'trending business office supplies products', subcategories: ['office supplies', 'stationery', 'printers', 'whiteboards', 'desk accessories'], icon: '💼' },
  {
    id: 'cleaning', label: 'Cleaning', serpQuery: 'cleaning products supplies Ireland vacuum mop detergent disinfectant',
    serpQueries: ['cleaning products supplies Ireland vacuum mop detergent disinfectant', 'household cleaning supplies Ireland sprays cloths floor cleaner'],
    subcategories: ['cleaning sprays', 'detergent', 'mops', 'vacuum cleaners', 'cloths', 'floor cleaner'], icon: '🧽',
  },
  {
    id: 'fashion-her', label: 'Clothes for Her', serpQuery: 'womens clothing fashion Ireland dresses tops coats jeans',
    serpQueries: ['womens clothing fashion Ireland dresses tops coats jeans', 'womens clothes online Ireland knitwear jackets activewear'],
    subcategories: ['dresses', 'tops', 'coats', 'jeans', 'knitwear', 'activewear', 'womens accessories'], icon: '👗',
  },
  {
    id: 'fashion-him', label: 'Clothes for Him', serpQuery: 'mens clothing fashion Ireland shirts jackets jeans hoodies',
    serpQueries: ['mens clothing fashion Ireland shirts jackets jeans hoodies', 'mens clothes online Ireland coats trainers knitwear'],
    subcategories: ['shirts', 'jackets', 'jeans', 'hoodies', 'knitwear', 'mens footwear', 'mens accessories'], icon: '👔',
  },
  { id: 'clothing', label: 'Clothing', serpQuery: 'trending clothing fashion apparel', subcategories: ['mens', 'womens', 'kids', 'activewear', 'outerwear', 'underwear'], icon: '🧥' },
  { id: 'computer-accessories', label: 'Computer Accessories', serpQuery: 'trending computer accessories peripherals', subcategories: ['keyboards', 'mice', 'monitors', 'webcams', 'USB hubs', 'cables'], icon: '🖥️' },
  { id: 'construction-supplies', label: 'Construction Supplies', serpQuery: 'trending construction building supplies materials', subcategories: ['timber', 'fixings', 'insulation', 'adhesives', 'safety gear', 'PPE'], icon: '🏗️' },
  {
    id: 'cooking', label: 'Cooking', serpQuery: 'cooking cookware bakeware utensils Ireland pots pans knives',
    serpQueries: ['cooking cookware bakeware utensils Ireland pots pans knives', 'cooking equipment Ireland air fryer saucepan frying pan baking tray'],
    subcategories: ['pots', 'pans', 'bakeware', 'knives', 'utensils', 'air fryers'], icon: '🥘',
  },
  {
    id: 'cooling', label: 'Cooling', serpQuery: 'cooling fans air conditioners portable air cooler Ireland',
    serpQueries: ['cooling fans air conditioners portable air cooler Ireland', 'desk fan tower fan air cooler Ireland'],
    subcategories: ['fans', 'air conditioners', 'air coolers', 'tower fans', 'desk fans', 'portable cooling'], icon: '❄️',
  },
  { id: 'digital-products', label: 'Digital Products', serpQuery: 'trending digital products software online tools', subcategories: ['software', 'games', 'courses', 'templates', 'stock media', 'subscriptions'], icon: '💾' },
  {
    id: 'diy', label: 'DIY', serpQuery: 'DIY tools home improvement Ireland power tools paint hardware',
    serpQueries: ['DIY tools home improvement Ireland power tools paint hardware', 'DIY home improvement supplies Ireland drills screws paint'],
    subcategories: ['power tools', 'hand tools', 'paint', 'fixings', 'adhesives', 'tool storage', 'PPE'], icon: '🧰',
  },
  { id: 'electronics', label: 'Electronics', serpQuery: 'trending consumer electronics gadgets', subcategories: ['smartphones', 'smart TVs', 'cameras', 'drones', 'audio', 'wearables'], icon: '⚡' },
  { id: 'energy', label: 'Energy', serpQuery: 'trending home energy products solar panels batteries EV chargers energy saving devices', subcategories: ['solar panels', 'battery storage', 'EV chargers', 'smart thermostats', 'energy monitors', 'portable power'], icon: '🔋' },
  { id: 'fitness-equipment', label: 'Fitness Equipment', serpQuery: 'trending fitness gym equipment home workout', subcategories: ['weights', 'resistance bands', 'yoga mats', 'treadmills', 'kettlebells'], icon: '🏋️' },
  { id: 'food-grocery', label: 'Food & Grocery', serpQuery: 'trending food grocery supermarket products', subcategories: ['snacks', 'drinks', 'health food', 'ingredients', 'meal kits', 'organic'], icon: '🛒' },
  { id: 'furniture', label: 'Furniture', serpQuery: 'trending furniture home living room bedroom', subcategories: ['sofas', 'beds', 'desks', 'chairs', 'storage', 'shelving'], icon: '🛋️' },
  {
    id: 'gaming', label: 'Gaming', serpQuery: 'gaming consoles games accessories Ireland PlayStation Xbox Nintendo PC',
    serpQueries: ['gaming consoles games accessories Ireland PlayStation Xbox Nintendo PC', 'gaming accessories Ireland controller headset keyboard mouse'],
    subcategories: ['consoles', 'games', 'controllers', 'gaming headsets', 'gaming keyboards', 'gaming chairs'], icon: '🎮',
  },
  { id: 'gardening', label: 'Gardening', serpQuery: 'trending gardening tools plants seeds outdoor', subcategories: ['tools', 'seeds', 'planters', 'compost', 'lawn care', 'grow lights'], icon: '🌱' },
  { id: 'hardware-tools', label: 'Hardware Tools', serpQuery: 'trending hardware tools DIY power tools', subcategories: ['power tools', 'hand tools', 'drills', 'saws', 'measuring', 'tool storage'], icon: '🔧' },
  { id: 'headphones', label: 'Headphones', serpQuery: 'trending headphones earbuds noise cancelling', subcategories: ['over-ear', 'in-ear', 'wireless', 'noise cancelling', 'gaming headsets'], icon: '🎧' },
  { id: 'home-living', label: 'Home & Living', serpQuery: 'trending home decor living accessories', subcategories: ['decor', 'kitchen', 'bedding', 'lighting', 'bathroom', 'cleaning'], icon: '🕯️' },
  {
    id: 'jewellery', label: 'Jewellery', serpQuery: 'jewellery Ireland rings necklaces bracelets earrings watches',
    serpQueries: ['jewellery Ireland rings necklaces bracelets earrings watches', 'gold silver jewellery Ireland engagement rings necklaces'],
    subcategories: ['rings', 'necklaces', 'bracelets', 'earrings', 'watches', 'silver jewellery'], icon: '💍',
  },
  {
    id: 'kitchen', label: 'Kitchen', serpQuery: 'kitchen appliances cookware utensils Ireland',
    serpQueries: ['kitchen appliances cookware utensils Ireland', 'kitchen storage dinnerware small appliances Ireland'],
    subcategories: ['cookware', 'utensils', 'small appliances', 'dinnerware', 'storage', 'coffee machines'], icon: '🍳',
  },
  { id: 'laptops', label: 'Laptops', serpQuery: 'trending laptops notebooks ultrabooks', subcategories: ['gaming laptops', 'ultrabooks', 'Chromebooks', '2-in-1', 'MacBooks'], icon: '💻' },
  {
    id: 'lighting', label: 'Lighting', serpQuery: 'home lighting lamps LED ceiling lights Ireland',
    serpQueries: ['home lighting lamps LED ceiling lights Ireland', 'floor lamps desk lamps outdoor lighting Ireland'],
    subcategories: ['ceiling lights', 'floor lamps', 'desk lamps', 'LED bulbs', 'outdoor lighting', 'smart lighting'], icon: '💡',
  },
  {
    id: 'mobile-phone', label: 'Mobile Phone', serpQuery: 'mobile phones smartphones unlocked Ireland iPhone Samsung Google Pixel',
    serpQueries: ['mobile phones smartphones unlocked Ireland iPhone Samsung Google Pixel', 'SIM free mobile phones Ireland iPhone Samsung Android'],
    subcategories: ['iPhone', 'Samsung', 'Android', 'SIM free', 'phone cases', 'chargers'], icon: '📱',
  },
  { id: 'music', label: 'Music', serpQuery: 'trending musical instruments music accessories', subcategories: ['guitars', 'keyboards', 'drums', 'DJ equipment', 'recording', 'accessories'], icon: '🎵' },
  {
    id: 'office', label: 'Office', serpQuery: 'office supplies furniture stationery Ireland desks chairs printers',
    serpQueries: ['office supplies furniture stationery Ireland desks chairs printers', 'home office equipment Ireland monitor chair desk stationery'],
    subcategories: ['stationery', 'desks', 'chairs', 'printers', 'monitors', 'storage'], icon: '🗄️',
  },
  {
    id: 'online-courses', label: 'Online Courses', serpQuery: 'online courses Ireland certification',
    serpQueries: ['online courses Ireland certification', 'Irish online training courses certification'],
    subcategories: ['business courses', 'creative courses', 'coding courses', 'fitness courses', 'language courses', 'career training'], icon: '🎓',
  },
  { id: 'outdoor', label: 'Outdoor', serpQuery: 'trending outdoor camping hiking adventure gear', subcategories: ['tents', 'sleeping bags', 'hiking boots', 'backpacks', 'torches', 'survival'], icon: '⛺' },
  {
    id: 'pets', label: 'Pets', serpQuery: 'pet supplies food toys accessories Ireland dogs cats',
    serpQueries: ['pet supplies food toys accessories Ireland dogs cats', 'dog food cat food pet beds toys Ireland'],
    subcategories: ['dogs', 'cats', 'fish', 'birds', 'small animals', 'pet health'], icon: '🐾',
  },
  {
    id: 'plants', label: 'Plants', serpQuery: 'buy houseplants garden plants Ireland',
    serpQueries: ['buy houseplants garden plants Ireland', 'garden plants shrubs trees Ireland buy online'],
    subcategories: ['houseplants', 'garden plants', 'flowers', 'shrubs', 'trees', 'seedlings', 'plant pots'], icon: '🪴',
  },
  { id: 'shoes', label: 'Shoes', serpQuery: 'trending shoes sneakers boots footwear Ireland', subcategories: ['sneakers', 'trainers', 'boots', 'running shoes', 'formal shoes', 'sandals', 'kids shoes'], icon: '👟' },
  {
    id: 'shoes-her', label: 'Shoes for Her', serpQuery: 'womens shoes Ireland heels boots trainers sandals',
    serpQueries: ['womens shoes Ireland heels boots trainers sandals', 'ladies shoes Ireland ankle boots sandals heels'],
    subcategories: ['heels', 'boots', 'trainers', 'sandals', 'flats', 'running shoes'], icon: '👠',
  },
  {
    id: 'shoes-him', label: 'Shoes for Him', serpQuery: 'mens shoes Ireland trainers boots formal shoes runners',
    serpQueries: ['mens shoes Ireland trainers boots formal shoes runners', 'mens footwear Ireland boots runners loafers'],
    subcategories: ['trainers', 'boots', 'formal shoes', 'runners', 'loafers', 'sandals'], icon: '🥾',
  },
  { id: 'smart-home', label: 'Smart Home', serpQuery: 'trending smart home automation devices', subcategories: ['smart speakers', 'smart bulbs', 'security cameras', 'thermostats', 'doorbells'], icon: '🏠' },
  { id: 'speakers', label: 'Speakers', serpQuery: 'trending speakers bluetooth portable audio', subcategories: ['bluetooth speakers', 'soundbars', 'home cinema', 'studio monitors', 'portable'], icon: '🔊' },
  { id: 'sports-outdoor', label: 'Sports & Outdoor', serpQuery: 'trending sports equipment accessories', subcategories: ['cycling', 'running', 'football', 'swimming', 'tennis', 'golf'], icon: '⚽' },
  { id: 'tablets', label: 'Tablets', serpQuery: 'trending tablets iPads Android tablets', subcategories: ['iPads', 'Android tablets', 'drawing tablets', 'e-readers', 'kids tablets'], icon: '📱' },
  { id: 'toys-kids', label: 'Toys & Kids', serpQuery: 'trending toys kids games educational', subcategories: ['toddler', 'board games', 'outdoor play', 'STEM', 'dolls', 'action figures'], icon: '🧸' },
  { id: 'travel-luggage', label: 'Travel & Luggage', serpQuery: 'trending travel luggage bags accessories', subcategories: ['suitcases', 'backpacks', 'travel accessories', 'neck pillows', 'packing cubes'], icon: '✈️' },
  {
    id: 'tv', label: 'TV', serpQuery: 'smart TV televisions Ireland OLED QLED 4K',
    serpQueries: ['smart TV televisions Ireland OLED QLED 4K', '4K TV Ireland Samsung LG Sony television'],
    subcategories: ['4K TV', 'OLED', 'QLED', 'smart TV', 'soundbars', 'TV mounts'], icon: '📺',
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
  appliances: 'appliances',
  appliance: 'appliances',
  sports: 'sports-outdoor',
  toys: 'toys-kids',
  food: 'food-grocery',
  'food-groceries': 'food-grocery',
  garden: 'gardening',
  plants: 'plants',
  plant: 'plants',
  houseplants: 'plants',
  houseplant: 'plants',
  flowers: 'plants',
  digital: 'digital-products',
  physical: 'home-living',
  courses: 'online-courses',
  course: 'online-courses',
  'online-courses': 'online-courses',
  'online courses': 'online-courses',
  training: 'online-courses',
  templates: 'digital-products',
  software: 'digital-products',
  photography: 'art-printed-products',
  handmade: 'art-printed-products',
  merch: 'fashion-him',
  fashion: 'fashion-her',
  jewellery: 'jewellery',
  jewelry: 'jewellery',
  jewelery: 'jewellery',
  'clothes-for-him': 'fashion-him',
  'clothes for him': 'fashion-him',
  'clothes-him': 'fashion-him',
  'mens-clothes': 'fashion-him',
  'men-clothes': 'fashion-him',
  'clothes-for-her': 'fashion-her',
  'clothes for her': 'fashion-her',
  'clothes-her': 'fashion-her',
  'womens-clothes': 'fashion-her',
  'women-clothes': 'fashion-her',
  shoes: 'shoes',
  shoe: 'shoes',
  'shoes-for-him': 'shoes-him',
  'shoes for him': 'shoes-him',
  'mens-shoes': 'shoes-him',
  'men-shoes': 'shoes-him',
  'shoes-for-her': 'shoes-her',
  'shoes for her': 'shoes-her',
  'womens-shoes': 'shoes-her',
  'women-shoes': 'shoes-her',
  'ladies-shoes': 'shoes-her',
  footwear: 'shoes',
  sneakers: 'shoes',
  trainers: 'shoes',
  boots: 'shoes',
  mens: 'fashion-him',
  men: 'fashion-him',
  womens: 'fashion-her',
  women: 'fashion-her',
  energy: 'energy',
  diy: 'diy',
  'do-it-yourself': 'diy',
  cleaning: 'cleaning',
  clean: 'cleaning',
  cooking: 'cooking',
  cook: 'cooking',
  cooling: 'cooling',
  coolers: 'cooling',
  fans: 'cooling',
  'bulk-buy': 'bulk-buy',
  'bulk buy': 'bulk-buy',
  bulk: 'bulk-buy',
  lighting: 'lighting',
  lights: 'lighting',
  office: 'office',
  kitchen: 'kitchen',
  tv: 'tv',
  television: 'tv',
  televisions: 'tv',
  mobile: 'mobile-phone',
  mobiles: 'mobile-phone',
  phone: 'mobile-phone',
  phones: 'mobile-phone',
  smartphone: 'mobile-phone',
  smartphones: 'mobile-phone',
  gaming: 'gaming',
  games: 'gaming',
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

export function isExternalDigitalCategory(category: string | null | undefined) {
  const normalized = normaliseExternalCategory(category)
  return normalized === 'digital-products' || normalized === 'online-courses'
}
