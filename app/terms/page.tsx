import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | FreeTrust',
  description: 'Terms of Service for FreeTrust, operated by Airpal Technology Ltd.',
}

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: (
      <p>
        By accessing or using the FreeTrust platform at{' '}
        <a href="https://freetrust.co" className="text-[#38bdf8] hover:underline">freetrust.co</a>{' '}
        (&ldquo;Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not
        agree to these Terms, you may not access or use the Platform. These Terms constitute a legally
        binding agreement between you and Airpal Technology Ltd, operating as FreeTrust.
      </p>
    ),
  },
  {
    id: 'description',
    title: '2. About FreeTrust',
    content: (
      <>
        <p>
          FreeTrust is a trust-based community platform operated by{' '}
          <strong className="text-white">Airpal Technology Ltd</strong>, a company registered in the
          Republic of Ireland. The Platform enables:
        </p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Freelancers and gig workers to list and sell services and products</li>
          <li>Community members to connect, collaborate, and transact</li>
          <li>Users to create and attend events</li>
          <li>Members to manage their work calendar and schedule</li>
          <li>Organisations and groups to collaborate and grow</li>
        </ul>
      </>
    ),
  },
  {
    id: 'accounts',
    title: '3. User Accounts',
    content: (
      <>
        <p>To access most features of the Platform, you must create an account. You agree to:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Provide accurate, current, and complete information during registration</li>
          <li>Maintain and promptly update your account information</li>
          <li>Keep your login credentials confidential and not share them with others</li>
          <li>Be responsible for all activity that occurs under your account</li>
          <li>Notify us immediately of any unauthorised use of your account</li>
          <li>Be at least 18 years of age to create an account</li>
        </ul>
        <p className="mt-3">
          We reserve the right to suspend or terminate accounts that violate these Terms or that we
          reasonably believe are being used for fraudulent or harmful purposes.
        </p>
      </>
    ),
  },
  {
    id: 'listings',
    title: '4. Listings, Gigs & Transactions',
    content: (
      <>
        <p>
          FreeTrust provides a marketplace for users to list and transact services, products, and gigs.
          By creating a listing, you represent and warrant that:
        </p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>You have the legal right to offer the service or sell the product</li>
          <li>Your listing is accurate, honest, and not misleading</li>
          <li>The offering complies with all applicable laws and regulations</li>
          <li>You will fulfil transactions in good faith and as described</li>
        </ul>
        <p className="mt-3">
          FreeTrust acts as a platform facilitator only and is not a party to transactions between
          users. Disputes between buyers and sellers are the responsibility of the parties involved.
          We may offer dispute resolution assistance at our discretion.
        </p>
        <p className="mt-3">
          Payments processed through the Platform are subject to the terms of our payment processor.
          FreeTrust may charge platform fees for certain transactions, which will be disclosed at the
          time of the transaction.
        </p>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: '5. Prohibited Conduct',
    content: (
      <>
        <p>You agree not to use the Platform to:</p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Violate any applicable law or regulation</li>
          <li>Post false, misleading, or fraudulent content</li>
          <li>Harass, threaten, or harm other users</li>
          <li>Infringe the intellectual property rights of others</li>
          <li>Upload or transmit malware, viruses, or harmful code</li>
          <li>Scrape, crawl, or systematically extract data from the Platform without permission</li>
          <li>Create fake accounts or impersonate others</li>
          <li>Engage in spam, unsolicited marketing, or pyramid schemes</li>
          <li>Facilitate money laundering or illegal financial activity</li>
          <li>Circumvent or attempt to bypass Platform security measures</li>
          <li>List or sell prohibited items including but not limited to: illegal goods, weapons, controlled substances, or counterfeit products</li>
        </ul>
        <p className="mt-3">
          Violation of these prohibitions may result in immediate account suspension or termination,
          removal of content, and/or referral to law enforcement authorities.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: '6. User Content',
    content: (
      <>
        <p>
          You retain ownership of content you create and post on FreeTrust (&ldquo;User Content&rdquo;). By
          posting User Content, you grant FreeTrust a non-exclusive, worldwide, royalty-free licence to
          use, display, reproduce, and distribute that content solely for the purpose of operating and
          promoting the Platform.
        </p>
        <p className="mt-3">
          You are solely responsible for your User Content. We do not endorse or verify User Content
          and are not liable for any content posted by users. We reserve the right to remove any
          content that violates these Terms or that we consider harmful, offensive, or otherwise
          inappropriate, at our sole discretion.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: '7. Intellectual Property',
    content: (
      <p>
        The FreeTrust Platform, including its design, software, branding, and original content, is
        owned by Airpal Technology Ltd and protected by intellectual property laws. You may not copy,
        reproduce, modify, distribute, or create derivative works based on the Platform or its content
        without our prior written permission. The FreeTrust name, logo, and associated marks are
        trademarks of Airpal Technology Ltd.
      </p>
    ),
  },
  {
    id: 'third-party',
    title: '8. Third-Party Services',
    content: (
      <p>
        The Platform may integrate with or link to third-party services (such as Google Calendar,
        payment processors, and event platforms). These integrations are provided for your convenience.
        FreeTrust is not responsible for the content, privacy practices, or terms of third-party
        services. Your use of third-party services is subject to their respective terms and policies.
      </p>
    ),
  },
  {
    id: 'liability',
    title: '9. Limitation of Liability',
    content: (
      <>
        <p>
          To the maximum extent permitted by applicable law, Airpal Technology Ltd and its directors,
          employees, and agents shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising from:
        </p>
        <ul className="mt-3 space-y-2 list-disc list-inside text-[#94a3b8]">
          <li>Your use of or inability to use the Platform</li>
          <li>Transactions between users on the Platform</li>
          <li>Unauthorised access to or alteration of your data</li>
          <li>Any third-party content or services accessed through the Platform</li>
        </ul>
        <p className="mt-3">
          Our total liability to you for any claims arising from your use of the Platform shall not
          exceed the greater of (a) the total fees paid by you to FreeTrust in the 12 months preceding
          the claim, or (b) €100.
        </p>
        <p className="mt-3">
          Nothing in these Terms limits our liability for death or personal injury caused by our
          negligence, fraud, or any other liability that cannot be excluded by law.
        </p>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: '10. Disclaimers',
    content: (
      <p>
        The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any
        kind, express or implied. We do not warrant that the Platform will be uninterrupted,
        error-free, or free of viruses or other harmful components. We do not endorse or verify the
        accuracy of user listings, reviews, or profiles.
      </p>
    ),
  },
  {
    id: 'termination',
    title: '11. Termination',
    content: (
      <p>
        You may delete your account at any time from your account settings. We may suspend or terminate
        your access to the Platform at any time, with or without notice, if we reasonably believe you
        have violated these Terms or if required by law. Upon termination, your right to use the
        Platform ceases immediately. Provisions of these Terms that by their nature should survive
        termination will continue to apply.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: '12. Governing Law & Disputes',
    content: (
      <p>
        These Terms are governed by and construed in accordance with the laws of the{' '}
        <strong className="text-white">Republic of Ireland</strong>. Any dispute arising out of or in
        connection with these Terms shall be subject to the exclusive jurisdiction of the courts of
        Ireland. If you are a consumer in the EU, you may also have the right to use the European
        Commission&rsquo;s{' '}
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#38bdf8] hover:underline"
        >
          Online Dispute Resolution platform
        </a>
        .
      </p>
    ),
  },
  {
    id: 'changes',
    title: '13. Changes to These Terms',
    content: (
      <p>
        We may update these Terms from time to time. We will notify you of material changes by email
        or by displaying a notice on the Platform. Your continued use of the Platform after changes
        are posted constitutes your acceptance of the updated Terms. If you do not agree to the
        updated Terms, you must stop using the Platform and may delete your account.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '14. Contact Us',
    content: (
      <>
        <p>For any questions about these Terms, please contact:</p>
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#94a3b8]">
      {/* Header */}
      <div className="border-b border-[#2a2a3a] bg-[#13131a]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/" className="text-[#38bdf8] text-sm hover:underline mb-4 inline-block">
            ← Back to FreeTrust
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/20 flex items-center justify-center text-xl">
              📋
            </div>
            <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-[#94a3b8] text-sm">
            Last updated: April 2026 &nbsp;·&nbsp; Operated by Airpal Technology Ltd
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-[#94a3b8] leading-relaxed">
          Please read these Terms of Service carefully before using FreeTrust. These Terms govern your
          access to and use of the FreeTrust platform, operated by Airpal Technology Ltd.
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
            <Link href="/privacy" className="text-[#38bdf8] hover:underline">Privacy Policy</Link>
            <Link href="/" className="hover:text-white">Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
