// Build — AI architecture design studio
// Shared types, section metadata, and design-spec parsing helpers.

export type RoofType = 'flat' | 'gable' | 'hip' | 'pyramid'
export type ElementType = 'wall' | 'window' | 'door' | 'column' | 'beam' | 'slab'

export interface DesignElement {
  type: ElementType
  position: { x: number; y: number; z: number }
  dimensions: { w: number; h: number; d: number }
  material: string
}

export interface MaterialPaletteEntry {
  material: string
  color_hex: string
}

export interface DesignSpec {
  name: string
  footprint: { width_m: number; depth_m: number }
  storeys: number
  storey_height_m: number
  roof: { type: RoofType; pitch_deg: number }
  elements: DesignElement[]
  materials_palette: MaterialPaletteEntry[]
}

/**
 * Strips ```json ... ``` (or bare ``` ... ```) fences and parses the
 * design spec. Returns null on any parse/shape failure — callers must
 * treat null as "could not render" rather than throwing, so a single
 * malformed AI turn never crashes the conversation.
 */
export function extractDesignSpec(raw: string): DesignSpec | null {
  if (!raw) return null

  // Prefer a fenced ```json block; fall back to the last {...} blob.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : (() => {
    const first = raw.indexOf('{')
    const last = raw.lastIndexOf('}')
    return first >= 0 && last > first ? raw.slice(first, last + 1) : null
  })()

  if (!candidate) return null

  try {
    const parsed = JSON.parse(candidate)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.footprint || typeof parsed.footprint.width_m !== 'number') return null
    return resolveOpeningOverlaps({
      name: typeof parsed.name === 'string' ? parsed.name : 'Untitled design',
      footprint: {
        width_m: Number(parsed.footprint?.width_m) || 4,
        depth_m: Number(parsed.footprint?.depth_m) || 4,
      },
      storeys: Number(parsed.storeys) || 1,
      storey_height_m: Number(parsed.storey_height_m) || 2.4,
      roof: {
        type: (['flat', 'gable', 'hip', 'pyramid'].includes(parsed.roof?.type) ? parsed.roof.type : 'flat') as RoofType,
        pitch_deg: Number(parsed.roof?.pitch_deg) || 0,
      },
      elements: Array.isArray(parsed.elements) ? parsed.elements
        .filter((e: unknown): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e: Record<string, unknown>) => {
          const pos = (e.position ?? {}) as Record<string, unknown>
          const dim = (e.dimensions ?? {}) as Record<string, unknown>
          return {
            type: (['wall', 'window', 'door', 'column', 'beam', 'slab'].includes(e.type as string) ? e.type : 'wall') as ElementType,
            position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0, z: Number(pos.z) || 0 },
            dimensions: { w: Number(dim.w) || 1, h: Number(dim.h) || 1, d: Number(dim.d) || 0.2 },
            material: typeof e.material === 'string' ? e.material : 'default',
          }
        }) : [],
      materials_palette: Array.isArray(parsed.materials_palette) ? parsed.materials_palette
        .filter((m: unknown): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m: Record<string, unknown>) => ({
          material: typeof m.material === 'string' ? m.material : 'default',
          color_hex: typeof m.color_hex === 'string' && /^#?[0-9a-fA-F]{6}$/.test(m.color_hex)
            ? (m.color_hex.startsWith('#') ? m.color_hex : `#${m.color_hex}`)
            : '#8a8a8a',
        })) : [],
    })
  } catch {
    return null
  }
}

/** Strips the fenced JSON block out of the raw reply so the chat only shows the conversational text. */
export function stripDesignSpecFence(raw: string): string {
  return raw.replace(/```(?:json)?\s*[\s\S]*?```/i, '').trim()
}

const MIN_OPENING_GAP_M = 0.3

/**
 * Defensive post-parse pass: nudges apart door/window elements that end
 * up overlapping each other on the same wall face, even though the
 * prompt (see `MAIN_SYSTEM_PROMPT` in `lib/build/prompts.ts`) explicitly
 * asks the model to leave a gap. This mirrors the existing defensive
 * philosophy of `extractDesignSpec` itself (never trust the model's
 * output to be perfectly self-consistent) — a prompt instruction alone
 * is advisory, not a guarantee, and future model drift or an especially
 * dense floor plan can still produce colliding openings.
 *
 * Openings are grouped onto a "wall face" using the same coordinate
 * convention as the prompt (origin at the front-left corner, x = width,
 * z = depth): an opening whose z is near 0 or near footprint.depth_m is
 * treated as sitting on a front/back wall (openings compared along x);
 * an opening whose x is near 0 or near footprint.width_m is treated as
 * sitting on a side wall (openings compared along z). Openings that
 * don't clearly sit on either exterior face (e.g. an internal partition
 * opening) are left untouched — collisions there are rarer and the
 * "which axis is the wall's run" ambiguity makes a confident nudge
 * unsafe.
 *
 * Only openings whose vertical (y) ranges also overlap are considered a
 * real collision — two windows stacked at different storey heights on
 * the same x/z line are not overlapping in 3D even if their horizontal
 * position matches.
 */
export function resolveOpeningOverlaps(spec: DesignSpec): DesignSpec {
  const EDGE_EPS = 0.5 // metres of tolerance for "is this on the edge wall"
  const openings = spec.elements
    .map((el, index) => ({ el, index }))
    .filter(({ el }) => el.type === 'window' || el.type === 'door')

  if (openings.length < 2) return spec

  const onFrontBack = (z: number) =>
    Math.abs(z) < EDGE_EPS || Math.abs(z - spec.footprint.depth_m) < EDGE_EPS
  const onSide = (x: number) =>
    Math.abs(x) < EDGE_EPS || Math.abs(x - spec.footprint.width_m) < EDGE_EPS

  type Face = 'front_back' | 'side'
  const faceKey = (el: DesignElement): { face: Face; anchor: number } | null => {
    if (onFrontBack(el.position.z)) return { face: 'front_back', anchor: Math.round(el.position.z * 10) / 10 }
    if (onSide(el.position.x)) return { face: 'side', anchor: Math.round(el.position.x * 10) / 10 }
    return null
  }

  const groups = new Map<string, { index: number; el: DesignElement }[]>()
  for (const { el, index } of openings) {
    const key = faceKey(el)
    if (!key) continue
    const groupKey = `${key.face}:${key.anchor}`
    const list = groups.get(groupKey) ?? []
    list.push({ index, el })
    groups.set(groupKey, list)
  }

  // Clone elements array once; mutate positions on the clone only.
  const nextElements = spec.elements.map(el => ({ ...el, position: { ...el.position }, dimensions: { ...el.dimensions } }))

  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue
    const face = faceKey(group[0].el)!.face
    const axisStart = (el: DesignElement) => (face === 'front_back' ? el.position.x : el.position.z)
    const axisSpan = (el: DesignElement) => (face === 'front_back' ? el.dimensions.w : el.dimensions.d || el.dimensions.w)
    const yOverlaps = (a: DesignElement, b: DesignElement) => {
      const aStart = a.position.y, aEnd = a.position.y + a.dimensions.h
      const bStart = b.position.y, bEnd = b.position.y + b.dimensions.h
      return aStart < bEnd && bStart < aEnd
    }

    const sorted = [...group].sort((a, b) => axisStart(a.el) - axisStart(b.el))
    for (let i = 1; i < sorted.length; i++) {
      const prevIdx = sorted[i - 1].index
      const curIdx = sorted[i].index
      const prevEl = nextElements[prevIdx]
      const curEl = nextElements[curIdx]
      if (!yOverlaps(prevEl, curEl)) continue

      const prevEnd = axisStart(prevEl) + axisSpan(prevEl)
      const curStart = axisStart(curEl)
      const gap = curStart - prevEnd
      if (gap < MIN_OPENING_GAP_M) {
        const shift = MIN_OPENING_GAP_M - gap
        if (face === 'front_back') {
          curEl.position.x = curEl.position.x + shift
        } else {
          curEl.position.z = curEl.position.z + shift
        }
      }
    }
  }

  return { ...spec, elements: nextElements }
}


export const CORE_SECTION_KEYS = ['brief', 'design', 'build_sequence'] as const
export type CoreSectionKey = typeof CORE_SECTION_KEYS[number]

export const ON_DEMAND_SECTION_KEYS = [
  'planning', 'engineering', 'costing', 'services',
  'finishes', 'timeline', 'sustainability', 'safety',
] as const
export type OnDemandSectionKey = typeof ON_DEMAND_SECTION_KEYS[number]

export type SectionKey = CoreSectionKey | OnDemandSectionKey

export const ON_DEMAND_SECTION_COST = 3
export const GENERATE_COST = 7
export const PDF_COST = 15

export interface SectionMeta {
  key: SectionKey
  order: number
  label: string
  icon: string
  core: boolean
  description: string
}

export const BUILD_SECTIONS: SectionMeta[] = [
  { key: 'brief', order: 1, label: 'Brief & Vision', icon: '📝', core: true, description: 'What you asked for, purpose, and constraints.' },
  { key: 'planning', order: 2, label: 'Planning & Regulations', icon: '📋', core: false, description: 'Planning permission, zoning, building regs, site/environmental considerations.' },
  { key: 'design', order: 3, label: 'Design', icon: '🏛️', core: true, description: 'The 3D model, floor plan, dimensions, materials palette.' },
  { key: 'engineering', order: 4, label: 'Engineering & Structure', icon: '🏗️', core: false, description: 'Loads, foundations, frame type, structural notes.' },
  { key: 'costing', order: 5, label: 'Costing & Materials', icon: '💶', core: false, description: 'Bill of materials, quantities, indicative cost ranges, suppliers.' },
  { key: 'build_sequence', order: 6, label: 'Build Sequence', icon: '🔨', core: true, description: 'Numbered construction phases from site prep to finishes.' },
  { key: 'services', order: 7, label: 'Services & Utilities', icon: '🔌', core: false, description: 'Electrical, plumbing, heating/ventilation, drainage, connections.' },
  { key: 'finishes', order: 8, label: 'Finishes & Interiors', icon: '🎨', core: false, description: 'Flooring, walls, fixtures, lighting, landscaping.' },
  { key: 'timeline', order: 9, label: 'Timeline & Project Management', icon: '🗓️', core: false, description: 'Phase durations, trade sequencing, inspection points.' },
  { key: 'sustainability', order: 10, label: 'Sustainability & Energy', icon: '🌱', core: false, description: 'Insulation, BER/energy rating, renewables, materials sourcing.' },
  { key: 'safety', order: 11, label: 'Safety & Compliance', icon: '🦺', core: false, description: 'Site safety, certifications, sign-offs before occupancy.' },
]

export const DISCLAIMER_TEXT =
  'Designs are conceptual only. They are not certified engineering drawings. Consult a qualified structural engineer and comply with local building regulations before any construction.'

export function sectionMeta(key: string): SectionMeta | undefined {
  return BUILD_SECTIONS.find(s => s.key === key)
}
