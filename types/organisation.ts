export type OrganisationType = "Business" | "Charity" | "Social Enterprise";

export interface SocialLinks {
  website?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
}

export interface ContactDetails {
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postcode?: string;
  socialLinks?: SocialLinks;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  linkedinUrl?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price?: string;
}

export interface Review {
  id: string;
  authorName: string;
  authorAvatar?: string;
  authorOrg?: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  verified: boolean;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  coverPhoto?: string;
  description: string;
  mission: string;
  type: OrganisationType;
  contact: ContactDetails;
  services: Service[];
  teamMembers: TeamMember[];
  reviews: Review[];
  trustScore: number;
  totalReviews: number;
  followersCount: number;
  isVerified: boolean;
  foundedYear?: number;
  employeeCount?: string;
  tags: string[];
}
