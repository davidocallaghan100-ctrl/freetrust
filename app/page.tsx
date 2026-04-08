
import Link from "next/link";

export default function Home() {
  return (
    <main className="home-main">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to <span className="brand">FreeTrust</span>
          </h1>
          <p className="hero-subtitle">
            A transparent, open-source platform built on trust, security, and
            community.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary">
              Get Started
            </Link>
            <Link href="/about" className="btn btn-outline">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Why FreeTrust?</h2>
          <p className="section-subtitle">
            Everything you need to build and maintain trust in your digital
            world.
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div className="feature-card" key={index}>
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div className="stat-card" key={index}>
              <span className="stat-number">{stat.number}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to get started?</h2>
          <p className="cta-subtitle">
            Join thousands of users who already trust FreeTrust.
          </p>
          <Link href="/register" className="btn btn-primary btn-large">
            Create Free Account
          </Link>
        </div>
      </section>
    </main>
  );
}

const features = [
  {
    icon: "🔒",
    title: "Secure by Design",
    description:
      "End-to-end encryption and zero-knowledge architecture ensure your data stays private at all times.",
  },
  {
    icon: "🌐",
    title: "Open Source",
    description:
      "Fully transparent codebase audited by the community. No hidden backdoors, ever.",
  },
  {
    icon: "⚡",
    title: "Lightning Fast",
    description:
      "Optimised infrastructure delivers sub-100ms response times globally.",
  },
  {
    icon: "🤝",
    title: "Community Driven",
    description:
      "Governed by its users. Every major decision is voted on by the community.",
  },
  {
    icon: "🛡️",
    title: "Privacy First",
    description:
      "We collect only what is necessary. Your data is never sold or shared with third parties.",
  },
  {
    icon: "🔧",
    title: "Developer Friendly",
    description:
      "Rich APIs, SDKs, and documentation to integrate FreeTrust into any stack.",
  },
];

const stats = [
  { number: "50K+", label: "Active Users" },
  { number: "99.9%", label: "Uptime" },
  { number: "128-bit", label: "Encryption" },
  { number: "0", label: "Data Breaches" },
];

{"file": "app/page.module.css", "action": "write"}

/* ───────────────────────────────────────────
   Base / Reset
─────────────────────────────────────────── */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ───────────────────────────────────────────
   Main wrapper
─────────────────────────────────────────── */
.home-main {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  color: #1a1a2e;
  background: #f8f9fc;
}

/* ───────────────────────────────────────────
   Hero Section
─────────────────────────────────────────── */
.hero {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: clamp(2rem, 6vw, 6rem) clamp(1rem, 4vw, 2rem);
}

.hero-content {
  width: 100%;
  max-width: 720px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.hero-title {
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-weight: 800;
  line-height: 1.15;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.brand {
  background: linear-gradient(90deg, #e94560, #0f3460);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: #a8b2d8;
  max-width: 560px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 0.5rem;
}

/* ───────────────────────────────────────────
   Buttons
─────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #e94560;
  color: #ffffff;
  border: 2px solid #e94560;
}

.btn-primary:hover {
  background: #c73652;
  border-color: #c73652;
}

.btn-outline {
  background: transparent;
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #ffffff;
}

.btn-large {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
}

/* ───────────────────────────────────────────
   Features Section
─────────────────────────────────────────── */
.features-section {
  width: 100%;
  padding: clamp(3rem, 8vw, 6rem) clamp(1rem, 5vw, 2rem);
  background: #ffffff;
}

.section-header {
  text-align: center;
  margin-bottom: clamp(2rem, 5vw, 3.5rem);
}

.section-title {
  font-size: clamp(1.6rem, 3.5vw, 2.5rem);
  font-weight: 800;
  color: #1a1a2e;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}

.section-subtitle {
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  color: #6b7280;
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.7;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.feature-card {
  background: #f8f9fc;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: clamp(1.25rem, 3vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  border-color: #e94560;
}

.feature-icon {
  font-size: 2rem;
  line-height: 1;
}

.feature-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a1a2e;
}

.feature-desc {
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.65;
}

/* ───────────────────────────────────────────
   Stats Section
─────────────────────────────────────────── */
.stats-section {
  width: 100%;
  background: linear-gradient(135deg, #1a1a2e, #0f3460);
  padding: clamp(3rem, 7vw, 5rem) clamp(1rem, 5vw, 2rem);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 1.5rem;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: clamp(1.5rem, 3vw, 2rem) 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s ease;
}

.stat-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.stat-number {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 800;
  color: #e94560;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 0.95rem;
  color: #a8b2d8;
  font-weight: 500;
}

/* ───────────────────────────────────────────
   CTA Section
─────────────────────────────────────────── */
.cta-section {
  width: 100%;
  background: #f8f9fc;
  padding: clamp(3rem, 8vw, 6rem) clamp(1rem, 5vw, 2rem);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cta-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  max-width: 580px;
}

.cta-title {
  font-size: clamp(1.6rem, 3.5vw, 2.5rem);
  font-weight: 800;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.cta-subtitle {
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  color: #6b7280;
  line-height: 1.7;
}

/* ───────────────────────────────────────────
   Responsive overrides
─────────────────────────────────────────── */
@media (max-width: 480px) {
  .hero-actions {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 640px) and (max-width: 900px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 901px) {
  .features-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}