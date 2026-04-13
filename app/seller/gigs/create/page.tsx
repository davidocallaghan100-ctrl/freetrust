
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Category = 'online' | 'offline'

type Package = {
  name: string
  description: string
  price: string
  deliveryTime: string
  revisions: string
  features: string[]
}

type GigFormData = {
  title: string
  description: string
  category: Category
  packages: {
    basic: Package
    standard: Package
    premium: Package
  }
  location: string
  serviceRadius: string
  deliveryTypes: string[]
  images: File[]
  tags: string[]
  skills: string[]
}

const STEPS = [
  { id: 1, label: 'Overview' },
  { id: 2, label: 'Packages' },
  { id: 3, label: 'Details' },
  { id: 4, label: 'Preview' },
]

const ONLINE_CATEGORIES = [
  'Design & Creative',
  'Development & Tech',
  'Marketing & Growth',
  'Writing & Content',
  'Video & Animation',
  'Music & Audio',
  'Business & Consulting',
  'Finance & Accounting',
  'Legal & Compliance',
  'Coaching & Mentoring',
  'Education & Tutoring',
  'AI & Automation',
  'Data & Analytics',
  'Photography & Editing',
  'Social Media Management',
  'SEO & Digital Marketing',
]

const OFFLINE_CATEGORIES = [
  'Trades & Construction',
  'Home & Garden',
  'Health & Wellness',
  'Beauty & Personal Care',
  'Food & Catering',
  'Events & Entertainment',
  'Transport & Delivery',
  'Childcare & Education',
  'Pet Services',
  'Elder Care',
  'Community Services',
]

const DELIVERY_OPTIONS = [
  '1 day',
  '2 days',
  '3 days',
  '5 days',
  '7 days',
  '14 days',
  '21 days',
  '30 days',
]

const REVISION_OPTIONS = ['1', '2', '3', '5', 'Unlimited']

const defaultPackage = (name: string): Package => ({
  name,
  description: '',
  price: '',
  deliveryTime: '3 days',
  revisions: '1',
  features: [''],
})

const DELIVERY_TYPE_OPTIONS = [
  { id: 'digital',       label: '📧 Digital Delivery',      forOnline: true,  forOffline: false },
  { id: 'download',      label: '⬇️ Instant Download',      forOnline: true,  forOffline: false },
  { id: 'courier',       label: '🚚 Courier',               forOnline: false, forOffline: true  },
  { id: 'collection',    label: '🏪 Collection',            forOnline: false, forOffline: true  },
  { id: 'post',          label: '📬 Post / Royal Mail',     forOnline: false, forOffline: true  },
  { id: 'sameday',       label: '⚡ Same Day',              forOnline: false, forOffline: true  },
  { id: 'local',         label: '🏠 Local Delivery',        forOnline: false, forOffline: true  },
  { id: 'international', label: '✈️ International',         forOnline: true,  forOffline: false },
]

const SERVICE_RADII = ['5km', '10km', '25km', '50km', '100km', 'National', 'International']

const initialForm: GigFormData = {
  title: '',
  description: '',
  category: 'online',
  packages: {
    basic: defaultPackage('Basic'),
    standard: defaultPackage('Standard'),
    premium: defaultPackage('Premium'),
  },
  location: '',
  serviceRadius: '25km',
  deliveryTypes: [],
  images: [],
  tags: [],
  skills: [],
}

export default function CreateGigPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<GigFormData>(initialForm)
  const [tagInput, setTagInput] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const updateForm = (field: keyof GigFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const updatePackage = (
    tier: keyof GigFormData['packages'],
    field: keyof Package,
    value: string | string[]
  ) => {
    setForm(prev => ({
      ...prev,
      packages: {
        ...prev.packages,
        [tier]: { ...prev.packages[tier], [field]: value },
      },
    }))
  }

  const updatePackageFeature = (
    tier: keyof GigFormData['packages'],
    index: number,
    value: string
  ) => {
    const features = [...form.packages[tier].features]
    features[index] = value
    updatePackage(tier, 'features', features)
  }

  const addFeature = (tier: keyof GigFormData['packages']) => {
    const features = [...form.packages[tier].features, '']
    updatePackage(tier, 'features', features)
  }

  const removeFeature = (tier: keyof GigFormData['packages'], index: number) => {
    const features = form.packages[tier].features.filter((_, i) => i !== index)
    updatePackage(tier, 'features', features.length ? features : [''])
  }

  const handleImageFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, 5 - form.images.length)
    if (!fileArray.length) return
    const newImages = [...form.images, ...fileArray]
    setForm(prev => ({ ...prev, images: newImages }))
    fileArray.forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        setImagePreviews(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }, [form.images])

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
      updateForm('tags', [...form.tags, tag])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    updateForm('tags', form.tags.filter(t => t !== tag))
  }

  const addSkill = () => {
    const skill = skillInput.trim()
    if (skill && !form.skills.includes(skill) && form.skills.length < 10) {
      updateForm('skills', [...form.skills, skill])
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    updateForm('skills', form.skills.filter(s => s !== skill))
  }

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {}
    if (s === 1) {
      if (!form.title.trim()) newErrors.title = 'Title is required'
      else if (form.title.length < 15) newErrors.title = 'Title must be at least 15 characters'
      if (!form.description.trim()) newErrors.description = 'Description is required'
      else if (form.description.length < 50) newErrors.description = 'Description must be at least 50 characters'
      if (!selectedSubCategory) newErrors.subCategory = 'Please select a sub-category'
      if (form.category === 'offline' && !form.location.trim()) newErrors.location = 'Location is required for offline services'
    }
    if (s === 2) {
      const tiers = ['basic', 'standard', 'premium'] as const
      tiers.forEach(tier => {
        const pkg = form.packages[tier]
        if (!pkg.description.trim()) newErrors[`${tier}_description`] = `${pkg.name} package description is required`
        if (!pkg.price || isNaN(Number(pkg.price)) || Number(pkg.price) <= 0) newErrors[`${tier}_price`] = `Valid price required for ${pkg.name}`
      })
    }
    if (s === 3) {
      if (form.images.length === 0) newErrors.images = 'At least one image is required'
      if (form.tags.length === 0) newErrors.tags = 'Add at least one tag'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, 4))
  }

  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const handlePublish = async () => {
    // ── Pre-submit validation ──────────────────────────────────────────
    // Three required-field checks before hitting the API, so an obviously
    // incomplete gig never generates a 400 round-trip. All three also
    // write into the existing per-field `errors` state so the user sees
    // red outlines on the fields they need to fix.
    const nextErrors: Record<string, string> = {}
    const title = form.title.trim()
    if (!title) nextErrors.title = 'Give your gig a title'

    // Description falls back to the basic package description — some users
    // only fill one or the other. The publish route rejects empty strings.
    const description = form.description.trim() || form.packages.basic.description.trim()
    if (!description) nextErrors.description = 'Add a description of what you offer'

    const priceRaw = form.packages.basic.price.trim()
    const priceNum = priceRaw ? Number(priceRaw) : NaN
    if (!priceRaw || !Number.isFinite(priceNum) || priceNum <= 0) {
      nextErrors.price = 'Set a basic package price greater than 0'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...nextErrors }))
      return
    }

    // Clear any stale error banner from a previous failed attempt so the
    // user doesn't see the old message while the new submit is in flight.
    setErrors(prev => {
      const { publish: _drop, ...rest } = prev
      void _drop
      return rest
    })
    setIsSubmitting(true)

    // ── Field mapping ──────────────────────────────────────────────────
    // form state → /api/create/publish payload
    //
    // Top-level category: prefer the user-selected subcategory label
    // (e.g. "Design & Creative") over the broad 'online'/'offline' slug
    // because subcategories are what the services browse page actually
    // filters on.
    const categoryLabel = selectedSubCategory || form.category

    // is_remote derives from the broad category: online gigs are remote,
    // offline gigs are on-site. Drives both the top-level is_remote body
    // field and the is_remote column on the services row.
    const isRemote = form.category === 'online'

    // structured_location: the form doesn't use LocationPicker, so we
    // only have the free-text `form.location` string. Send it as the
    // location_label so it at least appears on the listing card — lat/
    // lng are null, country/city unknown until someone upgrades the
    // form to Nominatim autocomplete.
    const structuredLocation = form.location.trim()
      ? {
          country: null,
          region: null,
          city: null,
          latitude: null,
          longitude: null,
          location_label: form.location.trim(),
        }
      : null

    // Log everything the services schema can't persist yet. Single
    // console.warn so Vercel logs show exactly what was dropped per
    // publish attempt — makes the silent-data-loss visible until the
    // schema grows columns for packages / delivery / tags / etc.
    console.warn(
      '[gig publish] tiered packages not persisted — schema does not support packages yet:',
      {
        standard: form.packages.standard,
        premium:  form.packages.premium,
        basicExtras: {
          deliveryTime: form.packages.basic.deliveryTime,
          revisions:    form.packages.basic.revisions,
          features:     form.packages.basic.features,
        },
        deliveryTypes: form.deliveryTypes,
        serviceRadius: form.serviceRadius,
        tags:          form.tags,
        skills:        form.skills,
        imagesCount:   form.images.length,
      }
    )

    try {
      const res = await fetch('/api/create/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'service',
          data: {
            title,
            description,
            price: priceNum,
          },
          category: categoryLabel,
          location: form.location.trim() || undefined,
          structured_location: structuredLocation,
          is_remote: isRemote,
          currency_code: 'EUR',
        }),
      })

      const d = await res.json().catch(() => null) as {
        success?: boolean
        redirectUrl?: string
        error?: string
      } | null

      if (!res.ok) {
        const msg = d?.error ?? `Publish failed (HTTP ${res.status})`
        console.error('[gig publish]', msg)
        setErrors(prev => ({ ...prev, publish: msg }))
        setIsSubmitting(false)
        return
      }

      // Success — redirect to the services browse page with a query
      // param so the downstream page can fire a toast. Not resetting
      // isSubmitting here because the navigation unmounts the component.
      router.push('/services?published=true')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[gig publish] network error:', msg)
      setErrors(prev => ({ ...prev, publish: `Network error: ${msg}` }))
      setIsSubmitting(false)
    }
  }

  const categories = form.category === 'online' ? ONLINE_CATEGORIES : OFFLINE_CATEGORIES

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={() => router.back()} style={styles.backBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div style={styles.headerTitle}>
            <h1 style={styles.title}>Create New Gig</h1>
            <p style={styles.subtitle}>Fill in the details to list your service</p>
          </div>
        </div>

        {/* Stepper */}
        <div style={styles.stepper}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={styles.stepWrapper}>
              <div
                style={{
                  ...styles.stepItem,
                  ...(step === s.id ? styles.stepActive : {}),
                  ...(step > s.id ? styles.stepDone : {}),
                  ...(step < s.id ? styles.stepPending : {}),
                }}
              >
                <div
                  style={{
                    ...styles.stepCircle,
                    ...(step === s.id ? styles.stepCircleActive : {}),
                    ...(step > s.id ? styles.stepCircleDone : {}),
                  }}
                >
                  {step > s.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    s.id
                  )}
                </div>
                <span style={styles.stepLabel}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    ...styles.stepConnector,
                    ...(step > s.id ? styles.stepConnectorDone : {}),
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div style={styles.card}>
          {/* Step 1: Overview */}
          {step === 1 && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Gig Overview</h2>
              <p style={styles.stepDesc}>Tell buyers about your service</p>

              {/* Category Toggle */}
              <div style={styles.field}>
                <label style={styles.label}>Service Type</label>
                <div style={styles.categoryToggle}>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(form.category === 'online' ? styles.toggleBtnActive : {}),
                    }}
                    onClick={() => {
                      updateForm('category', 'online')
                      setSelectedSubCategory('')
                    }}
                    type="button"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Online Service
                  </button>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(form.category === 'offline' ? styles.toggleBtnActive : {}),
                    }}
                    onClick={() => {
                      updateForm('category', 'offline')
                      setSelectedSubCategory('')
                    }}
                    type="button"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Offline Service
                  </button>
                </div>
              </div>

              {/* Sub Category */}
              <div style={styles.field}>
                <label style={styles.label}>Category</label>
                <div style={styles.categoryGrid}>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      style={{
                        ...styles.catChip,
                        ...(selectedSubCategory === cat ? styles.catChipActive : {}),
                      }}
                      onClick={() => {
                        setSelectedSubCategory(cat)
                        setErrors(prev => ({ ...prev, subCategory: '' }))
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {errors.subCategory && <p style={styles.error}>{errors.subCategory}</p>}
              </div>

              {/* Title */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Gig Title
                  <span style={styles.labelHint}>{form.title.length}/80</span>
                </label>
                <input
                  style={{ ...styles.input, ...(errors.title ? styles.inputError : {}) }}
                  placeholder="I will design a professional logo for your brand"
                  value={form.title}
                  maxLength={80}
                  onChange={e => updateForm('title', e.target.value)}
                />
                {errors.title && <p style={styles.error}>{errors.title}</p>}
              </div>

              {/* Description */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Description
                  <span style={styles.labelHint}>{form.description.length}/1200</span>
                </label>
                <textarea
                  style={{ ...styles.textarea, ...(errors.description ? styles.inputError : {}) }}
                  placeholder="Describe your service in detail. Explain what buyers will get, your process, and why they should choose you..."
                  value={form.description}
                  maxLength={1200}
                  rows={8}
                  onChange={e => updateForm('description', e.target.value)}
                />
                {errors.description && <p style={styles.error}>{errors.description}</p>}
              </div>

              {/* Location (offline only) */}
              {form.category === 'offline' && (
                <>
                  <div style={styles.field}>
                    <label style={styles.label}>Service Location</label>
                    <div style={styles.inputIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <input
                        style={{ ...styles.inputWithIcon, ...(errors.location ? styles.inputError : {}) }}
                        placeholder="City, town or specific area you serve"
                        value={form.location}
                        onChange={e => updateForm('location', e.target.value)}
                      />
                    </div>
                    {errors.location && <p style={styles.error}>{errors.location}</p>}
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Service Radius</label>
                    <p style={styles.fieldHint}>How far will you travel to deliver this service?</p>
                    <div style={styles.categoryGrid}>
                      {SERVICE_RADII.map(r => (
                        <button key={r} type="button"
                          style={{ ...styles.catChip, ...(form.serviceRadius === r ? styles.catChipActive : {}) }}
                          onClick={() => updateForm('serviceRadius', r)}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Delivery types */}
              <div style={styles.field}>
                <label style={styles.label}>Delivery Method</label>
                <p style={styles.fieldHint}>How will you deliver this service / product?</p>
                <div style={styles.categoryGrid}>
                  {DELIVERY_TYPE_OPTIONS.filter(d => form.category === 'online' ? d.forOnline : d.forOffline).map(d => {
                    const active = form.deliveryTypes.includes(d.id)
                    return (
                      <button key={d.id} type="button"
                        style={{ ...styles.catChip, ...(active ? styles.catChipActive : {}) }}
                        onClick={() => {
                          const next = active
                            ? form.deliveryTypes.filter(x => x !== d.id)
                            : [...form.deliveryTypes, d.id]
                          updateForm('deliveryTypes', next)
                        }}>
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Packages */}
          {step === 2 && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Service Packages</h2>
              <p style={styles.stepDesc}>Define your pricing tiers to give buyers flexible options</p>

              <div style={styles.packagesGrid}>
                {(['basic', 'standard', 'premium'] as const).map(tier => {
                  const pkg = form.packages[tier]
                  const colors = {
                    basic: '#3b82f6',
                    standard: '#8b5cf6',
                    premium: '#f59e0b',
                  }
                  const color = colors[tier]
                  return (
                    <div key={tier} style={{ ...styles.packageCard, borderTopColor: color }}>
                      <div style={{ ...styles.packageHeader, backgroundColor: color + '15' }}>
                        <div style={{ ...styles.packageBadge, backgroundColor: color }}>
                          {pkg.name}
                        </div>
                        <div style={styles.priceWrapper}>
                           <span style={styles.currencySymbol}>€</span>
                          <input
                            style={styles.priceInput}
                            type="number"
                            placeholder="0"
                            min="1"
                            value={pkg.price}
                            onChange={e => updatePackage(tier, 'price', e.target.value)}
                          />
                        </div>
                        {errors[`${tier}_price`] && (
                          <p style={styles.error}>{errors[`${tier}_price`]}</p>
                        )}
                      </div>

                      <div style={styles.packageBody}>
                        <div style={styles.packageField}>
                          <label style={styles.packageLabel}>Description</label>
                          <textarea
                            style={styles.packageTextarea}
                            placeholder={`What's included in the ${pkg.name} package?`}
                            value={pkg.description}
                            rows={3}
                            onChange={e => updatePackage(tier, 'description', e.target.value)}
                          />
                          {errors[`${tier}_description`] && (
                            <p style={styles.error}>{errors[`${tier}_description`]}</p>
                          )}
                        </div>

                        <div style={styles.packageRow}>
                          <div style={styles.packageField}>
                            <label style={styles.packageLabel}>Delivery Time</label>
                            <select
                              style={styles.select}
                              value={pkg.deliveryTime}
                              onChange={e => updatePackage(tier, 'deliveryTime', e.target.value)}
                            >
                              {DELIVERY_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                          <div style={styles.packageField}>
                            <label style={styles.packageLabel}>Revisions</label>
                            <select
                              style={styles.select}
                              value={pkg.revisions}
                              onChange={e => updatePackage(tier, 'revisions', e.target.value)}
                            >
                              {REVISION_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={styles.packageField}>
                          <label style={styles.packageLabel}>What's Included</label>
                          {pkg.features.map((feat, fi) => (
                            <div key={fi} style={styles.featureRow}>
                              <div style={styles.featureDot} />
                              <input
                                style={styles.featureInput}
                                placeholder={`Feature ${fi + 1}`}
                                value={feat}
                                onChange={e => updatePackageFeature(tier, fi, e.target.value)}
                              />
                              <button
                                type="button"
                                style={styles.featureRemoveBtn}
                                onClick={() => removeFeature(tier, fi)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {pkg.features.length < 8 && (
                            <button
                              type="button"
                              style={styles.addFeatureBtn}
                              onClick={() => addFeature(tier)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Add feature
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Gig Details</h2>
              <p style={styles.stepDesc}>Add images, tags, and skills to help buyers find your gig</p>

              {/* Image Upload */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Gig Images
                  <span style={styles.labelHint}>{form.images.length}/5</span>
                </label>
                <p style={styles.fieldHint}>Upload up to 5 images. First image will be the thumbnail.</p>

                <div
                  style={{
                    ...styles.dropZone,
                    ...(isDragging ? styles.dropZoneActive : {}),
                    ...(errors.images ? styles.dropZoneError : {}),
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={e => {
                    e.preventDefault()
                    dragCounter.current++
                    setIsDragging(true)
                  }}
                  onDragLeave={e => {
                    e.preventDefault()
                    dragCounter.current--
                    if (dragCounter.current === 0) setIsDragging(false)
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    dragCounter.current = 0
                    setIsDragging(false)
                    if (e.dataTransfer.files) handleImageFiles(e.dataTransfer.files)
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p style={styles.dropText}>
                    {isDragging ? 'Drop images here' : 'Drag & drop or click to upload'}
                  </p>
                  <p style={styles.dropSubText}>PNG, JPG, WEBP up to 5MB each</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => e.target.files && handleImageFiles(e.target.files)}
                  />
                </div>
                {errors.images && <p style={styles.error}>{errors.images}</p>}

                {imagePreviews.length > 0 && (
                  <div style={styles.imageGrid}>
                    {imagePreviews.map((src, i) => (
                      <div key={i} style={styles.imagePreviewWrapper}>
                        <Image
                          src={src}
                          alt={`Preview ${i + 1}`}
                          fill
                          style={{ objectFit: 'cover', borderRadius: '10px' }}
                        />
                        {i === 0 && <div style={styles.thumbnailBadge}>Thumbnail</div>}
                        <button
                          type="button"
                          style={styles.removeImageBtn}
                          onClick={() => removeImage(i)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Search Tags
                  <span style={styles.labelHint}>{form.tags.length}/10</span>
                </label>
                <p style={styles.fieldHint}>Add keywords that describe your service. Press Enter or comma to add.</p>
                <div style={{ ...styles.tagInputWrapper, ...(errors.tags ? styles.inputError : {}) }}>
                  {form.tags.map(tag => (
                    <span key={tag} style={styles.tag}>
                      #{tag}
                      <button type="button" style={styles.tagRemove} onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                  <input
                    style={styles.tagInput}
                    placeholder={form.tags.length < 10 ? 'Add a tag...' : 'Max tags reached'}
                    value={tagInput}
                    disabled={form.tags.length >= 10}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                </div>
                {errors.tags && <p style={styles.error}>{errors.tags}</p>}
              </div>

              {/* Skills */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Skills
                  <span style={styles.labelHint}>{form.skills.length}/10</span>
                </label>
                <p style={styles.fieldHint}>List the skills you use to deliver this service.</p>
                <div style={styles.tagInputWrapper}>
                  {form.skills.map(skill => (
                    <span key={skill} style={styles.skillTag}>
                      {skill}
                      <button type="button" style={styles.tagRemove} onClick={() => removeSkill(skill)}>×</button>
                    </span>
                  ))}
                  <input
                    style={styles.tagInput}
                    placeholder={form.skills.length < 10 ? 'Add a skill...' : 'Max skills reached'}
                    value={skillInput}
                    disabled={form.skills.length >= 10}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        addSkill()
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Preview Your Gig</h2>
              <p style={styles.stepDesc}>This is how your gig will appear to buyers</p>

              <div style={styles.preview}>
                {/* Preview Header Image */}
                <div style={styles.previewImageWrapper}>
                  {imagePreviews[0] ? (
                    <Image
                      src={imagePreviews[0]}
                      alt="Gig thumbnail"
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={styles.previewImagePlaceholder}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p style={{ color: '#9ca3af', margin: '8px 0 0', fontSize: '14px' }}>No image uploaded</p>
                    </div>
                  )}
                  <div style={styles.previewCategoryBadge}>
                    {form.category === 'online' ? '🌐 Online' : '📍 Offline'}
                  </div>
                </div>

                {/* Thumbnail Strip */}
                {imagePreviews.length > 1 && (
                  <div style={styles.thumbnailStrip}>
                    {imagePreviews.map((src, i) => (
                      <div key={i} style={styles.thumbnailItem}>
                        <Image src={src} alt="" fill style={{ objectFit: 'cover', borderRadius: '6px' }} />
                      </div>
                    ))}
                  </div>
                )}

                <div style={styles.previewBody}>
                  {selectedSubCategory && (
                    <p style={styles.previewCategory}>{selectedSubCategory}</p>
                  )}
                  <h3 style={styles.previewTitle}>{form.title || 'Your gig title will appear here'}</h3>

                  {form.category === 'offline' && form.location && (
                    <div style={styles.previewLocation}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {form.location}
                    </div>
                  )}

                  <p style={styles.previewDesc}>
                    {form.description || 'Your description will appear here...'}
                  </p>

                  {/* Tags */}
                  {form.tags.length > 0 && (
                    <div style={styles.previewTags}>
                      {form.tags.map(tag => (
                        <span key={tag} style={styles.previewTag}>#{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Packages Preview */}
                  <div style={styles.previewPackages}>
                    {(['basic', 'standard', 'premium'] as const).map(tier => {
                      const pkg = form.packages[tier]
                      const colors = { basic: '#3b82f6', standard: '#8b5cf6', premium: '#f59e0b' }
                      return (
                        <div key={tier} style={{ ...styles.previewPackage, borderColor: colors[tier] }}>
                          <div style={{ ...styles.previewPackageName, color: colors[tier] }}>{pkg.name}</div>
                          <div style={styles.previewPackagePrice}>
                            {pkg.price ? `€${pkg.price}` : '—'}
                          </div>
                          <div style={styles.previewPackageDelivery}>
                            🕐 {pkg.deliveryTime} · {pkg.revisions} revision{pkg.revisions === '1' ? '' : 's'}
                          </div>
                          {pkg.description && (
                            <p style={styles.previewPackageDesc}>{pkg.description}</p>
                          )}
                          {pkg.features.filter(f => f.trim()).length > 0 && (
                            <ul style={styles.previewFeatureList}>
                              {pkg.features.filter(f => f.trim()).map((feat, i) => (
                                <li key={i} style={styles.previewFeatureItem}>✓ {feat}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Skills */}
                  {form.skills.length > 0 && (
                    <div style={styles.previewSkillsSection}>
                      <p style={styles.previewSectionLabel}>Skills</p>
                      <div style={styles.previewTags}>
                        {form.skills.map(skill => (
                          <span key={skill} style={styles.previewSkillTag}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline error banner — shown when handlePublish() surfaces
                  an API or network failure. Form state is preserved, the
                  user can fix and retry without losing work. */}
              {errors.publish && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px 14px',
                    marginTop: 16,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    borderRadius: 10,
                    color: '#fca5a5',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: '#f87171', display: 'block', marginBottom: 2 }}>
                      Could not publish gig
                    </strong>
                    {errors.publish}
                  </div>
                </div>
              )}

              {/* Publish CTA */}
              <div style={styles.publishNote}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="16 12 12 8 8 12" />
                  <line x1="12" y1="16" x2="12" y2="8" />
                </svg>
                <p style={styles.publishNoteText}>
                  Your gig will go live immediately after publishing. You can edit it anytime from your seller dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={styles.footer}>
          <button
            style={{ ...styles.btn, ...styles.btnOutline }}
            onClick={prevStep}
            disabled={step === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div style={styles.stepIndicator}>
            Step {step} of {STEPS.length}
          </div>

          {step < 4 ? (
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={nextStep}>
              Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              style={{ ...styles.btn, ...styles.btnSuccess, ...(isSubmitting ? styles.btnDisabled : {}) }}
              onClick={handlePublish}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span style={styles.spinner} />
                  Publishing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Publish Gig
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px 16px 80px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  headerTitle: { flex: 1 },
  title: { margin: 0, fontSize: '24px', fontWeight: 700, color: '#111827' },
  subtitle: { margin: '4px 0 0', fontSize: '14px', color: '#6b7280' },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '28px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  stepWrapper: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  stepActive: {},
  stepDone: {},
  stepPending: {},
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid #d1d5db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: '#9ca3af',
    backgroundColor: '#fff',
    transition: 'all 0.2s',
  },
  stepCircleActive: {
    borderColor: '#6366f1',
    color: '#6366f1',
  },
  stepCircleDone: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
    color: '#fff',
  },
  stepLabel: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: 500,
    textAlign: 'center' as const,
  },
  stepConnector: {
    flex: 1,
    height: '2px',
    backgroundColor: '#e5e7eb',
    margin: '0 4px',
    marginBottom: '20px',
    transition: 'background-color 0.2s',
  },
  stepConnectorDone: {
    backgroundColor: '#10b981',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  stepContent: {
    padding: '32px',
  },
  stepTitle: {
    margin: '0 0 4px',
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
  },
  stepDesc: {
    margin: '0 0 28px',
    fontSize: '14px',
    color: '#6b7280',
  },
  field: {
    marginBottom: '24px',
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  },
  labelHint: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: 400,
  },
  fieldHint: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '0 0 10px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    color: '#111827',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    color: '#111827',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    lineHeight: '1.6',
  },
  inputIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '0 14px',
    backgroundColor: '#fff',
  },
  inputWithIcon: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    border: 'none',
    outline: 'none',
    color: '#111827',
    backgroundColor: 'transparent',
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '4px',
  },
  categoryToggle: {
    display: 'flex',
    gap: '12px',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    padding: '12px 16px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#fff',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  toggleBtnActive: {
    borderColor: '#6366f1',
    color: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  categoryGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  catChip: {
    padding: '6px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#fff',
    transition: 'all 0.15s',
  },
  catChipActive: {
    borderColor: '#6366f1',
    color: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  packagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  packageCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    overflow: 'hidden',
    borderTop: '4px solid',
  },
  packageHeader: {
    padding: '16px',
    textAlign: 'center' as const,
  },
  packageBadge: {
    display: 'inline-block',
    color: '#fff',
    fontWeight: 700,
    fontSize: '13px',
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  priceWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  currencySymbol: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
  },
  priceInput: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#111827',
    border: 'none',
    outline: 'none',
    width: '90px',
    textAlign: 'center' as const,
    backgroundColor: 'transparent',
  },
  packageBody: {
    padding: '16px',
  },
  packageField: {
    marginBottom: '14px',
  },
  packageLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  packageTextarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    color: '#111827',
    boxSizing: 'border-box' as const,
  },
  packageRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    color: '#111827',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  featureDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    flexShrink: 0,
  },
  featureInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    outline: 'none',
    color: '#111827',
  },
  featureRemoveBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  addFeatureBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: '1px dashed #d1d5db',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#6b7280',
    width: '100%',
    justifyContent: 'center',
    marginTop: '4px',
  },
  dropZone: {
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: '#fafafa',
  },
  dropZoneActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  dropZoneError: {
    borderColor: '#ef4444',
  },
  dropText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    margin: '12px 0 4px',
  },
  dropSubText: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginTop: '16px',
  },
  imagePreviewWrapper: {
    position: 'relative' as const,
    aspectRatio: '1',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  thumbnailBadge: {
    position: 'absolute' as const,
    bottom: '6px',
    left: '6px',
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '4px',
  },
  removeImageBtn: {
    position: 'absolute' as const,
    top: '6px',
    right: '6px',
    backgroundColor: 'rgba(0,0,0,0.55)',
    border: 'none',
    borderRadius: '50%',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  tagInputWrapper: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    padding: '8px 12px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    alignItems: 'center',
    minHeight: '44px',
    backgroundColor: '#fff',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#eef2ff',
    color: '#6366f1',
    fontSize: '13px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '20px',
  },
  skillTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    fontSize: '13px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '20px',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    color: 'inherit',
    opacity: 0.6,
    padding: 0,
  },
  tagInput: {
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: '#111827',
    minWidth: '120px',
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Preview styles
  preview: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  previewImageWrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '280px',
    backgroundColor: '#f3f4f6',
  },
  previewImagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCategoryBadge: {
    position: 'absolute' as const,
    top: '12px',
    left: '12px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '20px',
  },
  thumbnailStrip: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    backgroundColor: '#fafafa',
    overflowX: 'auto' as const,
  },
  thumbnailItem: {
    position: 'relative' as const,
    width: '56px',
    height: '56px',
    flexShrink: 0,
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  previewBody: {
    padding: '20px 24px 24px',
  },
  previewCategory: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6366f1',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 8px',
  },
  previewTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 10px',
    lineHeight: 1.4,
  },
  previewLocation: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  previewDesc: {
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.7',
    margin: '0 0 16px',
    whiteSpace: 'pre-wrap' as const,
  },
  previewTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginBottom: '20px',
  },
  previewTag: {
    backgroundColor: '#eef2ff',
    color: '#6366f1',
    fontSize: '12px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '20px',
  },
  previewSkillTag: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    fontSize: '12px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '20px',
  },
  previewPackages: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
    marginBottom: '20px',
  },
  previewPackage: {
    border: '1.5px solid',
    borderRadius: '12px',
    padding: '14px',
  },
  previewPackageName: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  previewPackagePrice: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '4px',
  },
  previewPackageDelivery: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '8px',
  },
  previewPackageDesc: {
    fontSize: '13px',
    color: '#4b5563',
    margin: '0 0 8px',
    lineHeight: 1.5,
  },
  previewFeatureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  previewFeatureItem: {
    fontSize: '12px',
    color: '#374151',
    padding: '2px 0',
  },
  previewSectionLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 8px',
  },
  previewSkillsSection: {
    marginTop: '4px',
  },
  publishNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '14px 18px',
    marginTop: '20px',
  },
  publishNoteText: {
    fontSize: '13px',
    color: '#166534',
    margin: 0,
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '16px 24px',
    boxShadow: '0 -1px 4px rgba(0,0,0,0.04)',
  },
  stepIndicator: {
    fontSize: '13px',
    color: '#9ca3af',
    fontWeight: 500,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    color: '#fff',
  },
  btnOutline: {
    backgroundColor: '#fff',
    color: '#374151',
    border: '1.5px solid #e5e7eb',
  },
  btnSuccess: {
    backgroundColor: '#10b981',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}