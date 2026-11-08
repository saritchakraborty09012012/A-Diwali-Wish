import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'
import { fx } from '../lib/fx'

/* ------------------------------------------------------------------ */
/* Fireworks — modelled on real display shells (research summary):     */
/*  · peony        round ball of stars, no tails                       */
/*  · chrysanthemum round ball, every star leaves a trailing tail      */
/*  · willow/kamuro heavy gold stars that droop in long strands        */
/*  · brocade      gold glitter arching out, twinkling as it falls     */
/*  · pistil       inner sphere of a different colour inside the burst */
/*  · crossette    stars that split mid-flight into smaller stars      */
/*  · ring/saturn  stars in a perfect circle (double ring for saturn)  */
/*  · palm         thick rising stars with heavy arcing trails         */
/*  · strobe       stars that blink on and off as they fall            */
/*  · crackle      stars that end in tiny sparkling pops               */
/*  · comet        a rising rocket with a long tail that bursts        */
/*                                                                     */
/* Every star is drawn as a streak: the vertex shader re-evaluates the */
/* same ballistic path at 3-4 earlier times ("ghost lags"), so shells  */
/* read as spark trails instead of dots — no extra CPU, no extra       */
/* buffers. A separate small comet pool launches rockets from the      */
/* city rooftops and river barges; a comet explodes into a shell when */
/* it reaches its apex.                                                */
/* ------------------------------------------------------------------ */

const fireworksVertex = /* glsl */ `
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute float aTime;
  attribute float aLife;
  attribute float aSize;
  attribute float aType;
  attribute float aSeed;
  attribute float aGrav;
  attribute float aLag;
  attribute float aGhost;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float age = uTime - aTime - aLag;
    float alive = step(0.0, age) * step(age, aLife);
    float t = max(age, 0.0);

    float damp = (1.0 - exp(-aGrav * 0.55 * t)) / (aGrav * 0.55);
    vec3 p = position + aVel * damp;
    p.y -= aGrav * 0.5 * t * t;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float fade = 1.0 - smoothstep(aLife * 0.42, aLife, t);
    fade *= smoothstep(0.0, 0.045, t);

    // aType: 0 steady, 1 twinkle (brocade/crackle), 2 strobe blink
    float twinkle = mix(
      1.0,
      0.30 + 0.70 * abs(sin(uTime * 30.0 + aSeed * 43.0)),
      step(0.5, aType) * step(aType, 1.5)
    );
    float blink = mix(
      1.0,
      step(0.25, fract(uTime * 3.2 + aSeed * 7.0)),
      step(1.5, aType)
    );

    vAlpha = alive * fade * twinkle * blink * aGhost;
    vColor = aColor;

    float dist = max(1.0, -mv.z);
    gl_PointSize = aSize * uPixelRatio * (250.0 / dist) * (0.4 + fade * 0.8);
    if (alive < 0.5) gl_PointSize = 0.0;
  }
`

const fireworksFragment = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.18, 0.0, d);
    float a = glow * glow;
    if (a < 0.004) discard;
    vec3 col = vColor * (0.55 + 1.3 * core);
    gl_FragColor = vec4(col * a * vAlpha * 2.1, a * vAlpha);
  }
`

/* ----------------------------- comets ----------------------------- */

const cometVertex = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aTime;
  attribute float aSize;
  attribute float aColorMix;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vMix;

  void main() {
    vec3 delta = aTarget - position;
    float t = clamp((uTime - aTime) / 1.55, 0.0, 1.05);

    // parabolic rise: fast launch, ease to apex, tiny overshoot settle
    float ease = 1.0 - pow(1.0 - min(t, 1.0), 2.4);
    vec3 p = mix(position, aTarget, ease);
    p.x += sin(t * 9.0 + aTime * 13.0) * 0.02 * t * (1.0 - t);
    p.z += cos(t * 7.0 + aTime * 11.0) * 0.02 * t * (1.0 - t);

    float alive = step(0.0, uTime - aTime) * step(uTime - aTime, 1.7);
    float fade = smoothstep(0.0, 0.05, uTime - aTime) * (1.0 - smoothstep(1.25, 1.65, uTime - aTime));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = alive * fade;
    vMix = aColorMix;

    float dist = max(1.0, -mv.z);
    gl_PointSize = aSize * uPixelRatio * (250.0 / dist);
    if (alive < 0.5) gl_PointSize = 0.0;
  }
`

const cometFragment = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying float vMix;

  void main() {
    if (vAlpha < 0.004) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    float a = glow * glow;
    if (a < 0.004) discard;
    vec3 col = mix(vec3(1.0, 0.72, 0.30), vec3(1.0, 0.95, 0.85), vMix);
    col *= 1.6 + 2.2 * core;
    gl_FragColor = vec4(col * a * vAlpha * 2.4, a * vAlpha);
  }
`

/* ----------------------------- smoke ----------------------------- */

const smokeVertex = /* glsl */ `
  attribute float aTime;
  attribute float aSize;
  attribute float aSeed;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vAlpha;

  void main() {
    float age = uTime - aTime;
    float alive = step(0.0, age) * step(age, 7.0);
    float t = max(age, 0.0);

    vec3 p = position;
    p.y += t * 1.1;
    p.x += sin(aSeed * 23.0 + t * 0.5) * t * 0.55;
    p.z += cos(aSeed * 31.0 + t * 0.4) * t * 0.55;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float grow = 0.5 + t * 1.35;
    float fade = (1.0 - smoothstep(3.2, 7.0, t)) * smoothstep(0.0, 0.35, t);
    vAlpha = alive * fade * 0.34;

    float dist = max(1.0, -mv.z);
    gl_PointSize = aSize * grow * uPixelRatio * (250.0 / dist);
    if (alive < 0.5) gl_PointSize = 0.0;
  }
`

const smokeFragment = /* glsl */ `
  precision highp float;

  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.08, d);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(0.10, 0.10, 0.14) * a * vAlpha, a * vAlpha);
  }
`

/* ----------------------------- types ------------------------------ */

type ShellKind =
  | 'peony'
  | 'chrysanthemum'
  | 'willow'
  | 'brocade'
  | 'pistil'
  | 'crossette'
  | 'ring'
  | 'saturn'
  | 'palm'
  | 'strobe'

const SHELLS: ShellKind[] = [
  'peony',
  'chrysanthemum',
  'chrysanthemum',
  'willow',
  'brocade',
  'pistil',
  'crossette',
  'ring',
  'palm',
  'strobe',
  'peony',
  'willow',
]

/** The five classic firework colours, mixed like metal salts do. */
const PALETTES: Array<Array<[number, number, number]>> = [
  [
    [1.0, 0.62, 0.16],
    [1.0, 0.80, 0.38],
  ], // gold
  [
    [0.95, 0.16, 0.18],
    [1.0, 0.42, 0.30],
  ], // strontium red
  [
    [0.42, 0.95, 0.52],
    [0.72, 1.0, 0.60],
  ], // barium green
  [
    [0.45, 0.62, 1.0],
    [0.70, 0.82, 1.0],
  ], // copper blue
  [
    [1.0, 0.38, 0.72],
    [1.0, 0.62, 0.82],
  ], // magenta
]

interface BurstOptions {
  scale?: number
  palette?: number
  secondaryPalette?: number
}

export function FireworksSystem() {
  const { camera } = useThree()
  const count = QUALITY.fireworks

  const buffers = useMemo(() => {
    return {
      positions: new Float32Array(count * 3),
      velocities: new Float32Array(count * 3),
      colors: new Float32Array(count * 3),
      times: new Float32Array(count).fill(-999),
      lifes: new Float32Array(count).fill(1),
      sizes: new Float32Array(count).fill(1),
      types: new Float32Array(count),
      seeds: new Float32Array(count),
      gravs: new Float32Array(count).fill(2.2),
      lags: new Float32Array(count),
      ghosts: new Float32Array(count).fill(1),
    }
  }, [count])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3))
    g.setAttribute('aVel', new THREE.BufferAttribute(buffers.velocities, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(buffers.colors, 3))
    g.setAttribute('aTime', new THREE.BufferAttribute(buffers.times, 1))
    g.setAttribute('aLife', new THREE.BufferAttribute(buffers.lifes, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1))
    g.setAttribute('aType', new THREE.BufferAttribute(buffers.types, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(buffers.seeds, 1))
    g.setAttribute('aGrav', new THREE.BufferAttribute(buffers.gravs, 1))
    g.setAttribute('aLag', new THREE.BufferAttribute(buffers.lags, 1))
    g.setAttribute('aGhost', new THREE.BufferAttribute(buffers.ghosts, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 60, -120), 900)
    return g
  }, [buffers])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fireworksVertex,
        fragmentShader: fireworksFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  /* ----------------------------- comets ----------------------------- */
  const COMETS = 96
  const comet = useMemo(() => {
    const positions = new Float32Array(COMETS * 3)
    const targets = new Float32Array(COMETS * 3)
    const times = new Float32Array(COMETS).fill(-999)
    const sizes = new Float32Array(COMETS)
    const mixes = new Float32Array(COMETS)
    for (let i = 0; i < COMETS; i++) sizes[i] = 1.6
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3))
    geo.setAttribute('aTime', new THREE.BufferAttribute(times, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aColorMix', new THREE.BufferAttribute(mixes, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 60, -120), 900)
    const mat = new THREE.ShaderMaterial({
      vertexShader: cometVertex,
      fragmentShader: cometFragment,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat, positions, targets, times, sizes, mixes }
  }, [])

  /* ----------------------------- smoke ----------------------------- */
  const SMOKE = 260
  const smoke = useMemo(() => {
    const positions = new Float32Array(SMOKE * 3)
    const times = new Float32Array(SMOKE).fill(-999)
    const sizes = new Float32Array(SMOKE)
    const seeds = new Float32Array(SMOKE)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aTime', new THREE.BufferAttribute(times, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 40, -100), 900)
    const mat = new THREE.ShaderMaterial({
      vertexShader: smokeVertex,
      fragmentShader: smokeFragment,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    return { geo, mat, positions, times, sizes, seeds }
  }, [])

  const cursor = useRef(0)
  const cometCursor = useRef(0)
  const smokeCursor = useRef(0)
  const clockRef = useRef(0)
  const autoTimer = useRef(2.2)
  const extraUntil = useRef(-1)
  const extraTimer = useRef(0)
  const lastVibrate = useRef(-10)
  const pending = useRef<
    Array<{ at: number; x: number; y: number; z: number; kind: ShellKind; opts: BurstOptions }>
  >([])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
    comet.geo.dispose()
    comet.mat.dispose()
    smoke.geo.dispose()
    smoke.mat.dispose()
  }, [geometry, material, comet, smoke])

  const markDirty = useCallback(() => {
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aVel.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
    geometry.attributes.aTime.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
    geometry.attributes.aType.needsUpdate = true
    geometry.attributes.aSeed.needsUpdate = true
    geometry.attributes.aGrav.needsUpdate = true
    geometry.attributes.aLag.needsUpdate = true
    geometry.attributes.aGhost.needsUpdate = true
  }, [geometry])

  const puffSmoke = useCallback(
    (x: number, y: number, z: number, n: number) => {
      for (let k = 0; k < n; k++) {
        const i = smokeCursor.current
        smokeCursor.current = (i + 1) % SMOKE
        smoke.positions[i * 3] = x + (Math.random() - 0.5) * 4
        smoke.positions[i * 3 + 1] = y + (Math.random() - 0.5) * 3
        smoke.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 4
        smoke.times[i] = clockRef.current - Math.random() * 0.4
        smoke.sizes[i] = 2.2 + Math.random() * 2.6
        smoke.seeds[i] = Math.random()
      }
      smoke.geo.attributes.position.needsUpdate = true
      smoke.geo.attributes.aTime.needsUpdate = true
      smoke.geo.attributes.aSize.needsUpdate = true
      smoke.geo.attributes.aSeed.needsUpdate = true
    },
    [smoke],
  )

  const writeStar = useCallback(
    (
      i: number,
      ox: number,
      oy: number,
      oz: number,
      dx: number,
      dy: number,
      dz: number,
      sp: number,
      col: [number, number, number],
      life: number,
      size: number,
      flag: number,
      grav: number,
      ghosts: number,
      birthOffset = 0,
    ) => {
      const j = i * 3
      buffers.positions[j] = ox
      buffers.positions[j + 1] = oy
      buffers.positions[j + 2] = oz
      buffers.velocities[j] = dx * sp
      buffers.velocities[j + 1] = dy * sp
      buffers.velocities[j + 2] = dz * sp
      buffers.colors[j] = col[0]
      buffers.colors[j + 1] = col[1]
      buffers.colors[j + 2] = col[2]
      buffers.times[i] = clockRef.current + birthOffset
      buffers.lifes[i] = life
      buffers.sizes[i] = size
      buffers.types[i] = flag
      buffers.seeds[i] = Math.random()
      buffers.gravs[i] = grav
      buffers.lags[i] = 0
      buffers.ghosts[i] = 1
      void ghosts
    },
    [buffers],
  )

  /** One logical star → head + ghost lags, so it draws as a streak. */
  const emitStar = useCallback(
    (
      ox: number,
      oy: number,
      oz: number,
      dx: number,
      dy: number,
      dz: number,
      sp: number,
      col: [number, number, number],
      life: number,
      size: number,
      flag: number,
      grav: number,
      ghostCount: number,
      birthOffset = 0,
    ) => {
      for (let g = 0; g < ghostCount; g++) {
        if (cursor.current >= count - 1) break
        const i = cursor.current
        cursor.current = (i + 1) % count
        writeStar(
          i,
          ox,
          oy,
          oz,
          dx,
          dy,
          dz,
          sp,
          col,
          life,
          size,
          flag,
          grav,
          1,
          birthOffset,
        )
        buffers.lags[i] = g * 0.032
        buffers.ghosts[i] = g === 0 ? 1 : 1 - g * 0.30
      }
    },
    [buffers, count, writeStar],
  )

  const burst = useCallback(
    (ox: number, oy: number, oz: number, kind: ShellKind, amount: number, opts: BurstOptions = {}) => {
      const scale = opts.scale ?? 1
      const palette = PALETTES[opts.palette ?? Math.floor(Math.random() * PALETTES.length)]
      const baseSpeed = 30 * scale

      const sphereDir = () => {
        const u = Math.random() * 2 - 1
        const th = Math.random() * Math.PI * 2
        const rr = Math.sqrt(Math.max(0, 1 - u * u))
        return [rr * Math.cos(th), u, rr * Math.sin(th)] as const
      }
      const pickColor = (): [number, number, number] =>
        palette[Math.floor(Math.random() * palette.length)]

      for (let k = 0; k < amount; k++) {
        let dx = 0
        let dy = 1
        let dz = 0
        let speed = 1
        let life = 2.4
        let size = 1.5
        let flag = 0
        let grav = 2.2
        let ghosts = 1

        switch (kind) {
          case 'peony': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.66 + Math.random() * 0.5
            life = 2.0 + Math.random() * 1.1
            size = 1.5 + Math.random() * 1.7
            grav = 2.0
            break
          }
          case 'chrysanthemum': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.55 + Math.random() * 0.5
            life = 2.6 + Math.random() * 1.4
            size = 1.5 + Math.random() * 1.4
            grav = 2.1
            ghosts = 4
            break
          }
          case 'willow': {
            ;[dx, dy, dz] = sphereDir()
            dy = dy * 0.62 - 0.42
            const len = Math.hypot(dx, dy, dz) || 1
            dx /= len
            dy /= len
            dz /= len
            speed = 0.42 + Math.random() * 0.5
            life = 4.4 + Math.random() * 2.0
            size = 1.5 + Math.random() * 1.6
            grav = 3.6
            ghosts = 5
            break
          }
          case 'brocade': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.5 + Math.random() * 0.42
            life = 3.2 + Math.random() * 1.6
            size = 1.4 + Math.random() * 1.3
            grav = 2.8
            ghosts = 3
            flag = 1
            break
          }
          case 'pistil': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.62 + Math.random() * 0.48
            life = 2.2 + Math.random() * 1.2
            size = 1.5 + Math.random() * 1.5
            grav = 2.1
            ghosts = 2
            break
          }
          case 'crossette': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.6 + Math.random() * 0.45
            life = 1.9 + Math.random()
            size = 1.9 + Math.random() * 1.3
            grav = 2.2
            ghosts = 3
            break
          }
          case 'ring':
          case 'saturn': {
            const th = (k / amount) * Math.PI * 2 + Math.random() * 0.05
            dx = Math.cos(th)
            dy = Math.sin(th) * (kind === 'saturn' ? 0.35 : 1)
            dz = kind === 'saturn' ? Math.sin(th) * 0.35 : 0
            speed = 0.78 + Math.random() * 0.16
            life = 2.4 + Math.random() * 0.9
            size = 1.6 + Math.random() * 1.2
            grav = 2.0
            break
          }
          case 'palm': {
            const th = Math.random() * Math.PI * 2
            const rr = Math.sqrt(Math.random())
            dx = Math.cos(th) * rr * 0.9
            dy = 0.45 + Math.random() * 0.55
            dz = Math.sin(th) * rr * 0.9
            const len = Math.hypot(dx, dy, dz) || 1
            dx /= len
            dy /= len
            dz /= len
            speed = 0.5 + Math.random() * 0.4
            life = 3.4 + Math.random() * 1.8
            size = 1.8 + Math.random() * 1.5
            grav = 2.9
            ghosts = 5
            break
          }
          case 'strobe': {
            ;[dx, dy, dz] = sphereDir()
            speed = 0.55 + Math.random() * 0.45
            life = 2.8 + Math.random() * 1.4
            size = 1.5 + Math.random() * 1.3
            grav = 2.4
            ghosts = 2
            flag = 2
            break
          }
        }

        const sp = baseSpeed * speed * (0.86 + Math.random() * 0.28)
        const col = kind === 'willow' || kind === 'brocade' ? palette[0] : pickColor()
        emitStar(ox, oy, oz, dx, dy, dz, sp, col, life, size, flag, grav, ghosts)
      }

      markDirty()

      /* pistil: a smaller sphere of another colour blooms at the core */
      if (kind === 'pistil') {
        pending.current.push({
          at: clockRef.current + 0.55,
          x: ox,
          y: oy,
          z: oz,
          kind: 'peony',
          opts: { scale: scale * 0.42, palette: (opts.palette ?? 0) === 0 ? 1 : 0 },
        })
      }

      /* crossette: parent stars split into 3 sparks mid-flight */
      if (kind === 'crossette') {
        const splits = 3
        const parents = Math.min(amount, 46)
        for (let s = 0; s < parents; s++) {
          const u = Math.random() * 2 - 1
          const th = Math.random() * Math.PI * 2
          const rr = Math.sqrt(Math.max(0, 1 - u * u))
          const v = [
            rr * Math.cos(th) * baseSpeed * 0.75,
            u * baseSpeed * 0.75,
            rr * Math.sin(th) * baseSpeed * 0.75,
          ]
          const t = 0.85 + Math.random() * 0.5
          const damp = (1 - Math.exp(-2.2 * 0.55 * t)) / (2.2 * 0.55)
          const px = ox + v[0] * damp
          const py = oy + v[1] * damp - 2.2 * 0.5 * t * t
          const pz = oz + v[2] * damp
          for (let m = 0; m < splits; m++) {
            const a = Math.random() * Math.PI * 2
            const b = Math.random() * Math.PI - Math.PI / 2
            const keep = 0.5
            const dv = [
              v[0] * keep * Math.exp(-2.2 * 0.55 * t) + Math.cos(a) * Math.cos(b) * baseSpeed * 0.22,
              v[1] * keep * Math.exp(-2.2 * 0.55 * t) + Math.sin(b) * baseSpeed * 0.22,
              v[2] * keep * Math.exp(-2.2 * 0.55 * t) + Math.sin(a) * Math.cos(b) * baseSpeed * 0.22,
            ]
            emitStar(
              px,
              py,
              pz,
              dv[0],
              dv[1],
              dv[2],
              1,
              palette[Math.floor(Math.random() * palette.length)],
              1.6 + Math.random(),
              1.2 + Math.random(),
              1,
              2.2,
              2,
              t,
            )
          }
        }
        markDirty()
      }

      /* saturn: an outer ring tilted around a peony core */
      if (kind === 'saturn') {
        const n2 = Math.floor(amount * 0.7)
        for (let k = 0; k < n2; k++) {
          const th = (k / n2) * Math.PI * 2 + Math.random() * 0.05
          const dx = Math.cos(th)
          const dy = Math.sin(th) * 0.35
          const dz = Math.sin(th) * 0.35
          emitStar(
            ox,
            oy,
            oz,
            dx,
            dy,
            dz,
            baseSpeed * 1.05,
            palette[1],
            2.6 + Math.random(),
            1.4 + Math.random(),
            0,
            2.0,
            1,
          )
        }
        markDirty()
      }

      /* light + shake + haptics */
      stage.flash = Math.min(1.25, stage.flash + 0.5 + scale * 0.18)
      if (QUALITY.shake) stage.shake = Math.min(1, stage.shake + 0.3)
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function' &&
        clockRef.current - lastVibrate.current > 0.9
      ) {
        lastVibrate.current = clockRef.current
        try {
          navigator.vibrate([28, 18, 55])
        } catch {
          /* noop */
        }
      }
    },
    [buffers, count, emitStar, markDirty],
  )

  /** Launch a comet from the city or a river barge; it bursts at the apex. */
  const launchComet = useCallback(
    (apexX: number, apexY: number, apexZ: number, kind: ShellKind, opts: BurstOptions = {}) => {
      const i = cometCursor.current
      cometCursor.current = (i + 1) % COMETS
      // launchpads: rooftops + barges on the river
      const fromBarge = apexZ > -70
      const lx = apexX + (Math.random() - 0.5) * 26
      const lz = apexZ + (Math.random() - 0.5) * 18
      const ly = fromBarge ? -0.5 : 4 + Math.random() * 16
      comet.positions[i * 3] = lx
      comet.positions[i * 3 + 1] = ly
      comet.positions[i * 3 + 2] = lz
      comet.targets[i * 3] = apexX
      comet.targets[i * 3 + 1] = apexY
      comet.targets[i * 3 + 2] = apexZ
      comet.times[i] = clockRef.current
      comet.mixes[i] = Math.random()
      comet.geo.attributes.position.needsUpdate = true
      comet.geo.attributes.aTarget.needsUpdate = true
      comet.geo.attributes.aTime.needsUpdate = true
      comet.geo.attributes.aColorMix.needsUpdate = true

      const t = clockRef.current
      const amount = Math.floor((opts.scale ?? 1) * (kind === 'willow' || kind === 'palm' ? 330 : 260))
      pending.current.push({ at: t + 1.5, x: apexX, y: apexY, z: apexZ, kind, opts })
      puffSmoke(lx, ly + 1, lz, 2)
    },
    [comet, puffSmoke],
  )

  const spawnRandom = useCallback(
    (big = false) => {
      const e = camera.matrixWorld.elements
      const rx = e[0]
      const ry = e[1]
      const rz = e[2]
      const ux = e[4]
      const uy = e[5]
      const uz = e[6]
      const fwx = -e[8]
      const fwy = -e[9]
      const fwz = -e[10]

      const dist = 84 + Math.random() * 60
      const lateral = (Math.random() - 0.5) * 120
      const lift = 10 + Math.random() * 56

      const ox = camera.position.x + fwx * dist + rx * lateral + ux * lift
      const oy = camera.position.y + fwy * dist + ry * lateral + uy * lift
      const oz = camera.position.z + fwz * dist + rz * lateral + uz * lift

      const kind = SHELLS[Math.floor(Math.random() * SHELLS.length)]
      if (Math.random() < 0.55) {
        launchComet(ox, oy, oz, kind, { scale: big ? 1.3 : 1 })
      } else {
        burst(ox, oy, oz, kind, Math.floor((big ? 460 : 300) + Math.random() * 240), {
          scale: big ? 1.25 : 1,
        })
      }
    },
    [burst, launchComet, camera],
  )

  const burstAtNDC = useCallback(
    (x: number, y: number) => {
      const v = new THREE.Vector3(x, y, 0.5).unproject(camera)
      v.sub(camera.position).normalize()
      const dist = 92
      const kind = SHELLS[Math.floor(Math.random() * SHELLS.length)]
      launchComet(
        camera.position.x + v.x * dist,
        camera.position.y + v.y * dist,
        camera.position.z + v.z * dist,
        kind,
        { scale: 1.05 },
      )
    },
    [launchComet, camera],
  )

  useEffect(() => {
    fx.burstAtNDC = burstAtNDC
    fx.burstRandom = spawnRandom
    fx.extraShow = () => {
      extraUntil.current = clockRef.current + 5.5
      extraTimer.current = 0
    }
    fx.clear = () => {
      buffers.times.fill(-999)
      comet.times.fill(-999)
      pending.current = []
      markDirty()
      comet.geo.attributes.aTime.needsUpdate = true
    }
    return () => {
      fx.burstAtNDC = null
      fx.burstRandom = null
      fx.extraShow = null
      fx.clear = null
    }
  }, [burstAtNDC, spawnRandom, buffers, markDirty, comet])

  useFrame((state, delta) => {
    clockRef.current = state.clock.elapsedTime
    material.uniforms.uTime.value = clockRef.current
    comet.mat.uniforms.uTime.value = clockRef.current
    smoke.mat.uniforms.uTime.value = clockRef.current

    /* text moratorium: while "शुभ दीपावली" / "Sarit, Reyana & Family" is
       on screen, no bursts, no glow, no flash — the words own the sky */
    const textShowing = stage.textIn > 0.02 && stage.textOut < 0.9

    /* fire scheduled sub-bursts (pistil cores, comet apexes) */
    const t = clockRef.current
    for (let i = pending.current.length - 1; i >= 0; i--) {
      const p = pending.current[i]
      if (textShowing) {
        pending.current.splice(i, 1)
        continue
      }
      if (t >= p.at) {
        pending.current.splice(i, 1)
        burst(p.x, p.y, p.z, p.kind, Math.floor(240 * (p.opts.scale ?? 1)), p.opts)
        puffSmoke(p.x, p.y, p.z, p.kind === 'willow' || p.kind === 'palm' ? 5 : 3)
      }
    }

    if (!textShowing && stage.fireworks > 0.03 && stage.act >= 4) {
      autoTimer.current -= delta
      if (autoTimer.current <= 0) {
        autoTimer.current = (0.5 + Math.random() * 0.95) / Math.max(0.3, stage.fireworks)
        spawnRandom(stage.fireworks > 0.8)
      }
    }

    if (!textShowing && clockRef.current < extraUntil.current) {
      extraTimer.current -= delta
      if (extraTimer.current <= 0) {
        extraTimer.current = 0.12
        spawnRandom(true)
      }
    }
  })

  return (
    <group>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />
      <points geometry={comet.geo} material={comet.mat} frustumCulled={false} renderOrder={11} />
      <points geometry={smoke.geo} material={smoke.mat} frustumCulled={false} renderOrder={6} />
    </group>
  )
}
