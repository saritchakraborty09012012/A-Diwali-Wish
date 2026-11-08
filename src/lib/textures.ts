import * as THREE from 'three'

/** Shared, lazily-created canvas textures. Never generated per frame. */

let glow: THREE.Texture | null = null
let star: THREE.Texture | null = null
let smoke: THREE.Texture | null = null
let ray: THREE.Texture | null = null

function radial(
  size: number,
  stops: Array<[number, string]>,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  for (const [offset, color] of stops) g.addColorStop(offset, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function glowTexture(): THREE.Texture {
  if (!glow) {
    glow = radial(128, [
      [0, 'rgba(255,240,210,1)'],
      [0.18, 'rgba(255,196,110,0.85)'],
      [0.45, 'rgba(255,140,40,0.28)'],
      [1, 'rgba(255,120,20,0)'],
    ])
  }
  return glow
}

export function starTexture(): THREE.Texture {
  if (!star) {
    star = radial(64, [
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,245,220,0.7)'],
      [1, 'rgba(255,240,200,0)'],
    ])
  }
  return star
}

export function smokeTexture(): THREE.Texture {
  if (!smoke) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    for (let i = 0; i < 26; i++) {
      const x = size / 2 + (Math.random() - 0.5) * size * 0.55
      const y = size / 2 + (Math.random() - 0.5) * size * 0.55
      const r = size * (0.12 + Math.random() * 0.22)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.055)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    smoke = tex
  }
  return smoke
}

/** A soft, slanted shaft of light used for the fake god rays. */
export function rayTexture(): THREE.Texture {
  if (!ray) {
    const w = 128
    const h = 512
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,220,160,0.55)')
    g.addColorStop(0.45, 'rgba(255,190,110,0.18)')
    g.addColorStop(1, 'rgba(255,170,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // feather the sides
    const side = ctx.createLinearGradient(0, 0, w, 0)
    side.addColorStop(0, 'rgba(0,0,0,1)')
    side.addColorStop(0.5, 'rgba(0,0,0,0)')
    side.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = side
    ctx.fillRect(0, 0, w, h)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    ray = tex
  }
  return ray
}

export function disposeSharedTextures(): void {
  glow?.dispose()
  star?.dispose()
  smoke?.dispose()
  ray?.dispose()
  glow = null
  star = null
  smoke = null
  ray = null
}
