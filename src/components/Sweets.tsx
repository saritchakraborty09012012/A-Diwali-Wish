import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'
import { fx } from '../lib/fx'

/* ------------------------------------------------------------------ */
/* Mithai & chocolate rain                                             */
/*                                                                     */
/* While `stage.sweets` (or the "Mithai baanto" FX trigger) is on,     */
/* ladoos, barfi and chocolate bars drift down over the city — the     */
/* sweets a host would callocho be handing out to guests, as sprites.  */
/* Textures are painted on canvas at boot: a budiya-textured orange    */
/* ladoo, a diamond of barfi with foil, and a segmented chocolate bar. */
/* ------------------------------------------------------------------ */

const TEX_SIZE = 128

function makeLadooTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = TEX_SIZE
  const ctx = c.getContext('2d')!
  const cx = TEX_SIZE / 2

  // soft sugar-dust halo
  const halo = ctx.createRadialGradient(cx, cx, 8, cx, cx, 62)
  halo.addColorStop(0, 'rgba(255,150,40,0.28)')
  halo.addColorStop(1, 'rgba(255,140,40,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // body
  const body = ctx.createRadialGradient(cx - 12, cx - 16, 6, cx, cx, 42)
  body.addColorStop(0, '#ffe0a1')
  body.addColorStop(0.45, '#f5a52b')
  body.addColorStop(1, '#b45f0c')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cx, 40, 0, Math.PI * 2)
  ctx.fill()

  // boondi grains
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * 33
    const px = cx + Math.cos(a) * r
    const py = cx + Math.sin(a) * r
    const gr = 3.2 + Math.random() * 3.4
    const dark = Math.random() > 0.62
    ctx.fillStyle = dark ? 'rgba(146,76,8,0.55)' : 'rgba(255,214,130,0.5)'
    ctx.beginPath()
    ctx.arc(px, py, gr, 0, Math.PI * 2)
    ctx.fill()
  }

  // ghee sheen
  const sheen = ctx.createRadialGradient(cx - 16, cx - 20, 2, cx - 16, cx - 20, 26)
  sheen.addColorStop(0, 'rgba(255,250,224,0.85)')
  sheen.addColorStop(1, 'rgba(255,250,224,0)')
  ctx.fillStyle = sheen
  ctx.beginPath()
  ctx.ellipse(cx - 14, cx - 18, 20, 13, -0.5, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

function makeBarfiTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = TEX_SIZE
  const ctx = c.getContext('2d')!
  const cx = TEX_SIZE / 2

  const halo = ctx.createRadialGradient(cx, cx, 8, cx, cx, 62)
  halo.addColorStop(0, 'rgba(255,240,200,0.20)')
  halo.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // diamond body
  ctx.save()
  ctx.translate(cx, cx)
  ctx.rotate(Math.PI / 4)
  const body = ctx.createLinearGradient(-34, -34, 34, 34)
  body.addColorStop(0, '#fff6dd')
  body.addColorStop(0.6, '#f3dba6')
  body.addColorStop(1, '#c79d55')
  ctx.fillStyle = body
  ctx.fillRect(-32, -32, 64, 64)
  // silver varq
  const varq = ctx.createLinearGradient(-32, -32, 32, 32)
  varq.addColorStop(0, 'rgba(255,255,255,0.75)')
  varq.addColorStop(0.5, 'rgba(214,220,230,0.35)')
  varq.addColorStop(1, 'rgba(255,255,255,0.6)')
  ctx.fillStyle = varq
  ctx.fillRect(-32, -32, 64, 64)
  ctx.restore()

  // pistachio slivers + cardamom dots
  for (let i = 0; i < 10; i++) {
    const px = cx - 22 + Math.random() * 44
    const py = cx - 22 + Math.random() * 44
    ctx.fillStyle = 'rgba(92,168,76,0.85)'
    ctx.beginPath()
    ctx.ellipse(px, py, 5, 2.2, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(120,90,40,0.7)'
  ctx.beginPath()
  ctx.arc(cx, cx, 3.4, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

function makeChocolateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = TEX_SIZE
  const ctx = c.getContext('2d')!
  const cx = TEX_SIZE / 2

  const halo = ctx.createRadialGradient(cx, cx, 8, cx, cx, 64)
  halo.addColorStop(0, 'rgba(120,70,30,0.26)')
  halo.addColorStop(1, 'rgba(120,70,30,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // bar body (tilted)
  ctx.save()
  ctx.translate(cx, cx)
  ctx.rotate(-0.42)
  const body = ctx.createLinearGradient(0, -34, 0, 34)
  body.addColorStop(0, '#7a3f16')
  body.addColorStop(0.5, '#5d2d0c')
  body.addColorStop(1, '#3c1a06')
  ctx.fillStyle = body
  ctx.fillRect(-26, -36, 52, 72)

  // segments
  for (let r = 0; r < 4; r++) {
    for (let col = 0; col < 2; col++) {
      const x = -26 + col * 26
      const y = -36 + r * 18
      const seg = ctx.createLinearGradient(x, y, x + 26, y + 18)
      seg.addColorStop(0, '#8a5426')
      seg.addColorStop(0.55, '#6e3f18')
      seg.addColorStop(1, '#4a250a')
      ctx.fillStyle = seg
      ctx.fillRect(x + 2.5, y + 2.5, 21, 13)
    }
  }
  // foil glint
  ctx.fillStyle = 'rgba(255,220,150,0.22)'
  ctx.fillRect(-26, -36, 52, 5)

  ctx.restore()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

interface SweetKind {
  name: 'ladoo' | 'barfi' | 'chocolate'
  texture: THREE.CanvasTexture
  size: number
}

interface Sweet {
  x: number
  y: number
  z: number
  vy: number
  vx: number
  vz: number
  sway: number
  spin: number
  rot: number
  scale: number
  lift: number
}

const RAIN_SECONDS = 6

/** Shared by every cloud; written by the fx bridge in `Sweets`. */
const rainUntilRef = { current: -1 }
let clockNow = 0

function SweetCloud({
  kind,
  count,
  height,
}: {
  kind: SweetKind
  count: number
  height: number
}) {
  const ref = useRef<THREE.Points>(null)
  const sweets = useRef<Sweet[]>([])
  const cursor = useRef(0)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aRot', new THREE.BufferAttribute(new Float32Array(count), 1))
    g.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(count), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 60, -120), 900)
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aRot;
          attribute float aScale;
          uniform float uPixelRatio;
          varying float vRot;
          void main() {
            vRot = aRot;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            float dist = max(1.0, -mv.z);
            gl_PointSize = aScale * uPixelRatio * (250.0 / dist);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform sampler2D uMap;
          varying float vRot;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float s = sin(vRot);
            float c = cos(vRot);
            vec2 q = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
            if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) discard;
            vec4 tex = texture2D(uMap, q);
            if (tex.a < 0.02) discard;
            gl_FragColor = vec4(tex.rgb * 1.15, tex.a);
          }
        `,
        uniforms: {
          uMap: { value: kind.texture },
          uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
        },
        transparent: true,
        depthWrite: false,
      }),
    [kind],
  )

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  const spawn = (s: Sweet) => {
    s.x = (Math.random() - 0.5) * 210
    s.y = height + Math.random() * 22
    s.z = -30 - Math.random() * 170
    s.vy = 3.2 + Math.random() * 3.4
    s.vx = (Math.random() - 0.5) * 1.4
    s.vz = (Math.random() - 0.5) * 1.4
    s.sway = Math.random() * Math.PI * 2
    s.spin = (Math.random() - 0.5) * 1.6
    s.rot = Math.random() * Math.PI * 2
    s.scale = 0.72 + Math.random() * 0.75
    s.lift = 0
  }

  useFrame((state, delta) => {
    clockNow = state.clock.elapsedTime
    const dt = Math.min(0.05, delta)
    const raining = stage.sweets > 0.05 || clockNow < rainUntilRef.current
    const pool = sweets.current

    const pos = geometry.attributes.position as THREE.BufferAttribute
    const rots = geometry.attributes.aRot as THREE.BufferAttribute
    const scales = geometry.attributes.aScale as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const rotArr = rots.array as Float32Array
    const sclArr = scales.array as Float32Array

    const activeCount = raining ? count : Math.min(pool.length, count)
    const spawnRate = raining ? count * 0.9 : 0

    if (raining) {
      const budget = Math.max(1, Math.round(spawnRate * dt))
      for (let n = 0; n < budget && pool.length < count; n++) {
        const s: Sweet = {
          x: 0,
          y: 0,
          z: 0,
          vy: 0,
          vx: 0,
          vz: 0,
          sway: 0,
          spin: 0,
          rot: 0,
          scale: 1,
          lift: 0,
        }
        spawn(s)
        pool.push(s)
      }
    }

    for (let i = pool.length - 1; i >= 0; i--) {
      const s = pool[i]
      if (s.y < 0.4) {
        if (raining && pool.length <= activeCount) {
          spawn(s)
        } else {
          pool.splice(i, 1)
          continue
        }
      }
      s.lift += dt
      s.y -= s.vy * dt
      s.x += (s.vx + Math.sin(s.lift * 1.3 + s.sway) * 0.9) * dt
      s.z += s.vz * dt
      s.rot += s.spin * dt
      if (i >= count) {
        pool.splice(i, 1)
        continue
      }
      arr[i * 3] = s.x
      arr[i * 3 + 1] = s.y
      arr[i * 3 + 2] = s.z
      rotArr[i] = s.rot
      sclArr[i] = s.scale * kind.size
    }
    // hide the rest
    for (let i = pool.length; i < count; i++) {
      arr[i * 3 + 1] = -999
    }

    pos.needsUpdate = true
    rots.needsUpdate = true
    scales.needsUpdate = true
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={9} />
}

/* ------------------------------------------------------------------ */
/* Owner — three clouds + the fx bridge                                */
/* ------------------------------------------------------------------ */

export function Sweets() {
  const kinds = useMemo<SweetKind[]>(
    () => [
      { name: 'ladoo', texture: makeLadooTexture(), size: 3.1 },
      { name: 'barfi', texture: makeBarfiTexture(), size: 2.9 },
      { name: 'chocolate', texture: makeChocolateTexture(), size: 3.4 },
    ],
    [],
  )

  const counts = useMemo(() => {
    const total = QUALITY.dust
    return {
      ladoo: Math.round(total * 0.42),
      barfi: Math.round(total * 0.33),
      chocolate: Math.round(total * 0.25),
    }
  }, [])

  useEffect(() => {
    const shower = () => {
      rainUntilRef.current = clockNow + RAIN_SECONDS
      stage.sweets = Math.max(stage.sweets, 0.6)
    }
    fx.sweetShower = shower
    return () => {
      if (fx.sweetShower === shower) fx.sweetShower = null
    }
  }, [])

  useEffect(
    () => () => {
      kinds.forEach((k) => k.texture.dispose())
    },
    [kinds],
  )

  return (
    <group>
      <SweetCloud kind={kinds[0]} count={counts.ladoo} height={52} />
      <SweetCloud kind={kinds[1]} count={counts.barfi} height={56} />
      <SweetCloud kind={kinds[2]} count={counts.chocolate} height={60} />
    </group>
  )
}
