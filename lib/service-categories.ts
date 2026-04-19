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
    id: 'marketing-growth',
    label: 'Marketing & Growth',
    icon: '📣',
    mode: 'online',
    subcategories: ['Digital Marketing', 'Email Marketing', 'PPC Advertising', 'Influencer Marketing', 'Affiliate Marketing', 'Brand Strategy'],
  },
  {
    id: 'writing-content',
    label: 'Writing & Content',
    icon: '✍️',
    mode: 'online',
    subcategories: ['Copywriting', 'Blog Writing', 'Technical Writing', 'Ghostwriting', 'Translation', 'Proofreading', 'Scriptwriting'],
  },
  {
    id: 'video-animation',
    label: 'Video & Animation',
    icon: '🎬',
    mode: 'online',
    subcategories: ['Video Editing', 'Animation', 'Whiteboard Animation', 'Explainer Videos', 'Short-form Video', 'YouTube Content'],
  },
  {
    id: 'music-audio',
    label: 'Music & Audio',
    icon: '🎵',
    mode: 'online',
    subcategories: ['Music Production', 'Mixing & Mastering', 'Voiceover', 'Podcast Editing', 'Sound Design', 'Jingle & Drops'],
  },
  {
    id: 'business-consulting',
    label: 'Business & Consulting',
    icon: '🧠',
    mode: 'online',
    subcategories: ['Business Strategy', 'Market Research', 'Business Plans', 'Project Management', 'Operations', 'HR Consulting'],
  },
  {
    id: 'finance-accounting',
    label: 'Finance & Accounting',
    icon: '💰',
    mode: 'online',
    subcategories: ['Bookkeeping', 'Tax Preparation', 'Financial Planning', 'Payroll', 'Budgeting', 'Investment Advice'],
  },
  {
    id: 'legal-compliance',
    label: 'Legal & Compliance',
    icon: '⚖️',
    mode: 'online',
    subcategories: ['Contract Review', 'GDPR Compliance', 'Trademark & IP', 'Terms & Privacy Policies', 'Legal Advice', 'Company Formation'],
  },
  {
    id: 'coaching-mentoring',
    label: 'Coaching & Mentoring',
    icon: '🎯',
    mode: 'online',
    subcategories: ['Life Coaching', 'Career Coaching', 'Executive Coaching', 'Startup Mentoring', 'Leadership', 'Mindset Coaching'],
  },
  {
    id: 'education-tutoring',
    label: 'Education & Tutoring',
    icon: '📚',
    mode: 'online',
    subcategories: ['Language Learning', 'Maths Tutoring', 'Science', 'Test Prep', 'Online Courses', 'Academic Writing'],
  },
  {
    id: 'ai-automation',
    label: 'Agents',
    icon: '😎',
    mode: 'online',
    subcategories: ['ChatGPT / LLM Integration', 'Workflow Automation', 'AI Chatbots', 'Prompt Engineering', 'Make / Zapier', 'AI Content Creation'],
  },
  {
    id: 'data-analytics',
    label: 'Data & Analytics',
    icon: '📊',
    mode: 'online',
    subcategories: ['Data Analysis', 'Excel / Google Sheets', 'Data Visualisation', 'Business Intelligence', 'Machine Learning', 'Scraping'],
  },
  {
    id: 'photography-editing',
    label: 'Photography & Editing',
    icon: '📷',
    mode: 'online',
    subcategories: ['Photo Editing', 'Product Photography', 'Photo Retouching', 'Real Estate Photos', 'Background Removal'],
  },
  {
    id: 'social-media',
    label: 'Social Media Management',
    icon: '📱',
    mode: 'online',
    subcategories: ['Instagram Management', 'TikTok Strategy', 'LinkedIn Growth', 'Content Calendars', 'Community Management'],
  },
  {
    id: 'seo-digital',
    label: 'SEO & Digital Marketing',
    icon: '🔍',
    mode: 'online',
    subcategories: ['Technical SEO', 'On-Page SEO', 'Link Building', 'Local SEO', 'Keyword Research', 'SEO Audits'],
  },
  // Translation & Interpretation — document translation, court/medical
  // interpreting. Irish immigrant communities (Polish, Ukrainian,
  // Brazilian) face documented language barriers. Cross-linked to
  // grassroots language_support.
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
  // Grant & Funding Consulting — SEAI, LEADER, business funding.
  // Irish-specific niche with growing demand as SEAI grants expand.
  // No current Services category covers this.
  {
    id: 'grant-consulting',
    label: 'Grant & Funding Consulting',
    icon: '💶',
    mode: 'online',
    subcategories: [
      'SEAI Home Energy Grants',
      'LEADER & Rural Funding',
      'Enterprise Ireland Grants',
      'Business Start-Up Funding',
      'Charity & NGO Grants',
      'EU Funding Applications',
      'R&D Tax Credits',
      'Community Fund Applications',
    ],
  },
]

export const OFFLINE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'trades-construction',
    label: 'Trades & Construction',
    icon: '🔧',
    mode: 'offline',
    subcategories: ['Plumbing', 'Electrician', 'Carpentry', 'Painting & Decorating', 'Plastering', 'Tiling', 'Roofing', 'Bricklaying'],
  },
  {
    id: 'home-garden',
    label: 'Home & Garden',
    icon: '🏡',
    mode: 'offline',
    subcategories: ['Cleaning', 'Deep Cleaning', 'Landscaping', 'Gardening', 'Home Repairs', 'Furniture Assembly', 'Moving Help'],
  },
  {
    id: 'health-wellness',
    label: 'Health & Wellness',
    icon: '💪',
    mode: 'offline',
    subcategories: ['Personal Training', 'Physiotherapy', 'Massage Therapy', 'Nutrition & Dietetics', 'Mental Health Therapy', 'Yoga'],
  },
  {
    id: 'beauty-personal-care',
    label: 'Beauty & Personal Care',
    icon: '💅',
    mode: 'offline',
    subcategories: ['Hairdressing', 'Makeup Artist', 'Nail Tech', 'Barbering', 'Eyebrow & Lash', 'Skincare Treatments'],
  },
  {
    id: 'food-catering',
    label: 'Food & Catering',
    icon: '🍽️',
    mode: 'offline',
    subcategories: ['Private Chef', 'Meal Prep & Delivery', 'Events Catering', 'Baking & Cakes', 'BBQ Catering', 'Dietary Specialist'],
  },
  {
    id: 'events-entertainment',
    label: 'Events & Entertainment',
    icon: '🎉',
    mode: 'offline',
    subcategories: ['DJ', 'Event Photography', 'Venue Decoration', 'MC / Host', 'Live Music', 'Magician', 'Event Planning'],
  },
  {
    id: 'transport-delivery',
    label: 'Transport & Delivery',
    icon: '🚚',
    mode: 'offline',
    subcategories: ['Courier Service', 'Removal & Moving', 'Errands & Shopping', 'Pet Transport', 'Airport Transfers', 'Van Hire'],
  },
  {
    id: 'childcare-education',
    label: 'Childcare & Education',
    icon: '👶',
    mode: 'offline',
    subcategories: ['Babysitting', 'Nannying', 'Tutoring (In-Person)', 'After School Care', 'Holiday Clubs', 'Swimming Lessons'],
  },
  {
    id: 'pet-services',
    label: 'Pet Services',
    icon: '🐾',
    mode: 'offline',
    subcategories: ['Dog Walking', 'Pet Grooming', 'Pet Sitting', 'Dog Training', 'Vet Visits Companion', 'Pet Photography'],
  },
  {
    id: 'elder-care',
    label: 'Elder Care',
    icon: '🤝',
    mode: 'offline',
    subcategories: ['Companionship', 'Home Help', 'Medical Support', 'Hospital Visits', 'Shopping Assistance', 'Carer Relief'],
  },
  {
    id: 'community-services',
    label: 'Community Services',
    icon: '🌍',
    mode: 'offline',
    subcategories: ['Volunteering', 'Local Projects', 'Charity Work', 'Community Events', 'Skill Sharing', 'Neighbourhood Help'],
  },
  // Taxi Drivers — own top-level category rather than a subcategory of
  // "Transport & Delivery" because the user set is large and well-
  // defined (airport runs, school runs, wheelchair accessible, etc.)
  // and users shopping for a ride don't want to wade through courier /
  // removal / van-hire results first. Crosslinked to grassroots
  // 'delivery' for the casual / informal end of the same work via
  // lib/marketplace/category-overlap.ts.
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
  // Driving Instructors — own top-level category, parallel logic to
  // Taxi Drivers. The audience looking for a driving lesson is very
  // different from someone booking a taxi or a courier. Subcategories
  // map to the typical Irish ADI / RSA instructor offering: learner
  // permits, pre-test, motorway, refresher, and specialist lessons
  // (automatic, electric cars, trucks). Cross-linked to grassroots
  // 'driving_instruction' via lib/marketplace/category-overlap.ts.
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
  // Energy Services — home + business energy-efficiency work.
  // Subcategories reflect the Irish/UK green-grants landscape (SEAI,
  // BUS): solar, EV chargers, heat pumps, insulation, audits. The
  // category is marked 'offline' because every listed job is on-site
  // at the customer's property — even an energy audit is a physical
  // visit. If we later add remote consultancy (e.g. grant-application
  // help) it fits under business-consulting, not here.
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
  // Vehicle Services — mobile mechanics, valeting, NCT prep. Separate
  // from trades-construction because the audience and skill set are
  // automotive-specific. Cross-linked to grassroots car_valeting and
  // mechanic_services.
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
  // Home Security — CCTV, alarms, smart locks. High trust category
  // (documented scams in Ireland). Cross-linked to grassroots
  // security_installation.
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
  // Sports & Fitness Coaching — personal trainers, GAA coaches,
  // swimming instructors. Garda vetting badge angle for youth work.
  // Cross-linked to grassroots sports_coaching.
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
  // Music & Arts Tuition — instruments, voice, trad Irish, art.
  // Irish trad (fiddle, uilleann pipes, bodhrán) is a unique niche.
  // Cross-linked to grassroots music_lessons.
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
  // Disability Care & Support — PA services, home help, carer relief.
  // 23.76M home support hours in Ireland (2024), growing 12.5% YoY.
  // New statutory registration legislation backs trust verification.
  // Cross-linked to grassroots disability_support.
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
  // Mobile Beauty & Wellness — hairdressing, nails, massage at home.
  // Rural Ireland staple — informal, no reviews, no trust. Cross-linked
  // to grassroots beauty_mobile.
  {
    id: 'beauty-wellness-mobile',
    label: 'Mobile Beauty & Wellness',
    icon: '💅',
    mode: 'offline',
    subcategories: [
      'Mobile Hairdressing',
      'Home Nail Technician',
      'Makeup Artist (Occasions)',
      'Mobile Massage Therapy',
      'Eyebrow & Lash Technician',
      'Mobile Spray Tan',
      'Skincare at Home',
      'Bridal Beauty',
    ],
  },
]

export const ALL_CATEGORIES: ServiceCategory[] = [...ONLINE_CATEGORIES, ...OFFLINE_CATEGORIES]

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
