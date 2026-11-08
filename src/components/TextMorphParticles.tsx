import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'
import { SENDER } from '../config'

const morphVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aTargetA;
  attribute vec3 aTargetB;
  attribute float aRand;
  attribute float aSize;

  uniform float uTime;
  uniform float uInA;
  uniform float uInB;
  uniform float uOpacity;
  uniform vec2 uScale;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  float easeOutCubic(float x) {
    return 1.0 - pow(1.0 - x, 3.0);
  }

  float easeInOutCubic(float x) {
    return x < 0.5
      ? 4.0 * x * x * x
      : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
  }

  void main() {
    float delay = aRand * 0.34;
    float eA = easeOutCubic(clamp((uInA - delay) / 0.62, 0.0, 1.0));
    float eB = easeInOutCubic(clamp((uInB - delay * 0.35) / 0.68, 0.0, 1.0));

    vec3 pa = mix(aStart, aTargetA, eA);
    vec3 p = mix(pa, aTargetB, eB);

    p.xy *= uScale;
    p += vec3(
      sin(uTime * 1.7 + aRand * 43.0),
      cos(uTime * 1.3 + aRand * 31.0),
      0.0
    ) * 0.006 * eA;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.78 + 0.22 * sin(uTime * 3.1 + aRand * 57.0);
    vAlpha = uOpacity * twinkle;

    vColor = mix(
      vec3(1.0, 0.46, 0.09),
      vec3(1.0, 0.95, 0.78),
      smoothstep(-0.16, 0.16, aTargetA.y)
    );

    gl_PointSize = aSize * uPixelRatio * 2.7;
  }
`

/* Soft dark matte behind the text — a theatrical backdrop so the
 * shimmering particles stay readable against the fireworks. */
const matteVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const matteFragment = /* glsl */ `
  precision highp float;

  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float d = length((vUv - 0.5) * vec2(1.5, 2.6));
    float a = uOpacity * 0.62 * smoothstep(1.15, 0.18, d);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(0.012, 0.016, 0.03), a);
  }
`

const morphFragment = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    float a = glow * glow;
    if (a < 0.004) discard;
    vec3 col = vColor * (0.5 + 0.85 * core);
    gl_FragColor = vec4(col * a * vAlpha * 1.25, a * vAlpha);
  }
`

const CANVAS_W = 1600
const CANVAS_H = 420

/**
 * Draw a string to an offscreen canvas and sample its lit pixels into
 * normalised 2D target positions. Falls back to a ring if the font fails.
 */
function sampleText(
  text: string,
  font: string,
  weight: number,
  count: number,
): Float32Array {
  const out = new Float32Array(count * 2)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context')

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let size = CANVAS_H * 0.62
    ctx.font = `${weight} ${size}px ${font}`
    const measured = ctx.measureText(text).width
    if (measured > CANVAS_W * 0.92) {
      size *= (CANVAS_W * 0.92) / measured
      ctx.font = `${weight} ${size}px ${font}`
    }
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 + CANVAS_H * 0.02)

    const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data
    const points: number[] = []
    for (let y = 0; y < CANVAS_H; y += 2) {
      for (let x = 0; x < CANVAS_W; x += 2) {
        if (data[(y * CANVAS_W + x) * 4 + 3] > 130) points.push(x, y)
      }
    }

    const total = points.length / 2
    if (total < 12) throw new Error('empty glyphs')

    for (let i = 0; i < count; i++) {
      const k = Math.floor(Math.random() * total) * 2
      const px = points[k]
      const py = points[k + 1]
      const nx = (px / CANVAS_W - 0.5) * 2
      const ny = -(py / CANVAS_H - 0.5) * 2 * (CANVAS_H / CANVAS_W)
      out[i * 2] = nx + (Math.random() - 0.5) * 0.005
      out[i * 2 + 1] = ny + (Math.random() - 0.5) * 0.005
    }
  } catch {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 0.4 + Math.random() * 0.5
      out[i * 2] = Math.cos(a) * r
      out[i * 2 + 1] = Math.sin(a) * r * 0.25
    }
  }

  return out
}

export function TextMorphParticles() {
  const { camera } = useThree()
  const group = useRef<THREE.Group>(null)
  const count = QUALITY.textParticles

  const { geometry, material, targets } = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    const start = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const size = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - u * u))
      const radius = 0.18 + Math.pow(Math.random(), 0.6) * 0.42
      start[i * 3] = rr * Math.cos(th) * radius
      start[i * 3 + 1] = u * radius * 0.72
      start[i * 3 + 2] = (Math.random() - 0.5) * 0.6
      rand[i] = Math.random()
      size[i] = 0.7 + Math.random() * 1.2
    }

    const targetA = new Float32Array(count * 3)
    const targetB = new Float32Array(count * 3)

    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    geo.setAttribute('aTargetA', new THREE.BufferAttribute(targetA, 3))
    geo.setAttribute('aTargetB', new THREE.BufferAttribute(targetB, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)

    const mat = new THREE.ShaderMaterial({
      vertexShader: morphVertex,
      fragmentShader: morphFragment,
      uniforms: {
        uTime: { value: 0 },
        uInA: { value: 0 },
        uInB: { value: 0 },
        uOpacity: { value: 0 },
        uScale: { value: new THREE.Vector2(10, 10) },
        uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat, targets: { targetA, targetB } }
  }, [count])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await document.fonts.load('400 300px "Tiro Devanagari Hindi"')
        await document.fonts.load('700 200px "Cinzel"')
        if (document.fonts.ready) await document.fonts.ready
      } catch {
        /* fall through to system fonts */
      }
      if (cancelled) return

      const a = sampleText(
        'शुभ दीपावली',
        '"Tiro Devanagari Hindi", "Noto Sans Devanagari", serif',
        400,
        count,
      )
      const b = sampleText(SENDER, '"Cinzel", Georgia, serif', 700, count)

      const attrA = geometry.getAttribute('aTargetA') as THREE.BufferAttribute
      const attrB = geometry.getAttribute('aTargetB') as THREE.BufferAttribute
      const arrA = attrA.array as Float32Array
      const arrB = attrB.array as Float32Array
      for (let i = 0; i < count; i++) {
        arrA[i * 3] = a[i * 2]
        arrA[i * 3 + 1] = a[i * 2 + 1]
        arrA[i * 3 + 2] = (Math.random() - 0.5) * 0.05
        arrB[i * 3] = b[i * 2]
        arrB[i * 3 + 1] = b[i * 2 + 1]
        arrB[i * 3 + 2] = (Math.random() - 0.5) * 0.05
      }
      attrA.needsUpdate = true
      attrB.needsUpdate = true
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [count, geometry])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  /* dark matte disc behind the text */
  const matte = useMemo(() => {
    const geo = new THREE.PlaneGeometry(38, 16)
    const mat = new THREE.ShaderMaterial({
      vertexShader: matteVertex,
      fragmentShader: matteFragment,
      uniforms: { uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
    })
    return { geo, mat }
  }, [])

  useEffect(() => () => {
    matte.geo.dispose()
    matte.mat.dispose()
  }, [matte])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uInA.value = stage.textIn
    material.uniforms.uInB.value = stage.textMorph
    material.uniforms.uOpacity.value =
      Math.min(1, stage.textIn * 4) * (1 - Math.min(1, stage.textOut))
    matte.mat.uniforms.uOpacity.value = material.uniforms.uOpacity.value

    const g = group.current
    if (g) {
      g.position.copy(camera.position)
      g.quaternion.copy(camera.quaternion)
      g.translateZ(-20)
    }

    const vh = 2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360) * 20
    const vw = vh * (camera as THREE.PerspectiveCamera).aspect
    const width = vw * 0.84
    material.uniforms.uScale.value.set(width / 2, width / 2)
  })

  // keep the targets referenced so the memo is not tree-shaken oddly
  void targets

  return (
    <group ref={group}>
      <points
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={12}
      />
      <mesh
        geometry={matte.geo}
        material={matte.mat}
        position={[0, 0, -1.6]}
        frustumCulled={false}
        renderOrder={11}
      />
    </group>
  )
}
