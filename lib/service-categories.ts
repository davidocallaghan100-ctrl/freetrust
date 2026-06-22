// ─── FreeTrust Service Categories ─────────────────────────────────────────────
// Shared across: /services, /seller/gigs/create, /api/listings, search

export type ServiceMode = 'online' | 'offline' | 'both'

export interface ServiceCategory {
  id: string
  label: string
  icon: string
  mode: ServiceMode
  subcategories?: string[]
}

export const ONLINE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    icon: '🤖',
    mode: 'online',
    subcategories: ['ChatGPT / LLM Integration', 'Workflow Automation', 'AI Chatbots', 'Prompt Engineering', 'Make / Zapier', 'AI Content Creation'],
  },
  {
    id: 'business-consulting',
    label: 'Business & Consulting',
    icon: '🧠',
    mode: 'online',
    subcategories: ['Business Strategy', 'Market Research', 'Business Plans', 'Project Management', 'Operations', 'HR Consulting'],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    icon: '🛠️',
    mode: 'both',
    subcategories: ['Civil Engineering', 'Structural Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'CAD & Drafting', 'Engineering Consultancy', 'Technical Design', 'Site Inspections'],
  },
  {
    id: 'coaching-mentoring',
    label: 'Coaching & Mentoring',
    icon: '🎯',
    mode: 'online',
    subcategories: ['Life Coaching', 'Career Coaching', 'Executive Coaching', 'Startup Mentoring', 'Leadership', 'Mindset Coaching'],
  },
  {
    id: 'data-analytics',
    label: 'Data & Analytics',
    icon: '📊',
    mode: 'online',
    subcategories: ['Data Analysis', 'Excel / Google Sheets', 'Data Visualisation', 'Business Intelligence', 'Machine Learning', 'Scraping'],
  },
  {
    id: 'design-creative',
    label: 'Design & Creative',
    icon: '🎨',
    mode: 'online',
    subcategories: ['Logo Design', 'Brand Identity', 'UI/UX Design', 'Illustration', 'Packaging', 'Presentation', 'Infographics', 'Motion Graphics'],
  },
  {
    id: 'development-tech',
    label: 'Development & Tech',
    icon: '💻',
    mode: 'online',
    subcategories: ['Web Development', 'Mobile Apps', 'E-commerce', 'WordPress', 'API Integration', 'DevOps & Cloud', 'Cybersecurity', 'Game Dev'],
  },
  {
    id: 'education-tutoring',
    label: 'Education & Tutoring',
    icon: '📚',
    mode: 'online',
    subcategories: ['Language Learning', 'Maths Tutoring', 'Science', 'Test Prep', 'Online Courses', 'Academic Writing'],
  },
  {
    id: 'finance-accounting',
    label: 'Finance & Accounting',
    icon: '💰',
    mode: 'online',
    subcategories: ['Bookkeeping', 'Tax Preparation', 'Financial Planning', 'Payroll', 'Budgeting', 'Investment Advice'],
  },
  {
    id: 'grant-consulting',
    label: 'Grant & Funding Consulting',
    icon: '💶',
    mode: 'online',
    subcategories: [
      'SEAI Home Energy Grants',
      'LEADER & Rural Funding',
      'Government & Enterprise Grants',
      'Business Start-Up Funding',
      'Charity & NGO Grants',
      'EU Funding Applications',
      'R&D Tax Credits',
      'Community Fund Applications',
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    icon: '⚖️',
    mode: 'both',
    subcategories: ['Solicitors', 'Legal Advice', 'Contracts', 'Employment Law', 'Family Law', 'Property Law', 'Notary Services', 'Legal Documents'],
  },
  {
    id: 'marketing-growth',
    label: 'Marketing & Growth',
    icon: '📣',
    mode: 'online',
    subcategories: ['Digital Marketing', 'Email Marketing', 'PPC Advertising', 'Influencer Marketing', 'Affiliate Marketing', 'Brand Strategy'],
  },
  {
    id: 'music-audio',
    label: 'Music & Audio',
    icon: '🎵',
    mode: 'online',
    subcategories: ['Music Production', 'Mixing & Mastering', 'Voiceover', 'Podcast Editing', 'Sound Design', 'Jingle & Drops'],
  },
  {
    id: 'photography-editing',
    label: 'Photography & Editing',
    icon: '📷',
    mode: 'online',
    subcategories: ['Photo Editing', 'Product Photography', 'Photo Retouching', 'Real Estate Photos', 'Background Removal'],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: '🗺️',
    mode: 'both',
    subcategories: ['Planning Applications', 'Urban Planning', 'Event Planning', 'Business Planning', 'Project Planning', 'Construction Planning', 'Planning Consultancy', 'Feasibility Studies'],
  },
  {
    id: 'project-management',
    label: 'Project Management',
    icon: '📋',
    mode: 'both',
    subcategories: ['Agile Project Management', 'Construction Project Management', 'Operations Planning', 'Project Coordination', 'Programme Management', 'PMO Support', 'Risk Management', 'Delivery Management'],
  },
  {
    id: 'sales-online',
    label: 'Online Sales',
    icon: '💼',
    mode: 'online',
    subcategories: ['B2B Sales', 'B2C Sales', 'Cold Outreach & Prospecting', 'Sales Funnel Strategy', 'CRM Setup & Management', 'Lead Generation', 'Sales Copywriting', 'Sales Training & Coaching'],
  },
  {
    id: 'seo-digital',
    label: 'SEO & Digital Marketing',
    icon: '🔍',
    mode: 'online',
    subcategories: ['Technical SEO', 'On-Page SEO', 'Link Building', 'Local SEO', 'Keyword Research', 'SEO Audits'],
  },
  {
    id: 'social-media',
    label: 'Social Media Management',
    icon: '📱',
    mode: 'online',
    subcategories: ['Instagram Management', 'TikTok Strategy', 'LinkedIn Growth', 'Content Calendars', 'Community Management'],
  },
  {
    id: 'translation-interpretation',
    label: 'Translation & Interpretation',
    icon: '🌍',
    mode: 'online',
    subcategories: [
      'Document Translation',
      'Court & Legal Interpreting',
      'Medical Interpreting',
      'Certified Translation',
      'Community Interpreting',
      'Subtitling & Captioning',
      'Localisation',
      'Irish Language (Gaeilge)',
    ],
  },
  {
    id: 'video-animation',
    label: 'Video & Animation',
    icon: '🎬',
    mode: 'online',
    subcategories: ['Video Editing', 'Animation', 'Whiteboard Animation', 'Explainer Videos', 'Short-form Video', 'YouTube Content'],
  },
  {
    id: 'writing-content',
    label: 'Writing & Content',
    icon: '✍️',
    mode: 'online',
    subcategories: ['Copywriting', 'Blog Writing', 'Technical Writing', 'Ghostwriting', 'Translation', 'Proofreading', 'Scriptwriting'],
  },
]

export const OFFLINE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'beauty-personal-care',
    label: 'Beauty & Personal Care',
    icon: '💅',
    mode: 'offline',
    subcategories: ['Hairdressing', 'Mobile Hairdressing', 'Makeup Artist', 'Bridal Makeup', 'Nail Tech', 'Mobile Nail Technician', 'Barbering', 'Eyebrow & Lash', 'Skincare Treatments', 'Mobile Spray Tan'],
  },
  {
    id: 'childcare-education',
    label: 'Childcare & Education',
    icon: '👶',
    mode: 'offline',
    subcategories: ['Babysitting', 'Nannying', 'Tutoring (In-Person)', 'After School Care', 'Holiday Clubs', 'Swimming Lessons'],
  },
  {
    id: 'community-services',
    label: 'Community Services',
    icon: '🌍',
    mode: 'offline',
    subcategories: ['Volunteering', 'Local Projects', 'Charity Work', 'Community Events', 'Skill Sharing', 'Neighbourhood Help'],
  },
  {
    id: 'disability-care',
    label: 'Disability Care & Support',
    icon: '♿',
    mode: 'offline',
    subcategories: [
      'Personal Assistant (PA)',
      'Home Help & Daily Living',
      'Carer Relief & Respite',
      'Hospital Companion',
      'Mobility & Accessibility Support',
      'Community Participation Support',
      'Sensory & Communication Support',
      'Acquired Brain Injury Support',
    ],
  },
  {
    id: 'driving-instructors',
    label: 'Driving Instructors',
    icon: '🚗',
    mode: 'offline',
    subcategories: [
      'Learner Driver Lessons',
      'Pre-Test Training',
      'Motorway Driving',
      'Refresher Lessons',
      'Automatic Transmission',
      'Electric Vehicle Lessons',
      'Truck & HGV Lessons',
      'EDT (Essential Driver Training)',
    ],
  },
  {
    id: 'elder-care',
    label: 'Elder Care',
    icon: '🤝',
    mode: 'offline',
    subcategories: ['Companionship', 'Home Help', 'Medical Support', 'Hospital Visits', 'Shopping Assistance', 'Carer Relief'],
  },
  {
    id: 'energy-services',
    label: 'Energy Services',
    icon: '⚡',
    mode: 'offline',
    subcategories: [
      'Solar Panel Installation',
      'EV Charger Installation',
      'Heat Pump Installation',
      'Home Insulation',
      'Energy Audits',
      'Boiler Servicing',
      'Smart Meter & Thermostat',
      'Battery Storage',
    ],
  },
  {
    id: 'events-entertainment',
    label: 'Events & Entertainment',
    icon: '🎉',
    mode: 'offline',
    subcategories: ['DJ', 'Event Photography', 'Venue Decoration', 'MC / Host', 'Live Music', 'Magician', 'Event Planning'],
  },
  {
    id: 'food-catering',
    label: 'Food & Catering',
    icon: '🍽️',
    mode: 'offline',
    subcategories: ['Private Chef', 'Meal Prep & Delivery', 'Events Catering', 'Baking & Cakes', 'BBQ Catering', 'Dietary Specialist'],
  },
  {
    id: 'health-wellness',
    label: 'Health & Wellness',
    icon: '💪',
    mode: 'offline',
    subcategories: ['Personal Training', 'Physiotherapy', 'Massage Therapy', 'Mobile Massage Therapy', 'Nutrition & Dietetics', 'Mental Health Therapy', 'Yoga', 'Yoga & Pilates (In-Person)'],
  },
  {
    id: 'hospitality',
    label: 'Hospitality',
    icon: '🍽️',
    mode: 'offline',
    subcategories: ['Catering Staff', 'Bar Staff', 'Hotel Services', 'Restaurant Support', 'Event Hospitality', 'Kitchen Porters', 'Front of House', 'Hospitality Consulting'],
  },
  {
    id: 'home-garden',
    label: 'Home & Garden',
    icon: '🏡',
    mode: 'offline',
    subcategories: ['Cleaning', 'Deep Cleaning', 'Landscaping', 'Gardening', 'Home Repairs', 'Furniture Assembly', 'Moving Help'],
  },
  {
    id: 'home-security',
    label: 'Home Security',
    icon: '🔒',
    mode: 'offline',
    subcategories: [
      'CCTV Installation',
      'Alarm Systems',
      'Smart Locks & Access',
      'Door & Window Sensors',
      'Smart Doorbell & Intercom',
      'Security Lighting',
      'Safe Installation',
      'Security Audit',
    ],
  },
  {
    id: 'plumbing',
    label: 'Plumbing',
    icon: '🚰',
    mode: 'offline',
    subcategories: ['Emergency Plumbing', 'Leak Repairs', 'Bathroom Plumbing', 'Kitchen Plumbing', 'Pipework', 'Drain Unblocking', 'Boiler Plumbing', 'Water Tanks'],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    icon: '💡',
    mode: 'offline',
    subcategories: ['Electrical Repairs', 'Rewiring', 'Lighting Installation', 'Sockets & Switches', 'Fuse Boards', 'Safety Certificates', 'Outdoor Power', 'Smart Home Electrics'],
  },
  {
    id: 'heating-hvac',
    label: 'Heating & HVAC',
    icon: '♨️',
    mode: 'offline',
    subcategories: ['Boiler Servicing', 'Boiler Repair', 'Heating Installation', 'Radiators', 'Heat Pumps', 'Air Conditioning', 'Ventilation', 'Thermostats & Controls'],
  },
  {
    id: 'roofing',
    label: 'Roofing',
    icon: '🏠',
    mode: 'offline',
    subcategories: ['Roof Repairs', 'New Roofs', 'Flat Roofing', 'Slate & Tile Roofing', 'Gutters & Fascias', 'Chimney Repairs', 'Roof Inspections', 'Emergency Leaks'],
  },
  {
    id: 'builders-construction',
    label: 'Builders & Construction',
    icon: '🧱',
    mode: 'offline',
    subcategories: ['General Building', 'Extensions', 'Renovations', 'Bricklaying', 'Plastering', 'Structural Repairs', 'Groundworks', 'Project Management'],
  },
  {
    id: 'carpentry-joinery',
    label: 'Carpentry & Joinery',
    icon: '🪚',
    mode: 'offline',
    subcategories: ['Custom Carpentry', 'Doors & Frames', 'Built-in Wardrobes', 'Kitchen Fitting', 'Stairs & Banisters', 'Decking', 'Shelving', 'Repairs'],
  },
  {
    id: 'painting-decorating',
    label: 'Painting & Decorating',
    icon: '🎨',
    mode: 'offline',
    subcategories: ['Interior Painting', 'Exterior Painting', 'Wallpapering', 'Feature Walls', 'Spray Painting', 'Surface Preparation', 'Commercial Decorating', 'Touch-ups'],
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    icon: '🧽',
    mode: 'offline',
    subcategories: ['Home Cleaning', 'Deep Cleaning', 'End of Tenancy', 'Office Cleaning', 'Carpet Cleaning', 'Window Cleaning', 'Oven Cleaning', 'After-builders Cleaning'],
  },
  {
    id: 'landscaping-gardening',
    label: 'Landscaping & Gardening',
    icon: '🌿',
    mode: 'offline',
    subcategories: ['Garden Maintenance', 'Lawn Care', 'Hedge Trimming', 'Landscaping Design', 'Patios & Paving', 'Fencing', 'Tree & Shrub Care', 'Seasonal Clear-outs'],
  },
  {
    id: 'flooring-tiling',
    label: 'Flooring & Tiling',
    icon: '◼️',
    mode: 'offline',
    subcategories: ['Floor Installation', 'Laminate Flooring', 'Hardwood Flooring', 'Vinyl Flooring', 'Wall Tiling', 'Floor Tiling', 'Bathroom Tiling', 'Repairs & Regrouting'],
  },
  {
    id: 'handyman',
    label: 'Handyman',
    icon: '🧰',
    mode: 'offline',
    subcategories: ['Small Repairs', 'Furniture Assembly', 'Odd Jobs', 'Shelving & Fixtures', 'Door Repairs', 'Home Maintenance', 'Appliance Installation', 'General DIY Help'],
  },
  {
    id: 'pest-control',
    label: 'Pest Control',
    icon: '🐜',
    mode: 'offline',
    subcategories: ['Rodent Control', 'Wasp Nest Removal', 'Insect Treatment', 'Bed Bug Treatment', 'Bird Control', 'Pest Proofing', 'Commercial Pest Control', 'Inspection & Prevention'],
  },
  {
    id: 'renewable-energy',
    label: 'Renewable Energy',
    icon: '☀️',
    mode: 'offline',
    subcategories: ['Solar Panels', 'Battery Storage', 'EV Chargers', 'Heat Pumps', 'Home Energy Upgrades', 'Insulation', 'Energy Audits', 'Grant Advice'],
  },
  {
    id: 'moving-services',
    label: 'Moving Services',
    icon: '📦',
    mode: 'offline',
    subcategories: ['House Removals', 'Apartment Moves', 'Man with a Van', 'Packing Help', 'Furniture Moving', 'Office Moves', 'Storage Runs', 'Waste & Clear-outs'],
  },
  {
    id: 'professional-property-services',
    label: 'Professional Property Services',
    icon: '🏘️',
    mode: 'offline',
    subcategories: ['Property Management', 'Letting Support', 'BER Assessments', 'Surveying', 'Snag Lists', 'Valuations', 'Planning Advice', 'Tenant Turnover Services'],
  },
  {
    id: 'real-estate',
    label: 'Real Estate',
    icon: '🏡',
    mode: 'offline',
    subcategories: ['Estate Agents', 'Letting Agents', 'Property Management', 'Valuations', 'Property Photography', 'Buyer Agents', 'Commercial Property', 'Tenant Finding'],
  },
  {
    id: 'music-arts-tuition',
    label: 'Music & Arts Tuition',
    icon: '🎵',
    mode: 'offline',
    subcategories: [
      'Guitar Lessons',
      'Piano & Keyboard',
      'Singing & Vocal Coaching',
      'Traditional Irish Music',
      'Tin Whistle & Bodhrán',
      'Uilleann Pipes & Fiddle',
      'Drama & Theatre',
      'Art & Drawing Classes',
    ],
  },
  {
    id: 'pet-services',
    label: 'Pet Services',
    icon: '🐾',
    mode: 'offline',
    subcategories: ['Dog Walking', 'Pet Grooming', 'Pet Sitting', 'Dog Training', 'Vet Visits Companion', 'Pet Photography'],
  },
  {
    id: 'sports-fitness-coaching',
    label: 'Sports & Fitness Coaching',
    icon: '⚽',
    mode: 'offline',
    subcategories: [
      'Sports Coaching',
      'Personal Training (Outdoor)',
      'Swimming Coaching',
      'Youth Sport & Development',
      'Football Coaching',
      'Athletics Coaching',
      'Martial Arts Instruction',
      'Yoga & Pilates (In-Person)',
    ],
  },
  {
    id: 'sales-local',
    label: 'Field Sales',
    icon: '💼',
    mode: 'offline',
    subcategories: ['Door-to-Door Sales', 'Field Sales', 'In-Store Sales', 'Event & Exhibition Sales', 'Retail Sales', 'Promotional Sales', 'Territory Sales Rep', 'Product Demonstrations'],
  },
  {
    id: 'taxi-drivers',
    label: 'Taxi Drivers',
    icon: '🚕',
    mode: 'offline',
    subcategories: [
      'Airport Transfers',
      'Local Rides',
      'Long Distance',
      'School Runs',
      'Wheelchair Accessible',
      'Wedding & Events',
      'Executive / Chauffeur',
      'Night Out & Pub Runs',
    ],
  },
  {
    id: 'trades-construction',
    label: 'Trades & Construction',
    icon: '🔧',
    mode: 'offline',
    subcategories: ['Plumbing', 'Electrician', 'Carpentry', 'Painting & Decorating', 'Plastering', 'Tiling', 'Roofing', 'Bricklaying'],
  },
  {
    id: 'transport-delivery',
    label: 'Transport & Delivery',
    icon: '🚚',
    mode: 'offline',
    subcategories: ['Courier Service', 'Removal & Moving', 'Errands & Shopping', 'Pet Transport', 'Airport Transfers', 'Van Hire'],
  },
  {
    id: 'vehicle-services',
    label: 'Vehicle Services',
    icon: '🔧',
    mode: 'offline',
    subcategories: [
      'Mobile Mechanic',
      'NCT Preparation',
      'Car Valeting & Detailing',
      'Tyre Fitting & Repair',
      'Windscreen Repair',
      'Car Battery & Electrics',
      'Pre-Purchase Inspection',
      'Fuel System & Exhausts',
    ],
  },
]

export const ALL_CATEGORIES: ServiceCategory[] = [...ONLINE_CATEGORIES, ...OFFLINE_CATEGORIES]

function normaliseCategoryLabel(value: string) {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ')
}

const LEGACY_CATEGORY_LABEL_ALIASES: Record<string, string> = {
  sales: 'online sales',
  'legal and compliance': 'legal',
}

export function findServiceCategoryByLabel(label: string | null | undefined): ServiceCategory | null {
  if (!label) return null
  const normalised = normaliseCategoryLabel(label)
  const canonical = LEGACY_CATEGORY_LABEL_ALIASES[normalised] ?? normalised
  return ALL_CATEGORIES.find(cat => normaliseCategoryLabel(cat.label) === canonical) ?? null
}

// Delivery options for products
export interface DeliveryOption {
  id: string
  label: string
  icon: string
  isDigital: boolean
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'digital',    label: 'Digital Delivery',        icon: '📧', isDigital: true  },
  { id: 'download',   label: 'Instant Download',        icon: '⬇️', isDigital: true  },
  { id: 'courier',    label: 'Courier',                 icon: '🚚', isDigital: false },
  { id: 'collection', label: 'Collection',              icon: '🏪', isDigital: false },
  { id: 'post',       label: 'Post / Royal Mail',       icon: '📬', isDigital: false },
  { id: 'sameday',    label: 'Same Day',                icon: '⚡', isDigital: false },
  { id: 'local',      label: 'Local Delivery',          icon: '🏠', isDigital: false },
  { id: 'international', label: 'International Shipping', icon: '✈️', isDigital: false },
]

// Location radius options
export const LOCATION_RADII = [
  { value: 5,   label: 'Within 5km'   },
  { value: 10,  label: 'Within 10km'  },
  { value: 25,  label: 'Within 25km'  },
  { value: 50,  label: 'Within 50km'  },
  { value: 100, label: 'Within 100km' },
]

export const LOCATION_SCOPE = [
  { value: 'local',         label: 'Local',         icon: '📍' },
  { value: 'national',      label: 'National',      icon: '🇬🇧' },
  { value: 'international', label: 'International', icon: '🌍' },
  { value: 'remote',        label: 'Remote / Online', icon: '💻' },
]
