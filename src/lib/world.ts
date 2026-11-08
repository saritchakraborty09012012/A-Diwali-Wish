import { WORLD } from '../config'

export const GHAT = {
  steps: 12,
  stepDepth: 0.82,
  stepRise: 0.36,
  topY: 2.0,
  startZ: 0.4,
  width: 64,
} as const

export const stepTopY = (i: number) => GHAT.topY - i * GHAT.stepRise
export const stepZ = (i: number) => GHAT.startZ + i * GHAT.stepDepth
export const HERO = { x: 0, y: GHAT.topY + 0.03, z: GHAT.startZ + 0.1 }

export interface DiyaInstance {
  x: number
  y: number
  z: number
  scale: number
  phase: number
  ignite: number
  on: number
}

/** Deterministic PRNG so every replay is identical. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let cache: DiyaInstance[] | null = null

/**
 * Diyas scattered across the ghat steps, the terrace rim and the far landing.
 * `ignite` is a normalised distance from the hero diya so the master timeline
 * can light them in a wave.
 */
export function generateDiyas(count: number): DiyaInstance[] {
  if (!cache) {
    const rng = mulberry32(0x5eed)
    const list: DiyaInstance[] = []

    // hero
    list.push({
      x: HERO.x,
      y: HERO.y,
      z: HERO.z,
      scale: 1.05,
      phase: rng(),
      ignite: 0,
      on: 1,
    })

    // steps
    for (let row = 0; row < GHAT.steps; row++) {
      const y = stepTopY(row) + 0.02
      const z = stepZ(row) + 0.05
      const spacing = 2.3
      for (let x = -14; x <= 14; x += spacing) {
        if (rng() < 0.14) continue
        if (row === 0 && Math.abs(x) < 1.4) continue
        list.push({
          x: x + (rng() - 0.5) * 0.55,
          y,
          z: z + (rng() - 0.5) * 0.18,
          scale: 0.72 + rng() * 0.4,
          phase: rng(),
          ignite: 0,
          on: 1,
        })
      }
    }

    // terrace rim, keeping the rangoli circle clear
    for (let i = 0; i < 54; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const x = side * (6.2 + rng() * 9.5)
      const z = -2.5 - rng() * 15.5
      const dz = z - WORLD.rangoliZ
      if (Math.hypot(x, dz) < 5.6) continue
      list.push({
        x,
        y: WORLD.terraceY + 0.02,
        z,
        scale: 0.8 + rng() * 0.5,
        phase: rng(),
        ignite: 0,
        on: 1,
      })
    }

    // far landing behind the rangoli
    for (let i = 0; i < 26; i++) {
      list.push({
        x: (rng() - 0.5) * 30,
        y: WORLD.terraceY + 0.02,
        z: -18 - rng() * 5,
        scale: 0.8 + rng() * 0.4,
        phase: rng(),
        ignite: 0,
        on: 1,
      })
    }

    // normalise the ignition wave by distance from the hero — compressed
    // so smoothstep(iIgnite, iIgnite + 0.10, 1) always reaches 1: every
    // diya on the ghat lights fully, no stragglers
    let maxD = 0.0001
    for (const d of list) {
      const dist = Math.hypot(d.x - HERO.x, d.z - HERO.z)
      maxD = Math.max(maxD, dist)
    }
    for (const d of list) {
      const dist = Math.hypot(d.x - HERO.x, d.z - HERO.z)
      d.ignite = Math.min(1, (dist / maxD) * 0.60 + (d.phase - 0.5) * 0.04)
    }

    // hero first
    list.sort((a, b) => a.ignite - b.ignite)
    cache = list
  }

  return cache.slice(0, Math.max(24, count))
}

/** The lights the water shader fakes reflections for (nearest to the camera). */
export function reflectionLights(max: number): Array<[number, number, number]> {
  const all = generateDiyas(10000)
    .filter((d) => d.on > 0)
    .slice()
    .sort((a, b) => b.z - a.z)
    .slice(0, max)
  return all.map((d) => [d.x, d.y, d.z])
}
