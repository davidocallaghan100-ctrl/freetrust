
import Link from "next/link";

const categories = [
  { emoji: "⚖️", name: "Legal Aid", slug: "legal-aid", description: "Find legal resources and representation" },
  { emoji: "🏠", name: "Housing", slug: "housing", description: "Rental assistance, eviction help & shelter" },
  { emoji: "🍎", name: "Food Assistance", slug: "food-assistance", description: "Food banks, SNAP & nutrition programs" },
  { emoji: "🏥", name: "Healthcare", slug: "healthcare", description: "Medical, dental & mental health services" },
  { emoji: "💼", name: "Employment", slug: "employment", description: "Job training, placement & workers' rights" },
  { emoji: "🎓", name: "Education", slug: "education", description: "Scholarships, GED, ESL & tutoring" },
  { emoji: "👶", name: "Family Services", slug: "family-services", description: "Childcare, parenting support & youth programs" },
  { emoji: "🛂", name: "Immigration", slug: "immigration", description: "Visa help, asylum & citizenship resources" },
  { emoji: "💰", name: "Financial Help", slug: "financial-help", description: "Benefits, debt relief & emergency funds" },
  { emoji: "🧠", name: "Mental Health", slug: "mental-health", description: "Counseling, crisis lines & support groups" },
  { emoji: "♿", name: "Disability Services", slug: "disability-services", description: "Accessibility, SSI & accommodations" },
  { emoji: "🌐", name: "Community Resources", slug: "community-resources", description: "Local nonprofits & neighborhood support" },
];

export default function DashboardPage() {
  return (
    <main className="dashboard-root">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="dashboard-logo">
            <span className="dashboard-logo-icon">🔓</span>
            <span className="dashboard-logo-text">FreeTrust</span>
          </div>
          <nav className="dashboard-nav">
            <Link href="/profile" className="dashboard-nav-link">My Profile</Link>
            <Link href="/logout" className="dashboard-nav-link dashboard-nav-link--logout">Sign Out</Link>
          </nav>
        </div>
      </header>

      <section className="dashboard-hero">
        <h1 className="dashboard-hero-title">What do you need help with?</h1>
        <p className="dashboard-hero-subtitle">
          Choose a category below and we'll connect you with the right resources.
        </p>
      </section>

      <section className="dashboard-grid-section">
        <div className="dashboard-grid">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/dashboard/${cat.slug}`}
              className="category-card"
            >
              <span className="category-card-emoji" role="img" aria-label={cat.name}>
                {cat.emoji}
              </span>
              <span className="category-card-name">{cat.name}</span>
              <span className="category-card-desc">{cat.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="dashboard-footer">
        <p>© {new Date().getFullYear()} FreeTrust · Built to empower communities</p>
      </footer>
    </main>
  );
}