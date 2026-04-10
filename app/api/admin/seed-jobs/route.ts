export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const JOBS = [
  {
    title: 'Senior Software Engineer',
    description: 'Join our Dublin-based engineering team to build scalable fintech products. You will work on backend services, APIs, and real-time data pipelines. Collaborative, fast-moving environment with strong engineering culture.',
    requirements: '• 4+ years backend development experience\n• Strong TypeScript or Go skills\n• Experience with PostgreSQL and cloud infrastructure (AWS/GCP)\n• Comfortable with CI/CD and Docker\n• Strong communication skills',
    job_type: 'full_time',
    location_type: 'on_site',
    location: 'Dublin, Ireland',
    category: 'Tech',
    tags: ['TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
    salary_min: 75000,
    salary_max: 100000,
    salary_currency: 'EUR',
  },
  {
    title: 'UX/Product Designer',
    description: 'We are looking for a talented UX Designer to join our Cork office. You will lead user research, wireframing, and end-to-end product design across web and mobile products. Tight collaboration with engineering and product.',
    requirements: '• 3+ years product/UX design experience\n• Proficient in Figma\n• Portfolio demonstrating user-centred design process\n• Experience with usability testing\n• Startup or agency background a plus',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Cork, Ireland',
    category: 'Design',
    tags: ['Figma', 'UX Research', 'Product Design', 'Prototyping'],
    salary_min: 55000,
    salary_max: 75000,
    salary_currency: 'EUR',
  },
  {
    title: 'Digital Marketing Manager',
    description: 'Lead our digital marketing efforts from our Galway office. Drive SEO, paid media, email campaigns, and social strategy. You will own growth targets and report directly to the CMO.',
    requirements: '• 4+ years digital marketing experience\n• Strong grasp of SEO, SEM, and email marketing\n• Analytical — comfortable with Google Analytics, HubSpot, or similar\n• Experience managing paid budgets (Meta, Google Ads)\n• Excellent written English',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Galway, Ireland',
    category: 'Marketing',
    tags: ['SEO', 'Google Ads', 'Email Marketing', 'HubSpot'],
    salary_min: 50000,
    salary_max: 65000,
    salary_currency: 'EUR',
  },
  {
    title: 'Junior Frontend Developer',
    description: 'Great opportunity for a motivated junior developer to join a growing SaaS startup in Limerick. Work with React and Next.js on a real product used by thousands of businesses.',
    requirements: '• 1–2 years frontend development experience (or strong portfolio)\n• Solid HTML, CSS, JavaScript fundamentals\n• Familiarity with React\n• Eager to learn, takes feedback well\n• Degree in CS or equivalent experience',
    job_type: 'full_time',
    location_type: 'on_site',
    location: 'Limerick, Ireland',
    category: 'Tech',
    tags: ['React', 'Next.js', 'JavaScript', 'CSS'],
    salary_min: 35000,
    salary_max: 48000,
    salary_currency: 'EUR',
  },
  {
    title: 'Data Analyst',
    description: 'Join our analytics team in Dublin to help make sense of large datasets from our e-commerce platform. You will build dashboards, run ad hoc analysis, and provide insight to product and commercial teams.',
    requirements: '• 2+ years data analysis experience\n• Strong SQL skills\n• Experience with Looker, Tableau, or similar BI tools\n• Python or R a bonus\n• Clear and concise communicator',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Dublin, Ireland',
    category: 'Data',
    tags: ['SQL', 'Python', 'Tableau', 'Analytics'],
    salary_min: 48000,
    salary_max: 65000,
    salary_currency: 'EUR',
  },
  {
    title: 'DevOps Engineer',
    description: 'We need an experienced DevOps Engineer to maintain and scale our cloud infrastructure based in Cork. You will manage Kubernetes clusters, CI/CD pipelines, and monitoring across AWS. On-call rotation shared across the team.',
    requirements: '• 3+ years DevOps or platform engineering experience\n• Kubernetes and Docker expertise\n• AWS certification a plus\n• Scripting in Bash or Python\n• Infrastructure as Code (Terraform, Pulumi)',
    job_type: 'full_time',
    location_type: 'on_site',
    location: 'Cork, Ireland',
    category: 'DevOps',
    tags: ['Kubernetes', 'AWS', 'Terraform', 'Docker', 'CI/CD'],
    salary_min: 70000,
    salary_max: 90000,
    salary_currency: 'EUR',
  },
  {
    title: 'Sales Development Representative',
    description: 'Kickstart your sales career at a fast-growing B2B SaaS company in Galway. You will prospect, qualify leads, and book demos for the account executive team. Full training and uncapped commission.',
    requirements: '• 1+ year in a sales or customer-facing role preferred\n• Strong phone and email communication\n• Hungry, resilient, goal-oriented\n• CRM experience (Salesforce or HubSpot) a plus\n• Degree not required',
    job_type: 'full_time',
    location_type: 'on_site',
    location: 'Galway, Ireland',
    category: 'Sales',
    tags: ['B2B Sales', 'SaaS', 'Cold Outreach', 'CRM'],
    salary_min: 32000,
    salary_max: 45000,
    salary_currency: 'EUR',
  },
  {
    title: 'Product Manager',
    description: 'We are hiring a Product Manager to own our core platform roadmap. Based in Dublin with flexibility to work 2 days from home. You will work across design, engineering, and commercial teams to deliver a product loved by users.',
    requirements: '• 3+ years product management experience\n• Track record of shipping features in an agile environment\n• Strong analytical and communication skills\n• Experience in B2C or marketplace products preferred\n• Comfortable with product analytics tools',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Dublin, Ireland',
    category: 'Product',
    tags: ['Roadmap', 'Agile', 'Jira', 'Product Strategy'],
    salary_min: 65000,
    salary_max: 85000,
    salary_currency: 'EUR',
  },
  {
    title: 'Content Writer / Copywriter',
    description: 'Join a Limerick-based content agency working across multiple clients in tech, finance, and retail. You will write blog posts, landing pages, email sequences, and social content. Flexible hours, on-site 3 days per week.',
    requirements: '• Portfolio of published content across B2B or B2C brands\n• SEO writing experience\n• Fast and reliable — high volume environment\n• Degree in English, Journalism, Marketing, or equivalent\n• Experience with CMS tools (WordPress, Webflow)',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Limerick, Ireland',
    category: 'Writing',
    tags: ['Copywriting', 'SEO', 'Content Strategy', 'WordPress'],
    salary_min: 38000,
    salary_max: 50000,
    salary_currency: 'EUR',
  },
  {
    title: 'QA Engineer (Contract)',
    description: 'Six-month contract role at a Cork-based healthtech company. You will own test planning, manual and automated testing, and work closely with the engineering team to ensure high product quality ahead of a major release.',
    requirements: '• 3+ years QA experience\n• Experience with Playwright or Cypress\n• Comfortable writing test cases and bug reports\n• Healthcare or regulated industry experience a bonus\n• Available to start within 4 weeks',
    job_type: 'contract',
    location_type: 'on_site',
    location: 'Cork, Ireland',
    category: 'QA',
    tags: ['Playwright', 'Cypress', 'Test Automation', 'Manual Testing'],
    salary_min: 400,
    salary_max: 550,
    salary_currency: 'EUR',
  },
  {
    title: 'Finance & Operations Analyst',
    description: 'Join a scaling fintech in Dublin as our first dedicated Finance Analyst. You will own financial modelling, monthly reporting, and support the CFO on fundraising materials. Broad role with room to grow.',
    requirements: '• ACA / ACCA qualified or finalist\n• Strong Excel and financial modelling skills\n• Experience in a high-growth startup or corporate finance\n• Clear communicator who can present to leadership\n• FP&A experience preferred',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Dublin, Ireland',
    category: 'Finance',
    tags: ['Financial Modelling', 'Excel', 'FP&A', 'Reporting'],
    salary_min: 55000,
    salary_max: 72000,
    salary_currency: 'EUR',
  },
  {
    title: 'AI/ML Engineer',
    description: 'Help build the next generation of AI-powered features at our Galway R&D centre. You will work on NLP models, recommendation systems, and model deployment at scale. Close collaboration with product and data teams.',
    requirements: '• MSc or PhD in ML, CS, or related field (or equivalent experience)\n• Proficient in Python, PyTorch or TensorFlow\n• Experience deploying ML models to production\n• Familiarity with LLMs and prompt engineering a plus\n• Publications or open-source contributions welcome',
    job_type: 'full_time',
    location_type: 'hybrid',
    location: 'Galway, Ireland',
    category: 'AI',
    tags: ['Python', 'PyTorch', 'NLP', 'LLMs', 'Machine Learning'],
    salary_min: 80000,
    salary_max: 110000,
    salary_currency: 'EUR',
  },
]

export async function POST(req: NextRequest) {
  try {
    // Auth check — must be admin
    const supabase = await createServerClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createServiceClient(serviceUrl, serviceKey)

    const rows = JOBS.map(j => ({
      ...j,
      poster_id: user.id,
      status: 'active',
      application_deadline: null,
    }))

    const { data, error } = await admin.from('jobs').insert(rows).select('id, title')
    if (error) {
      console.error('[seed-jobs]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ seeded: data?.length ?? 0, jobs: data })
  } catch (err) {
    console.error('[seed-jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
