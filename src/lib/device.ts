/**
 * Lightweight device / GPU probing. No extra dependencies, no network calls.
 * Everything is resolved once at module load.
 */

export type QualityTier = 'low' | 'mid' | 'high'

function probeRenderer(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return 'none'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : ''
    const lose = gl.getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return renderer.toLowerCase()
  } catch {
    return 'unknown'
  }
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const cores =
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
const memory =
  typeof navigator !== 'undefined'
    ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4
    : 4
const coarse =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && coarse)
export const IS_MOBILE =
  /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) ||
  (coarse && typeof window !== 'undefined' && window.innerWidth < 900)

const renderer = typeof document !== 'undefined' ? probeRenderer() : 'none'
const softwareGPU =
  renderer.includes('swiftshader') ||
  renderer.includes('llvmpipe') ||
  renderer.includes('basic render') ||
  renderer === 'none'

let tier: QualityTier = 'high'
if (softwareGPU) tier = 'low'
else if (IS_MOBILE) tier = cores >= 8 && memory >= 4 ? 'mid' : 'low'
else if (cores <= 4 || memory <= 4) tier = 'mid'

export const DEVICE = {
  isMobile: IS_MOBILE,
  isIOS: IS_IOS,
  cores,
  memory,
  tier,
  renderer,
  reducedMotion:
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
} as const

export interface QualitySettings {
  dprCap: number
  diyas: number
  buildings: number
  lanterns: number
  dust: number
  embers: number
  fireworks: number
  textParticles: number
  waterLights: number
  post: boolean
  dof: boolean
  bloom: boolean
  godRays: boolean
  shake: boolean
}

const PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    dprCap: 2.5,
    diyas: 190,
    buildings: 560,
    lanterns: 330,
    dust: 2400,
    embers: 700,
    fireworks: 13000,
    textParticles: 9500,
    waterLights: 26,
    post: true,
    dof: true,
    bloom: true,
    godRays: true,
    shake: true,
  },
  mid: {
    dprCap: 2.0,
    diyas: 130,
    buildings: 380,
    lanterns: 190,
    dust: 1300,
    embers: 380,
    fireworks: 6500,
    textParticles: 5600,
    waterLights: 16,
    post: true,
    dof: false,
    bloom: true,
    godRays: true,
    shake: true,
  },
  low: {
    dprCap: 1.6,
    diyas: 84,
    buildings: 230,
    lanterns: 100,
    dust: 650,
    embers: 200,
    fireworks: 3400,
    textParticles: 3400,
    waterLights: 10,
    post: true,
    dof: false,
    bloom: true,
    godRays: false,
    shake: false,
  },
}

export const QUALITY: QualitySettings = DEVICE.reducedMotion
  ? {
      ...PRESETS[tier],
      dof: false,
      shake: false,
      godRays: false,
      dust: Math.round(PRESETS[tier].dust * 0.5),
      fireworks: Math.round(PRESETS[tier].fireworks * 0.5),
    }
  : PRESETS[tier]

/* ------------------------------------------------------------------ */
/* Gyroscope                                                          */
/* ------------------------------------------------------------------ */

type OrientationEventCtor = {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export async function requestGyroPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const ctor = (window as unknown as { DeviceOrientationEvent?: OrientationEventCtor })
    .DeviceOrientationEvent
  if (!ctor) return false
  if (typeof ctor.requestPermission === 'function') {
    try {
      return (await ctor.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }
  return true
}

export function watchGyro(
  onTilt: (x: number, y: number) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  let base: number | null = null
  const handler = (e: DeviceOrientationEvent) => {
    const gamma = e.gamma ?? 0 // left/right, -90..90
    const beta = e.beta ?? 0 // front/back, -180..180
    if (base === null) base = beta
    const x = Math.max(-1, Math.min(1, gamma / 35))
    const y = Math.max(-1, Math.min(1, (beta - base) / 35))
    onTilt(x, y)
  }
  window.addEventListener('deviceorientation', handler, true)
  return () => window.removeEventListener('deviceorientation', handler, true)
}

export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0)
  )
}
