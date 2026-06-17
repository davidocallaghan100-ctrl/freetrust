export type LegalDocSection = {
  heading: string
  body: string
}

export type LegalDoc = {
  id: string
  title: string
  slug: string
  sections: LegalDocSection[]
}

export const legalDocs: LegalDoc[] = [
  {
    id: 'shareholder-agreement',
    title: 'Shareholder Agreement',
    slug: 'shareholder-agreement',
    sections: [
      { heading: 'Parties', body: 'Airpal Technology Ltd (trading as FreeTrust), Founder: David O’Callaghan (100%), Jurisdiction: Republic of Ireland.' },
      { heading: 'Share Capital', body: 'Ordinary shares carry 1 vote each; Board may create additional share classes by special resolution; no shares issued below par value.' },
      { heading: 'Founder Shares', body: '4-year vesting with 1-year cliff per Schedule B.' },
      { heading: 'Pre-emption Rights', body: 'Existing shareholders offered new shares pro-rata before any third-party issuance.' },
      { heading: 'Transfer of Shares', body: 'Board approval required; first offered to existing shareholders at fair market value.' },
      { heading: 'Drag-Along and Tag-Along', body: 'Drag-along at 75% shareholder approval; tag-along on identical terms for minority.' },
      { heading: 'Reserved Matters', body: 'Unanimous consent required for new share issuance, Constitution amendment, dissolution, asset disposal over €50,000, related-party transactions.' },
      { heading: 'Dividends', body: 'Declared at Board discretion; no dividend that would render Company insolvent.' },
      { heading: 'Confidentiality', body: '3 years post-exit.' },
      { heading: 'Governing Law', body: 'Republic of Ireland; Irish courts have exclusive jurisdiction.' },
    ],
  },
  {
    id: 'cap-table',
    title: 'Cap Table',
    slug: 'cap-table',
    sections: [
      { heading: 'Current Issued Capital', body: 'David O’Callaghan — 10,000,000 Ordinary shares — 100% — Founder round. ESOP Pool (reserved, unissued) — 1,000,000 Option Pool — Pre-Seed. Future Investors — TBD — Series A Preferred.' },
      { heading: 'Fully Diluted Illustrative', body: 'David O’Callaghan 78.7% (10,000,000), ESOP Pool 7.9% (1,000,000), Series A illustrative 13.4% (1,700,000), Total 12,700,000.' },
      { heading: 'Notes', body: 'Founder shares subject to 4-year vesting with 1-year cliff. ESOP pool reserved but unissued. This cap table is subject to change upon any new issuance or transfer.' },
    ],
  },
  {
    id: 'esop-agreement',
    title: 'ESOP Agreement',
    slug: 'esop-agreement',
    sections: [
      { heading: 'Pool', body: '1,000,000 options reserved (approx 9.1% fully diluted).' },
      { heading: 'Eligibility', body: 'Employees, advisors, approved contractors.' },
      { heading: 'Vesting', body: '4-year with 1-year cliff — 25% vests at month 12, remainder monthly over 36 months.' },
      { heading: 'Exercise Price', body: 'Fair market value at grant date.' },
      { heading: 'Expiry', body: '10 years from grant.' },
      { heading: 'Good Leaver', body: 'Vested options exercisable within 12 months of departure; unvested lapse.' },
      { heading: 'Bad Leaver', body: 'Unvested lapse immediately; 90 days to exercise vested.' },
      { heading: 'Liquidity Events', body: 'Liquidity events may trigger accelerated vesting at Board discretion.' },
      { heading: 'KEEP Scheme', body: 'KEEP scheme compatible for favourable Irish tax treatment.' },
      { heading: 'Governing Law', body: 'Governed by Irish law and Companies Act 2014.' },
    ],
  },
  {
    id: 'non-disclosure-agreement',
    title: 'Non-Disclosure Agreement',
    slug: 'non-disclosure-agreement',
    sections: [
      { heading: 'Disclosing Party', body: 'Airpal Technology Ltd (trading as FreeTrust).' },
      { heading: 'Receiving Party', body: '[Full Name / Organisation].' },
      { heading: 'Covered Information', body: 'Technology and source code, business plans and financials, customer lists and user data, Trust Coin economy design, marketing strategy and pricing, any information marked or reasonably understood as confidential.' },
      { heading: 'Obligations', body: 'Keep strictly confidential, no third-party disclosure without consent, use only for the agreed Purpose, protect with at least reasonable care, notify of any unauthorised disclosure immediately.' },
      { heading: 'Exclusions', body: 'Publicly available information, previously known to recipient, received from third party without breach, required by law (with prior notice where permitted).' },
      { heading: 'Term', body: '3 years from effective date.' },
      { heading: 'Return', body: 'Promptly return or destroy on request.' },
      { heading: 'Remedies', body: 'Injunctive relief available.' },
      { heading: 'Governing Law', body: 'Republic of Ireland.' },
    ],
  },
  {
    id: 'ip-assignment-agreement',
    title: 'IP Assignment Agreement',
    slug: 'ip-assignment-agreement',
    sections: [
      { heading: 'Assignee', body: 'Airpal Technology Ltd (trading as FreeTrust).' },
      { heading: 'Assignor', body: '[Full Name].' },
      { heading: 'Assigned IP', body: 'All source code, scripts and technical documentation; all design assets and UI/UX materials; all business concepts and know-how; all patents, trademarks, copyright and database rights; all future IP arising from work for the Company.' },
      { heading: 'Moral Rights', body: 'Moral rights waived to the fullest extent permitted by law.' },
      { heading: 'Warranties', body: 'Assignor warrants sole ownership, no third-party claims, no prior assignment or encumbrance.' },
      { heading: 'Further Assurance', body: 'Assignor agrees to sign further documents to perfect the assignment.' },
      { heading: 'Governing Law', body: 'Governed by Irish law.' },
    ],
  },
  {
    id: 'trademark-ip-policy',
    title: 'Trademark & IP Policy',
    slug: 'trademark-ip-policy',
    sections: [
      { heading: 'Owned Marks', body: 'FreeTrust (word mark, pending EU registration), FreeTrust.co (domain brand, registered globally), Trust Coin with ₮ symbol (product name, common law use in Ireland), FreeTrust logo (device mark, pending filing).' },
      { heading: 'Platform Technology', body: 'Platform technology constitutes trade secrets: Next.js frontend implementation, Supabase schema and RLS policies, Trust Coin economy logic and RPCs, AI-powered agent infrastructure, messaging and notification systems.' },
      { heading: 'Open Source', body: 'Third-party open-source software used under applicable licences (MIT, Apache 2.0).' },
      { heading: 'Third-Party Use', body: 'FreeTrust name and marks may only be used by third parties with express written permission.' },
      { heading: 'Priority Actions', body: 'File EU trade mark Q3 2026, file Irish trade mark for Trust Coin logo Q4 2026, conduct freedom-to-operate search before Series A.' },
    ],
  },
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    slug: 'terms-of-service',
    sections: [
      { heading: 'Platform', body: 'FreeTrust is a community economy marketplace for verified peer-to-peer commerce powered by Trust Coins (₮).' },
      { heading: 'Eligibility', body: '18 years or older, legal capacity to contract, accurate registration information, one account per individual or business.' },
      { heading: 'Fees', body: '8% on services, 5% on products, Trust Coins may offset up to 20% of applicable fees.' },
      { heading: 'Trust Coins', body: 'Internal platform currency only, no cash value, cannot be withdrawn, issued and spent solely via approved RPC functions.' },
      { heading: 'Prohibited', body: 'False or fraudulent listings, harassment or abuse, fee circumvention or off-platform payments, unlawful or infringing content, hacking or scraping.' },
      { heading: 'IP', body: 'Users retain ownership of their content but grant FreeTrust a non-exclusive royalty-free licence to display and distribute it on the platform.' },
      { heading: 'Liability', body: 'Capped at fees paid in the prior 3 months; no liability for indirect or consequential damages.' },
      { heading: 'Termination', body: 'FreeTrust may suspend or terminate accounts in breach; users may close accounts at any time.' },
      { heading: 'Changes', body: '30 days notice before material changes.' },
      { heading: 'Governing Law', body: 'Republic of Ireland.' },
      { heading: 'Contact', body: 'David@freetrust.co.' },
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    sections: [
      { heading: 'Data Controller', body: 'Airpal Technology Ltd. Contact: David@freetrust.co.' },
      { heading: 'Data Collected', body: 'Account data (name, email, profile photo, location, bio), transaction data (services purchased, Trust Coin history, Stripe payment references only — no card data stored), usage data (log data, IP, browser, device, session), communications (platform messages, support requests).' },
      { heading: 'Legal Basis', body: 'Contract performance, legitimate interests, legal obligation, consent where required.' },
      { heading: 'Processors', body: 'Supabase (EU region), Vercel, Stripe, Resend — each under a data processing agreement.' },
      { heading: 'Retention', body: 'Data deleted within 30 days of account closure except where required by law.' },
      { heading: 'GDPR Rights', body: 'Access, correction, erasure, restriction, portability, right to complain to the DPC at dataprotection.ie.' },
      { heading: 'Cookies', body: 'Essential and functional cookies only; manage via browser settings.' },
      { heading: 'Third Parties', body: 'No data sold to third parties. No data transferred outside EEA without appropriate safeguards.' },
      { heading: 'Minimum Age', body: '18.' },
      { heading: 'Requests', body: 'Contact for requests: David@freetrust.co.' },
    ],
  },
  {
    id: 'legal-compliance',
    title: 'Legal Compliance',
    slug: 'legal-compliance',
    sections: [
      { heading: 'Company Registration', body: 'Airpal Technology Ltd, Republic of Ireland, registered with the CRO.' },
      { heading: 'GDPR', body: 'Data Controller status, Supabase DPA in place, DPIA required before AI agent launch, no EEA data transfers without safeguards.' },
      { heading: 'Consumer Law', body: 'Compliant with Consumer Rights Act 2022 (Ireland) and EU Digital Services Act obligations for small platforms.' },
      { heading: 'Tax', body: '12.5% corporation tax, VAT registration on threshold (€37,500 services), PAYE and PRSI from first hire, R&D Tax Credit potentially available at 25%.' },
      { heading: 'Payments', body: 'Stripe processes all payments; FreeTrust holds no user funds; Trust Coins are not e-money.' },
      { heading: 'Employment', body: 'All employees engaged under Irish law with written contracts; ESOP grants comply with Companies Act 2014.' },
      { heading: 'Priority Actions', body: 'File EU trade mark Q3 2026, DPIA for AI agents Q3 2026, EIIS application pre-raise, DSA compliance review Q4 2026.' },
      { heading: 'Contact', body: 'David@freetrust.co.' },
    ],
  },
  {
    id: 'eiis-tax-relief',
    title: 'EIIS Tax Relief',
    slug: 'eiis-tax-relief',
    sections: [
      { heading: 'Overview', body: 'The Employment Investment Incentive Scheme (EIIS) allows Irish income tax payers to claim 40% income tax relief on investments in qualifying companies.' },
      { heading: 'Investor Limits', body: 'Maximum annual investment per investor: €500,000. Minimum holding period: 4 years. CGT deferral may be available on exit gains.' },
      { heading: 'Company Qualifying Criteria', body: 'Incorporated and tax resident in Ireland, unlisted, qualifying trade (digital marketplace qualifies), fewer than 250 employees, gross assets below €43 million pre-investment, investment used for qualifying trade within 4 years, not in financial difficulty.' },
      { heading: 'Investor Criteria', body: 'Irish income tax payer, non-connected individual (subject to exceptions for qualifying directors), newly issued ordinary shares, held for minimum 4 years.' },
      { heading: 'Example', body: 'Investor commits €50,000, receives €20,000 income tax relief (40%), net cost €30,000, 3x exit returns €150,000, net gain €120,000 on €30,000 outlay.' },
      { heading: 'Application Process', body: 'Company applies to Revenue on Form EIIS 1, Revenue issues eligibility certificate, investor receives Form EIIS 3, investor claims relief on Form 11 annual return, shares held 4 years minimum.' },
      { heading: 'Action Plan', body: 'Engage Irish solicitor and accountant experienced in EIIS, confirm qualifying criteria, prepare business plan and projections for Revenue, apply for EIIS certification before round closes, ensure shareholder agreement is EIIS-compatible, maintain 4-year capital deployment plan.' },
      { heading: 'Contact', body: 'David@freetrust.co.' },
      { heading: 'Disclaimer', body: 'This document is for planning purposes only and does not constitute tax or legal advice.' },
    ],
  },
]
