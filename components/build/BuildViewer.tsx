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

function colorFor(materialsPalette: DesignSpec['materials_palette'], material: string): number {
  const entry = materialsPalette.find(m => m.material === material)
  if (!entry) return FALLBACK_COLOR
  try {
    return parseInt(entry.color_hex.replace('#', ''), 16)
  } catch {
    return FALLBACK_COLOR
  }
}

/** Builds a THREE.Group procedurally from a parsed design spec. */
function buildModel(spec: DesignSpec): THREE.Group {
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
    group.add(box)

    const edges = new THREE.EdgesGeometry(boxGeo)
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.55 }))
    line.position.copy(box.position)
    group.add(line)
  }

  // Roof
  const roofColor = 0x38bdf8
  if (roof.type === 'flat') {
    const roofGeo = new THREE.BoxGeometry(footprint.width_m + 0.2, 0.15, footprint.depth_m + 0.2)
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }))
    roofMesh.position.set(footprint.width_m / 2, totalHeight + 0.075, footprint.depth_m / 2)
    group.add(roofMesh)
  } else {
    // gable / hip / pyramid — approximate with a cone/prism
    const pitchRad = ((roof.pitch_deg || 25) * Math.PI) / 180
    const ridgeHeight = Math.max(0.4, (footprint.width_m / 2) * Math.tan(pitchRad))
    const radial = roof.type === 'pyramid' ? 4 : 4
    const roofGeo = new THREE.ConeGeometry(
      Math.max(footprint.width_m, footprint.depth_m) / 1.6,
      ridgeHeight,
      radial
    )
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 }))
    roofMesh.rotation.y = Math.PI / 4
    roofMesh.position.set(footprint.width_m / 2, totalHeight + ridgeHeight / 2, footprint.depth_m / 2)
    group.add(roofMesh)
  }

  // Elements
  for (const el of elements) {
    const color = colorFor(materials_palette, el.material)
    let geo: THREE.BufferGeometry
    let mat: THREE.Material

    switch (el.type) {
      case 'window':
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, Math.max(el.dimensions.d, 0.05))
        mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.1 })
        break
      case 'door':
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, Math.max(el.dimensions.d, 0.08))
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
        break
      case 'column':
      case 'beam':
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, el.dimensions.d)
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 })
        break
      case 'slab':
        geo = new THREE.BoxGeometry(el.dimensions.w, Math.max(el.dimensions.h, 0.1), el.dimensions.d)
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
        break
      default: // wall
        geo = new THREE.BoxGeometry(el.dimensions.w, el.dimensions.h, Math.max(el.dimensions.d, 0.15))
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    }

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      el.position.x + el.dimensions.w / 2,
      el.position.y + el.dimensions.h / 2,
      el.position.z + (el.dimensions.d || 0.15) / 2
    )
    group.add(mesh)
  }

  // Ground grid
  const grid = new THREE.GridHelper(Math.max(footprint.width_m, footprint.depth_m) * 3, 20, 0x1c3548, 0x152a38)
  group.add(grid)

  // Recentre the whole group so orbit target sits at the building's centre.
  const center = new THREE.Vector3(footprint.width_m / 2, totalHeight / 2, footprint.depth_m / 2)
  group.position.sub(center)

  return group
}

function buildPlaceholder(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(4, 2.4, 4)
  const mat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.25, wireframe: false })
  const box = new THREE.Mesh(geo, mat)
  group.add(box)
  const edges = new THREE.EdgesGeometry(geo)
  group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2dd4bf })))
  const grid = new THREE.GridHelper(12, 12, 0x1c3548, 0x152a38)
  group.add(grid)
  group.position.set(0, -1.2, 0)
  return group
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
  } | null>(null)

  // One-time scene setup.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a1420)

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 500)
    camera.position.set(8, 6, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2
    controls.maxDistance = 60
    controls.target.set(0, 0, 0)
    // Mobile-friendly: one-finger rotate, two-finger pinch to zoom (defaults),
    // and disable page scroll hijack while interacting with the canvas.
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(6, 10, 4)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.25)
    fillLight.position.set(-6, 4, -4)
    scene.add(fillLight)

    const state = { renderer, scene, camera, controls, modelGroup: null as THREE.Group | null, frameId: 0 }
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
          mats.forEach(m => m?.dispose())
        }
      })
    }

    let group: THREE.Group
    try {
      group = designSpec ? buildModel(designSpec) : buildPlaceholder()
    } catch (err) {
      console.error('[BuildViewer] model build failed', err)
      group = buildPlaceholder()
    }

    state.scene.add(group)
    state.modelGroup = group

    // Frame the camera to the model's bounding box.
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 3)
    const dist = maxDim * 1.6
    state.camera.position.set(dist * 0.8, dist * 0.65, dist * 0.8)
    state.controls.target.set(0, size.y * 0.15, 0)
    state.controls.update()
  }, [designSpec])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      <div
        style={{
          position: 'absolute', top: 10, left: 12, fontSize: 10.5, color: '#8ca7b5',
          background: 'rgba(0,0,0,0.35)', padding: '4px 9px', borderRadius: 999,
          border: '1px solid #1c3548', pointerEvents: 'none',
        }}
      >
        ↔ drag to rotate · pinch/scroll to zoom
      </div>
      {designSpec && (
        <div
          style={{
            position: 'absolute', top: 10, right: 12, fontSize: 11, fontWeight: 600, color: '#2dd4bf',
            background: 'rgba(0,0,0,0.35)', padding: '4px 11px', borderRadius: 999,
            border: '1px solid #1c3548', pointerEvents: 'none', maxWidth: '55%',
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
