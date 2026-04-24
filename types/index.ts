export type UserRole = 'buyer' | 'seller' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  bio: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export type ListingStatus = 'draft' | 'active' | 'sold' | 'archived'

export type DeliveryScope = 'local' | 'national' | 'international' | 'worldwide'

export type DeliveryZone = {
  scope: DeliveryScope
  originLat?: number | null
  originLng?: number | null
  radiusKm?: number | null
  countries?: string[] | null
  notes?: string | null
}

export interface Listing {
  id: string
  seller_id: string
  category_id: string
  title: string
  description: string
  price: number
  currency: string
  status: ListingStatus
  images: string[]
  tags: string[]
  views: number
  created_at: string
  updated_at: string
  seller?: Profile
  category?: Category
  // Delivery zone fields (physical products only)
  delivery_scope?: DeliveryScope | null
  delivery_origin_lat?: number | null
  delivery_origin_lng?: number | null
  delivery_radius_km?: number | null
  delivery_countries?: string[] | null
  delivery_notes?: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
}

export type MessageStatus = 'sent' | 'delivered' | 'read'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  status: MessageStatus
  created_at: string
}

export interface Conversation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
  listing?: Listing
  messages?: Message[]
}

export type ReviewTargetType = 'seller' | 'buyer'

export interface Review {
  id: string
  reviewer_id: string
  reviewee_id: string
  listing_id: string
  target_type: ReviewTargetType
  rating: number
  comment: string | null
  created_at: string
  reviewer?: Profile
}
