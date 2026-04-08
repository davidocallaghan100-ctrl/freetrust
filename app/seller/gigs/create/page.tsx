
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
  'Web Development',
  'Mobile Apps',
  'UI/UX Design',
  'Graphic Design',
  'Writing & Translation',
  'Video & Animation',
  'Digital Marketing',
  'Data & AI',
  'Cybersecurity',
  'IT Support',
]

const OFFLINE_CATEGORIES = [
  'Home Repair',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Tutoring',
  'Photography',
  'Event Planning',
  'Personal Training',
  'Catering',
  'Moving & Delivery',
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
    setIsSubmitting(true)
    await new Promise(r => setTimeout(r, 1500))
    setIsSubmitting(false)
    router.push('/seller/gigs?published=true')
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
                <div style={styles.field}>
                  <label style={styles.label}>Service Location</label>
                  <div style={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <input
                      style={{ ...styles.inputWithIcon, ...(errors.location ? styles.inputError : {}) }}
                      placeholder="City, State or specific area you serve"
                      value={form.location}
                      onChange={e => updateForm('location', e.target.value)}
                    />
                  </div>
                  {errors.location && <p style={styles.error}>{errors.location}</p>}
                </div>
              )}
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
                          <span style={styles.currencySymbol}>$</span>
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
                  {form.tags.length