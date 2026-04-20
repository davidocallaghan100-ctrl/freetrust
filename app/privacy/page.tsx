import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | FreeTrust',
  description: 'Privacy Policy for FreeTrust, operated by Airpal Technology Ltd.',
}

const sections = [
  {
    id: 'who-we-are',
    title: '1. Who We Are',
    content: (
      <>
        <p>
          FreeTrust (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a trust-based platform for
          freelancers, gig workers, and community members to connect, sell services and products, attend
          events, and manage their work. FreeTrust is operated by{' '}
          <strong className="text-white">Airpal Technology Ltd</strong>, a company registered in the Republic
          of Ireland.
        </p>
        <p className="mt-3">
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:davidocallaghan100@gmail.com" className="text-[#38bdf8] hover:underline">
            davidocallaghan100@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: '2. Data We Collect',
    content: (
      <>
        <p>We collect the following categories of personal data:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            ['Account & Profile Information', 'Your name, email address, profile photo, bio, location, and any other information you provide when creating or updating your FreeTrust profile.'],
            ['Gig & Listing Data', 'Details of services, products, or gigs you list on the platform, including descriptions, pricing, and availability.'],
            ['Order & Transaction Data', 'Records of purchases, bookings, and transactions made on or through FreeTrust.'],
            ['Event Data', 'Events you create, attend, or express interest in on the platform.'],
            ['Calendar Data', 'If you connect your Google Calendar, we access your calendar to sync your FreeTrust gigs, events, and reminders. See Section 4 for full details.'],
            ['Usage Data', 'Information about how you use FreeTrust, including pages visited, features used, and interactions with other users.'],
            ['Device & Technical Data', 'IP address, browser type, operating system, and device identifiers collected automatically when you access our platform.'],
          ].map(([label, desc]) => (
            <li key={label} className="pl-4 border-l-2 border-[#6c63ff]">
              <span className="text-white font-medium">{label}:</span>{' '}
              <span className="text-[#94a3b8]">{desc}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Your Data',
    content: (
      <>
        <p>We use your personal data to:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Provide, operate, and improve the FreeTrust platform</li>
          <li>Process transactions and fulfil orders</li>
          <li>Display your profile and listings to other members</li>
          <li>Send you notifications about your account, orders, and events</li>
          <li>Sync your FreeTrust activities with your connected Google Calendar (if enabled)</li>
          <li>Ensure platform safety and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p className="mt-3">
          Our legal basis for processing your data is primarily the performance of our contract with you
          (providing the FreeTrust service), your consent (for optional features such as Google Calendar
          sync), and our legitimate interests in operating and improving our platform.
        </p>
      </>
    ),
  },
  {
    id: 'google-calendar',
    title: '4. Google Calendar Integration',
    content: (
      <>
        <p>
          FreeTrust offers an optional Google Calendar integration. If you choose to connect your Google
          Calendar account, the following applies:
        </p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>
            We access your Google Calendar <strong className="text-white">solely</strong> to sync your
            FreeTrust gigs, events, and reminders. This allows you to see your FreeTrust activities
            alongside your personal schedule.
          </li>
          <li>
            We <strong className="text-white">do not share</strong> your Google Calendar data with any
            third parties.
          </li>
          <li>
            We <strong className="text-white">do not sell</strong> your Google Calendar data or use it
            for advertising purposes.
          </li>
          <li>
            Calendar data is processed in accordance with{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#38bdf8] hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </li>
          <li>
            You can disconnect your Google Calendar at any time from{' '}
            <strong className="text-white">Settings → Calendar</strong>. Upon disconnection, we will
            delete your stored Google Calendar tokens immediately.
          </li>
        </ul>
        <p className="mt-3 p-3 rounded-xl bg-[#6c63ff]/10 border border-[#6c63ff]/30 text-[#94a3b8]">
          <strong className="text-white">In summary:</strong> We access your Google Calendar solely to
          sync your FreeTrust gigs, events, and reminders. We do not share your calendar data with third
          parties. You can disconnect at any time from Settings → Calendar.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '5. Cookies & Analytics',
    content: (
      <>
        <p>We use cookies and similar technologies to:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Keep you logged in to your FreeTrust account (essential cookies)</li>
          <li>Remember your preferences and settings</li>
          <li>Understand how users interact with our platform (analytics)</li>
        </ul>
        <p className="mt-3">
          Essential cookies are required for the platform to function and cannot be disabled. You may
          control non-essential cookies through your browser settings.
        </p>
      </>
    ),
  },
  {
    id: 'data-sharing',
    title: '6. Data Sharing',
    content: (
      <>
        <p>We do not sell your personal data. We may share your data with:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>
            <strong className="text-white">Service providers</strong> who help us operate the platform
            (e.g. hosting, payment processing, email delivery) — under strict data processing agreements.
          </li>
          <li>
            <strong className="text-white">Other FreeTrust members</strong> — profile information and
            listings you make public are visible to other users on the platform.
          </li>
          <li>
            <strong className="text-white">Law enforcement or regulators</strong> — where required by
            applicable law or to protect the rights and safety of our users.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-retention',
    title: '7. Data Retention',
    content: (
      <p>
        We retain your personal data for as long as your account is active or as needed to provide our
        services. If you delete your account, we will delete or anonymise your personal data within 30
        days, except where we are required to retain it for legal or regulatory reasons (e.g. financial
        records may be retained for up to 7 years in accordance with Irish law).
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: '8. Your Rights',
    content: (
      <>
        <p>Under applicable data protection law (including GDPR), you have the right to:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
          <li><strong className="text-white">Rectification</strong> — request correction of inaccurate data</li>
          <li><strong className="text-white">Erasure</strong> — request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
          <li><strong className="text-white">Portability</strong> — receive your data in a structured, machine-readable format</li>
          <li><strong className="text-white">Objection</strong> — object to certain types of processing</li>
          <li><strong className="text-white">Restriction</strong> — request that we restrict processing of your data</li>
          <li><strong className="text-white">Withdraw consent</strong> — at any time, for processing based on consent (e.g. Google Calendar sync)</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, please contact us at{' '}
          <a href="mailto:davidocallaghan100@gmail.com" className="text-[#38bdf8] hover:underline">
            davidocallaghan100@gmail.com
          </a>
          . We will respond within 30 days.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: '9. Security',
    content: (
      <p>
        We implement appropriate technical and organisational measures to protect your personal data
        against unauthorised access, alteration, disclosure, or destruction. All data is transmitted
        over HTTPS and stored on secure, access-controlled servers. However, no method of transmission
        over the internet is 100% secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '10. Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time. When we make significant changes, we will
        notify you by email or by displaying a notice on the platform. The &ldquo;Last updated&rdquo; date at the
        top of this page reflects the most recent revision. Continued use of FreeTrust after changes
        are posted constitutes your acceptance of the updated policy.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '11. Contact Us',
    content: (
      <>
        <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact:</p>
        <div className="mt-3 p-4 rounded-xl bg-[#13131a] border border-[#2a2a3a]">
          <p className="text-white font-semibold">Airpal Technology Ltd</p>
          <p className="text-[#94a3b8]">Operating as FreeTrust</p>
          <p className="mt-2">
            <a href="mailto:davidocallaghan100@gmail.com" className="text-[#38bdf8] hover:underline">
              davidocallaghan100@gmail.com
            </a>
          </p>
          <p className="text-[#94a3b8] mt-1">Republic of Ireland</p>
        </div>
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#94a3b8]">
      {/* Header */}
      <div className="border-b border-[#2a2a3a] bg-[#13131a]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/" className="text-[#38bdf8] text-sm hover:underline mb-4 inline-block">
            ← Back to FreeTrust
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#6c63ff]/20 flex items-center justify-center text-xl">
              🔒
            </div>
            <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-[#94a3b8] text-sm">
            Last updated: April 2026 &nbsp;·&nbsp; Operated by Airpal Technology Ltd
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-[#94a3b8] leading-relaxed">
          This Privacy Policy explains how FreeTrust, operated by Airpal Technology Ltd, collects,
          uses, and protects your personal data when you use our platform at{' '}
          <a href="https://freetrust.co" className="text-[#38bdf8] hover:underline">
            freetrust.co
          </a>
          . Please read this policy carefully.
        </p>

        {sections.map((section) => (
          <div
            key={section.id}
            id={section.id}
            className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5"
          >
            <h2 className="text-white font-semibold text-lg mb-3">{section.title}</h2>
            <div className="leading-relaxed text-sm">{section.content}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#2a2a3a] mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3 items-center justify-between text-sm text-[#94a3b8]">
          <p>© 2026 Airpal Technology Ltd · FreeTrust</p>
          <div className="flex gap-4">
            <Link href="/terms" className="text-[#38bdf8] hover:underline">Terms of Service</Link>
            <Link href="/" className="hover:text-white">Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
