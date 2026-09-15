'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { DesignSpec } from '@/lib/build/spec'

interface BuildViewerProps {
  designSpec: DesignSpec | null
  renderError?: boolean
}

const FALLBACK_COLOR = 0x8a8a8a
const FRAME_COLOR = 0x2a2f36 // dark anthracite trim, used for window/door frame details

function colorFor(materialsPalette: DesignSpec['materials_palette'], material: string): number {
  const entry = materialsPalette.find(m => m.material === material)
  if (!entry) return FALLBACK_COLOR
  try {
    return parseInt(entry.color_hex.replace('#', ''), 16)
  } catch {
    return FALLBACK_COLOR
  }
}

// --- Procedural texture cache -------------------------------------------
// Realistic-mode materials use a subtle generated canvas texture instead
// of a flat colour, so walls/roofs read as an actual surface (render,
// cladding-plank, or tile-ish grain) rather than a synthetic plastic
// block. Textures are generated ONCE per colour and cached (module-level
// Map, never cleared) — this is a mobile web app, so per-frame or
// per-mesh texture generation would be wasteful; every wall/roof of the
// same material colour reuses the same cached THREE.CanvasTexture.
const wallTextureCache = new Map<number, THREE.CanvasTexture>()
const roofTextureCache = new Map<number, THREE.CanvasTexture>()

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}
function shade([r, g, b]: [number, number, number], amt: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `rgb(${clamp(r + amt)}, ${clamp(g + amt)}, ${clamp(b + amt)})`
}

/** Subtle vertical-plank/render grain — reads as cladding/render at a distance, not a flat block. */
function wallTextureFor(color: number): THREE.CanvasTexture {
  const cached = wallTextureCache.get(color)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(color)
  ctx.fillStyle = shade(rgb, 0)
  ctx.fillRect(0, 0, 128, 128)
  // Vertical plank/joint lines
  ctx.strokeStyle = shade(rgb, -18)
  ctx.lineWidth = 1
  for (let x = 0; x <= 128; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 128)
    ctx.stroke()
  }
  // Faint horizontal grain for texture variation
  ctx.strokeStyle = shade(rgb, 10)
  for (let y = 6; y < 128; y += 22) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  wallTextureCache.set(color, tex)
  return tex
}

/** Subtle tile/tone variation for roof planes. */
function roofTextureFor(color: number): THREE.CanvasTexture {
  const cached = roofTextureCache.get(color)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(color)
  ctx.fillStyle = shade(rgb, 0)
  ctx.fillRect(0, 0, 96, 96)
  ctx.strokeStyle = shade(rgb, -22)
  ctx.lineWidth = 1
  for (let y = 0; y <= 96; y += 10) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(96, y)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  roofTextureCache.set(color, tex)
  return tex
}

function repeatFor(tex: THREE.CanvasTexture, w: number, h: number, scale = 1) {
  tex.repeat.set(Math.max(1, Math.round(w / scale)), Math.max(1, Math.round(h / scale)))
}

const OPENING_MIN_DEPTH = 0.3 // metres — always at least this deep, regardless of the AI's own (often much thinner) `d` value
const OPENING_PROTRUSION = 0.12 // metres — how far the opening pokes out past the wall's own anchor coordinate on the exterior-facing side

/**
 * Computes the world-space centre of a window/door opening along its
 * thickness axis (the axis perpendicular to the wall it sits on), so the
 * opening mesh actually protrudes past the wall face rather than being
 * embedded entirely inside it.
 *
 * The design_spec schema places windows/doors using the SAME
 * position+dimensions shape as walls, with a small `dimensions.d`
 * (e.g. 0.1m) meant to represent "this is a thin opening", but doesn't
 * link an opening to the specific wall element it belongs to or that
 * wall's actual thickness (commonly 0.15–0.3m in generated specs). The
 * naive centering used for every other element type — `position + d/2`
 * — places the opening's small 0.1m-thick box entirely INSIDE a wall
 * box that's already 0.15–0.3m thick and centred on roughly the same
 * point: the opening ends up fully occluded, invisible from any camera
 * angle no matter how it's textured or framed (found while investigating
 * why window/door detail added to the Realistic view never appeared —
 * see `.memory/capabilities/freetrust-build-studio.md`).
 *
 * Fix: anchor to the FOOTPRINT'S OWN edge (0 or the footprint's
 * width_m/depth_m) rather than the opening's own `position`, since real
 * generated specs consistently place a wall's near face at `position`
 * and its far face at `position + wallDepth` — for a wall on the FAR
 * side of the footprint (e.g. the back wall), that far face lands
 * exactly on the footprint edge, but `position` itself sits
 * `wallDepth` short of it (an unknown, per-wall amount we don't track).
 * Anchoring to the footprint edge instead sidesteps needing to know each
 * individual wall's thickness at all. The opening protrudes
 * `OPENING_PROTRUSION` metres past that edge (guaranteed visible from
 * outside) and extends the rest of its depth inward, so it still reads
 * as "set into" the wall rather than floating free of it.
 */
function openingCenterAlongAxis(dimD: number, footprintExtent: number, nearMinEdge: boolean): number {
  const depth = Math.max(dimD, OPENING_MIN_DEPTH)
  return nearMinEdge
    ? -OPENING_PROTRUSION + depth / 2
    : (footprintExtent + OPENING_PROTRUSION) - depth / 2
}

/** A window: outer frame (trim colour) + inset semi-transparent glass pane, instead of one flat tinted box. */
function buildWindowMesh(dims: { w: number; h: number; d: number }, glassColor: number): THREE.Group {
  const group = new THREE.Group()
  const depth = Math.max(dims.d, OPENING_MIN_DEPTH)
  const frameThickness = Math.min(0.06, dims.w * 0.12, dims.h * 0.12)

  const frameGeo = new THREE.BoxGeometry(dims.w, dims.h, depth)
  const frameMat = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.5, metalness: 0.3 })
  const frame = new THREE.Mesh(frameGeo, frameMat)
  frame.castShadow = true
  frame.receiveShadow = true
  group.add(frame)

  const glassW = Math.max(dims.w - frameThickness * 2, 0.1)
  const glassH = Math.max(dims.h - frameThickness * 2, 0.1)
  const glassGeo = new THREE.BoxGeometry(glassW, glassH, Math.max(depth * 0.5, 0.03))
  const glassMat = new THREE.MeshStandardMaterial({
    color: glassColor, transparent: true, opacity: 0.5, metalness: 0.1, roughness: 0.05,
  })
  const glass = new THREE.Mesh(glassGeo, glassMat)
  group.add(glass)

  return group
}

/** A door: subtle panel grooves + a small handle detail, instead of one flat box. */
function buildDoorMesh(dims: { w: number; h: number; d: number }, doorColor: number): THREE.Group {
  const group = new THREE.Group()
  const depth = Math.max(dims.d, OPENING_MIN_DEPTH)

  const doorGeo = new THREE.BoxGeometry(dims.w, dims.h, depth)
  const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.65 })
  const door = new THREE.Mesh(doorGeo, doorMat)
  door.castShadow = true
  door.receiveShadow = true
  group.add(door)

  // Two recessed panel grooves (thin dark inset lines), a common real door detail.
  const grooveColor = 0x000000
  const grooveMat = new THREE.MeshStandardMaterial({ color: grooveColor, transparent: true, opacity: 0.3, roughness: 0.9 })
  const grooveDepth = Math.max(depth * 0.15, 0.01)
  for (const frac of [0.32, 0.68]) {
    const grooveGeo = new THREE.BoxGeometry(dims.w * 0.72, dims.h * 0.34, grooveDepth)
    const groove = new THREE.Mesh(grooveGeo, grooveMat)
    groove.position.set(0, (frac - 0.5) * dims.h, depth / 2 - grooveDepth / 2 + 0.005)
    group.add(groove)
  }

  // Handle: a small sphere near the leading edge, mid-height.
  const handleGeo = new THREE.SphereGeometry(Math.min(0.045, dims.w * 0.08), 10, 10)
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.8, roughness: 0.25 })
  const handle = new THREE.Mesh(handleGeo, handleMat)
  handle.position.set(dims.w * 0.36, -dims.h * 0.1, depth / 2 + 0.03)
  group.add(handle)

  return group
}


/**
 * Builds a THREE.Group procedurally from a parsed design spec.
 * Returns the full group (content + ground grid) alongside `contentSize` —
 * the ANALYTIC size of the building content (footprint width/depth +
 * total wall height + roof ridge height), computed directly from the
 * spec's own numbers rather than from a Box3 of the rendered meshes.
 *
 * This is deliberate: `Box3.setFromObject()` measures whatever shape the
 * geometry happens to be, including incidental rendering-only artifacts.
 * The gable/hip/pyramid roof is approximated with a 4-sided
 * `THREE.ConeGeometry`, whose vertices are already placed on an
 * axis-aligned square footprint. The extra `rotation.y = Math.PI / 4`
 * applied below (purely to visually orient the roof) turns that
 * axis-aligned square into a diamond, which INFLATES its own
 * axis-aligned bounding box by a factor of √2 — e.g. for a 120m-wide
 * footprint this alone added ~90m of pure rendering-rotation artifact to
 * the measured size. Framing the camera off that Box3 made the entire
 * model (walls, windows, everything) render far smaller in-frame than
 * intended — the whole building could look like a tiny flat tile lost
 * in the grid for large designs, even though the underlying design_spec
 * itself was completely correct (see `.memory/capabilities/
 * freetrust-build-studio.md` for the campus-massing investigation that
 * found this). Camera framing must use this analytic `contentSize`,
 * never a Box3 derived from rendered geometry, and never a Box3 of the
 * full group either — the ground grid is sized `maxFootprintDim * 3` and
 * would separately dominate the bounding box for the same reason.
 */
function buildModel(spec: DesignSpec): { group: THREE.Group; contentSize: THREE.Vector3 } {
  const group = new THREE.Group()
  const { footprint, storeys, storey_height_m, roof, elements, materials_palette } = spec

  const totalHeight = storeys * storey_height_m

  // Base slab per storey (subtle) + a simple extruded footprint per storey
  // so there is always a coherent volume even if `elements` is sparse.
  for (let s = 0; s < storeys; s++) {
    const boxGeo = new THREE.BoxGeometry(footprint.width_m, storey_height_m * 0.98, footprint.depth_m)
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a52,
      transparent: true,
      opacity: 0.16,
      roughness: 0.8,
    })
    const box = new THREE.Mesh(boxGeo, boxMat)
    box.position.set(footprint.width_m / 2, s * storey_height_m + storey_height_m / 2, footprint.depth_m / 2)
    box.receiveShadow = true
    group.add(box)

    const edges = new THREE.EdgesGeometry(boxGeo)
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.55 }))
    line.position.copy(box.position)
    group.add(line)
  }

  // Roof
  const roofColor = 0x38bdf8
  let roofHeight = 0.15 // flat roof thickness
  const roofTex = roofTextureFor(roofColor)
  if (roof.type === 'flat') {
    const roofGeo = new THREE.BoxGeometry(footprint.width_m + 0.2, 0.15, footprint.depth_m + 0.2)
    const roofTexInst = roofTex.clone()
    repeatFor(roofTexInst, footprint.width_m, footprint.depth_m, 3)
    roofTexInst.needsUpdate = true
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, map: roofTexInst, roughness: 0.6 }))
    roofMesh.position.set(footprint.width_m / 2, totalHeight + 0.075, footprint.depth_m / 2)
    roofMesh.castShadow = true
    roofMesh.receiveShadow = true
    group.add(roofMesh)
  } else {
    // gable / hip / pyramid — approximate with a cone/prism
    const pitchRad = ((roof.pitch_deg || 25) * Math.PI) / 180
    const ridgeHeight = Math.max(0.4, (footprint.width_m / 2) * Math.tan(pitchRad))
    roofHeight = ridgeHeight
    const radial = roof.type === 'pyramid' ? 4 : 4
    const roofGeo = new THREE.ConeGeometry(
      Math.max(footprint.width_m, footprint.depth_m) / 1.6,
      ridgeHeight,
      radial
    )
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }))
    // NOTE: this 45° rotation is purely a visual choice (orients the
    // 4-sided cone's flat faces to look like a pitched roof rather than a
    // diamond from above) — it does NOT feed into contentSize below,
    // which is computed analytically from footprint/height instead of a
    // Box3 of this (rotation-inflated) geometry. See buildModel's doc
    // comment for why.
    roofMesh.rotation.y = Math.PI / 4
    roofMesh.position.set(footprint.width_m / 2, totalHeight + ridgeHeight / 2, footprint.depth_m / 2)
    roofMesh.castShadow = true
    roofMesh.receiveShadow = true
    group.add(roofMesh)
  }

  // Elements
  for (const el of elements) {
    const color = colorFor(materials_palette, el.material)

    if (el.type === 'window' || el.type === 'door') {
      // Determine which axis is this opening's thickness axis (the axis
      // perpendicular to the wall it sits on) by checking which
      // coordinate sits near a footprint edge — see openingCenterAlongAxis's
      // doc comment for why naive `position + d/2` centering buries
      // openings inside the wall mesh instead of showing them.
      const nearZMinEdge = el.position.z < footprint.depth_m / 2
      const nearZEdge = el.position.z < 1 || el.position.z > footprint.depth_m - 1
      const nearXMinEdge = el.position.x < footprint.width_m / 2
      const nearXEdge = el.position.x < 1 || el.position.x > footprint.width_m - 1
      const onZAxisWall = nearZEdge || !nearXEdge // default to z-axis wall (front/back) when ambiguous — matches every observed generated spec so far
      const centerPos = new THREE.Vector3(
        onZAxisWall ? el.position.x + el.dimensions.w / 2 : openingCenterAlongAxis(el.dimensions.d, footprint.width_m, nearXMinEdge),
        el.position.y + el.dimensions.h / 2,
        onZAxisWall ? openingCenterAlongAxis(el.dimensions.d, footprint.depth_m, nearZMinEdge) : el.position.z + el.dimensions.w / 2
      )
      const built = el.type === 'window' ? buildWindowMesh(el.dimensions, color) : buildDoorMesh(el.dimensions, color)
      built.position.copy(centerPos)
      group.add(built)
      continue
    }

    const centerPos = new THREE.Vector3(
      el.position.x + el.dimensions.w / 2,
      el.position.y + el.dimensions.h / 2,
      el.position.z + (el.dimensions.d || 0.15) / 2
    )

    let geo: THREE.BufferGeometry
    let mat: THREE.Material
    let castsShadow = true

    switch (el.type) {
      case 'column':
      case 'beam':
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, el.dimensions.d)
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 })
        break
      case 'slab': {
        geo = new THREE.BoxGeometry(el.dimensions.w, Math.max(el.dimensions.h, 0.1), el.dimensions.d)
        const slabTex = wallTextureFor(color).clone()
        repeatFor(slabTex, el.dimensions.w, el.dimensions.d, 1.5)
        slabTex.needsUpdate = true
        mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: slabTex, roughness: 0.9 })
        castsShadow = false
        break
      }
      default: { // wall
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, Math.max(el.dimensions.d, 0.15))
        const tex = wallTextureFor(color).clone()
        repeatFor(tex, el.dimensions.w, el.dimensions.h, 1.5)
        tex.needsUpdate = true
        mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.8 })
      }
    }

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(centerPos)
    mesh.castShadow = castsShadow
    mesh.receiveShadow = true
    group.add(mesh)
  }

  // Analytic content size — see buildModel's doc comment for why this is
  // NOT derived from a Box3 of the rendered geometry. Elements
  // (walls/windows/doors/etc.) are always placed within the footprint's
  // bounds per the prompt contract, so footprint width/depth + total
  // wall height + roof height fully captures the real content extent.
  const contentSize = new THREE.Vector3(footprint.width_m, totalHeight + roofHeight, footprint.depth_m)

  // Ground grid
  const grid = new THREE.GridHelper(Math.max(footprint.width_m, footprint.depth_m) * 3, 20, 0x1c3548, 0x152a38)
  group.add(grid)

  // Recentre the whole group so orbit target sits at the building's centre.
  const center = new THREE.Vector3(footprint.width_m / 2, totalHeight / 2, footprint.depth_m / 2)
  group.position.sub(center)

  return { group, contentSize }
}

function buildPlaceholder(): { group: THREE.Group; contentSize: THREE.Vector3 } {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(4, 2.4, 4)
  const mat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.25, wireframe: false })
  const box = new THREE.Mesh(geo, mat)
  group.add(box)
  const edges = new THREE.EdgesGeometry(geo)
  group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2dd4bf })))
  const contentSize = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
  const grid = new THREE.GridHelper(12, 12, 0x1c3548, 0x152a38)
  group.add(grid)
  group.position.set(0, -1.2, 0)
  return { group, contentSize }
}

export default function BuildViewer({ designSpec, renderError }: BuildViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    modelGroup: THREE.Group | null
    frameId: number
    dirLight: THREE.DirectionalLight
  } | null>(null)

  // One-time scene setup.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a1420)

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 5000)
    camera.position.set(8, 6, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    // Soft shadows are one of the highest-impact cheap wins for perceived
    // realism in a low-poly procedural scene like this. Shadow map size
    // is kept modest (1024) — this renders on mobile web, and the shadow
    // camera frustum is re-sized per design (see the design-spec effect
    // below) rather than left at Three.js's small default, which would
    // otherwise clip shadows for anything larger than a tiny box.
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2
    // Generous ceiling so campus-scale designs (contentSize up to
    // hundreds of metres) can be framed and manually zoomed out further
    // if desired — OrbitControls.update() clamps camera distance to this
    // range every frame, so a low ceiling here would silently undo any
    // large initial framing distance set below, regardless of the grid
    // fix. Kept comfortably inside the camera's far clip plane (5000).
    controls.maxDistance = 3000
    controls.target.set(0, 0, 0)
    // Mobile-friendly: one-finger rotate, two-finger pinch to zoom (defaults),
    // and disable page scroll hijack while interacting with the canvas.
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(6, 10, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    scene.add(dirLight)
    scene.add(dirLight.target)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.25)
    fillLight.position.set(-6, 4, -4)
    scene.add(fillLight)

    const state = { renderer, scene, camera, controls, modelGroup: null as THREE.Group | null, frameId: 0, dirLight }
    stateRef.current = state

    function animate() {
      controls.update()
      renderer.render(scene, camera)
      state.frameId = requestAnimationFrame(animate)
    }
    animate()

    function handleResize() {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', handleResize)
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(mount)

    return () => {
      cancelAnimationFrame(state.frameId)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Rebuild the model whenever the design spec changes.
  useEffect(() => {
    const state = stateRef.current
    if (!state) return

    if (state.modelGroup) {
      state.scene.remove(state.modelGroup)
      state.modelGroup.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose()
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach(m => {
            if (!m) return
            // Dispose per-mesh cloned texture maps (wall/roof/slab
            // materials clone from the cached base texture so repeat
            // scaling can differ per element) — the cached base textures
            // in wallTextureCache/roofTextureCache are intentionally
            // NOT disposed here; they're reused across every rebuild.
            const withMap = m as THREE.MeshStandardMaterial
            if (withMap.map) withMap.map.dispose()
            m.dispose()
          })
        }
      })
    }

    let group: THREE.Group
    let contentSize: THREE.Vector3
    try {
      const built = designSpec ? buildModel(designSpec) : buildPlaceholder()
      group = built.group
      contentSize = built.contentSize
    } catch (err) {
      console.error('[BuildViewer] model build failed', err)
      const built = buildPlaceholder()
      group = built.group
      contentSize = built.contentSize
    }

    state.scene.add(group)
    state.modelGroup = group

    // Frame the camera to the CONTENT bounding box only (never the full
    // group, which also includes the ground grid — see buildModel's
    // doc comment). This is what actually fixes the "zoomed-in/broken"
    // framing for large campus-scale designs.
    const maxDim = Math.max(contentSize.x, contentSize.y, contentSize.z, 3)
    const dist = maxDim * 1.6
    state.camera.position.set(dist * 0.8, dist * 0.65, dist * 0.8)
    state.controls.target.set(0, contentSize.y * 0.15, 0)
    state.controls.update()

    // Re-scale the shadow-casting light's frustum and position to the
    // current design's own scale — Three.js's default shadow camera
    // frustum is small (fine for the 4x2.4x4 placeholder) but would clip
    // shadows entirely for a 120m-wide campus, and an oversized frustum
    // would waste shadow-map resolution on a tiny garden studio. Kept
    // proportional to `maxDim` so this scales sanely at both extremes
    // without any extra per-frame cost (set once per design change, not
    // per animation frame).
    const shadowCam = state.dirLight.shadow.camera as THREE.OrthographicCamera
    const shadowExtent = maxDim * 1.3
    shadowCam.left = -shadowExtent
    shadowCam.right = shadowExtent
    shadowCam.top = shadowExtent
    shadowCam.bottom = -shadowExtent
    shadowCam.near = 0.5
    shadowCam.far = maxDim * 6
    shadowCam.updateProjectionMatrix()
    state.dirLight.position.set(maxDim * 0.5, maxDim * 0.9, maxDim * 0.35)
    state.dirLight.target.position.set(0, contentSize.y * 0.15, 0)
    state.dirLight.target.updateMatrixWorld()
  }, [designSpec])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      <div
        style={{
          position: 'absolute', top: 10, left: 12, fontSize: 10.5, color: '#8ca7b5',
          background: 'rgba(0,0,0,0.35)', padding: '4px 9px', borderRadius: 999,
          border: '1px solid #1c3548', pointerEvents: 'none', maxWidth: '42%', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        ↔ drag to rotate · pinch/scroll to zoom
      </div>
      {designSpec && (
        <div
          style={{
            position: 'absolute', top: 10, right: 12, fontSize: 11, fontWeight: 600, color: '#2dd4bf',
            background: 'rgba(0,0,0,0.35)', padding: '4px 11px', borderRadius: 999,
            border: '1px solid #1c3548', pointerEvents: 'none', maxWidth: '42%', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {designSpec.name}
        </div>
      )}
      {renderError && (
        <div
          style={{
            position: 'absolute', bottom: 10, left: 12, right: 12, fontSize: 11.5, color: '#f59e0b',
            background: 'rgba(0,0,0,0.5)', padding: '6px 10px', borderRadius: 8,
            border: '1px solid rgba(245,158,11,0.4)', textAlign: 'center',
          }}
        >
          Design could not be rendered — try rephrasing.
        </div>
      )}
    </div>
  )
}
