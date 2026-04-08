import { Organisation } from "@/types/organisation";

const MOCK_ORGANISATIONS: Organisation[] = [
  {
    id: "1",
    name: "GreenFuture Initiative",
    slug: "greenfuture-initiative",
    logo: "https://api.dicebear.com/7.x/initials/svg?seed=GreenFuture&backgroundColor=16a34a",
    coverPhoto: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1200&q=80",
    description:
      "GreenFuture Initiative is a leading social enterprise dedicated to creating sustainable solutions for communities across the UK. We work at the intersection of environmental sustainability, social impact, and economic opportunity — delivering programmes that empower individuals while protecting the planet.",
    mission:
      "Our mission is to accelerate the transition to a sustainable, equitable economy by connecting people, businesses, and communities with the tools, knowledge, and resources they need to thrive in a net-zero world.",
    type: "Social Enterprise",
    contact: {
      email: "hello@greenfuture.org",
      phone: "+44 20 7946 0123",
      address: "12 Sustainability Street",
      city: "London",
      country: "United Kingdom",
      postcode: "EC1A 1BB",
      socialLinks: {
        website: "https://greenfuture.org",
        twitter: "https://twitter.com/greenfuture",
        linkedin: "https://linkedin.com/company/greenfuture",
        facebook: "https://facebook.com/greenfuture",
      },
    },
    services: [
      {
        id: "s1",
        name: "Sustainability Auditing",
        description:
          "Comprehensive audits of your organisation's environmental impact with actionable improvement plans.",
        category: "Consulting",
        price: "From £1,200",
      },
      {
        id: "s2",
        name: "Net Zero Strategy",
        description:
          "End-to-end strategy development to help your business achieve net zero carbon emissions.",
        category: "Strategy",
        price: "From £3,500",
      },
      {
        id: "s3",
        name: "Community Green Grants",
        description:
          "Funding and support for community-led environmental projects across the UK.",
        category: "Funding",
        price: "Free",
      },
      {
        id: "s4",
        name: "Green Skills Training",
        description:
          "Workshops and certifications for individuals seeking careers in the green economy.",
        category: "Training",
        price: "From £150",
      },
    ],
    teamMembers: [
      {
        id: "t1",
        name: "Sarah Okonkwo",
        role: "Chief Executive Officer",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        linkedinUrl: "https://linkedin.com/in/sarahokonkwo",
      },
      {
        id: "t2",
        name: "James Whitfield",
        role: "Head of Sustainability",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
        linkedinUrl: "https://linkedin.com/in/jameswhitfield",
      },
      {
        id: "t3",
        name: "Priya Sharma",
        role: "Community Programmes Lead",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
        linkedinUrl: "https://linkedin.com/in/priyasharma",
      },
      {
        id: "t4",
        name: "Tom Adeyemi",
        role: "Head of Partnerships",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tom",
      },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "Claire Hutchinson",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Claire",
        authorOrg: "Eco Ventures Ltd",
        rating: 5,
        title: "Transformed our sustainability strategy",
        body: "GreenFuture delivered an outstanding sustainability audit for our business. Their team was thorough, professional, and genuinely passionate. The roadmap they produced has already saved us 18% on energy costs.",
        createdAt: "2024-03-15T10:30:00Z",
        verified: true,
      },
      {
        id: "r2",
        authorName: "Marcus Bell",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
        authorOrg: "Northside Community Trust",
        rating: 5,
        title: "Incredible community grant support",
        body: "The grant programme was a lifeline for our local environmental project. The application process was straightforward and the team were supportive throughout. Highly recommend.",
        createdAt: "2024-02-28T14:00:00Z",
        verified: true,
      },
      {
        id: "r3",
        authorName: "Fatima Al-Rashid",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima",
        rating: 4,
        title: "Great training programme",
        body: "The Green Skills workshop was well-structured and informative. Would have given 5 stars but the online materials could be improved. Overall a really valuable experience.",
        createdAt: "2024-01-10T09:15:00Z",
        verified: true,
      },
    ],
    trustScore: 9.4,
    totalReviews: 127,
    followersCount: 3842,
    isVerified: true,
    foundedYear: 2018,
    employeeCount: "11–50",
    tags: ["Sustainability", "Net Zero", "Community", "Green Economy", "Social Impact"],
  },
];

export async function getOrganisationById(id: string): Promise<Organisation | null> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return MOCK_ORGANISATIONS.find((org) => org.id === id) ?? null;
}

export async function getAllOrganisations(): Promise<Organisation[]> {
  return MOCK_ORGANISATIONS;
}
