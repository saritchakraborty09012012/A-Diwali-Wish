import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { BloomEffect } from 'postprocessing'
import * as THREE from 'three'

import { QUALITY } from '../lib/device'
import { stage } from '../lib/stage'
import { getUI, setUI } from '../lib/store'
import { beats } from '../lib/beats'
import { fx } from '../lib/fx'
import { fadeInAudio } from '../lib/audio'
import { startTimeline, seekTimeline, timelineTime } from '../lib/timeline'
import { glowTexture, starTexture } from '../lib/textures'

import { Ghat } from './Ghat'
import { Rangoli } from './Rangoli'
import { City } from './City'
import { Lotus } from '../components/Lotus'
import { Lanterns } from '../components/Lantern'
import { DiyaField, HeroGlow } from '../components/Diya'
import { FireworksSystem } from '../components/FireworksSystem'
import { Sweets } from '../components/Sweets'
import { TextMorphParticles } from '../components/TextMorphParticles'

/* ------------------------------------------------------------------ */
/* Sky                                                                */
/* ------------------------------------------------------------------ */

const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const skyFragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;

  void main() {
    vec3 dir = normalize(vWorld);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 horizon = vec3(0.085, 0.048, 0.032);
    vec3 mid = vec3(0.028, 0.042, 0.086);
    vec3 top = vec3(0.008, 0.012, 0.030);

    vec3 col = mix(horizon, mid, smoothstep(0.44, 0.62, h));
    col = mix(col, top, smoothstep(0.62, 0.96, h));

    // a faint warm bloom over the city
    float cityGlow = exp(-pow((h - 0.47) * 8.0, 2.0)) * 0.06;
    col += vec3(0.9, 0.5, 0.2) * cityGlow;

    gl_FragColor = vec4(col, 1.0);
  }
`

function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )

  const stars = useMemo(() => {
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const radius = 620
      pos[i * 3] = Math.cos(th) * r * radius
      pos[i * 3 + 1] = Math.abs(u) * radius * 0.85 + 40
      pos[i * 3 + 2] = Math.sin(th) * r * radius
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  const starMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 2.6,
        sizeAttenuation: false,
        map: starTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: '#cfd8ff',
        opacity: 0.9,
      }),
    [],
  )

  useEffect(() => () => {
    material.dispose()
    stars.dispose()
    starMat.dispose()
  }, [material, stars, starMat])

  return (
    <group>
      <mesh scale={[900, 900, 900]} material={material} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <points geometry={stars} material={starMat} frustumCulled={false} />
      <sprite position={[150, 165, -420]} scale={[52, 52, 1]}>
        <spriteMaterial
          map={glowTexture()}
          color="#dfe6ff"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.65}
        />
      </sprite>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Camera rig                                                         */
/* ------------------------------------------------------------------ */

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime

    // Portrait phones: pull back + widen so the whole ghat/city fits.
    const aspect = size.width / Math.max(1, size.height)
    const portrait = aspect < 1
    const pull = portrait ? 1 + (1 - aspect) * 0.85 : 1

    const shakeX =
      (Math.sin(t * 47.3) * 0.55 + Math.sin(t * 31.1) * 0.45) * stage.shake * 0.85
    const shakeY =
      (Math.cos(t * 53.7) * 0.5 + Math.sin(t * 27.9) * 0.5) * stage.shake * 0.6

    const px = stage.gyroX * 1.5 + stage.pointerX * 0.9
    const py = stage.gyroY * 0.9 + stage.pointerY * 0.55

    camera.position.set(
      stage.camX + px + shakeX,
      stage.camY + py + shakeY + (pull - 1) * 3,
      stage.camZ + (pull - 1) * 18,
    )
    camera.lookAt(stage.tgtX + px * 0.4, stage.tgtY + py * 0.4, stage.tgtZ)

    const persp = camera as THREE.PerspectiveCamera
    const targetFov = stage.fov * (portrait ? pull : 1)
    if (Math.abs(persp.fov - targetFov) > 0.001) {
      persp.fov = targetFov
      persp.updateProjectionMatrix()
    }

    camera.rotation.z += stage.roll + stage.shake * 0.012

    stage.elapsed = timelineTime()
    stage.act = getUI().act

    stage.flash = Math.max(0, stage.flash - delta * 2.1)
    stage.shake = Math.max(0, stage.shake - delta * 1.7)
    stage.beat = Math.max(0, stage.beat - delta * 3.4)
    stage.qualityPulse += delta

    beats.update(stage.elapsed)
  })

  return null
}

/* ------------------------------------------------------------------ */
/* Post processing                                                    */
/* ------------------------------------------------------------------ */

function Post() {
  const bloom = useRef<BloomEffect | null>(null)
  // @react-three/postprocessing types the Bloom ref as `typeof BloomEffect`
  // (the class itself) instead of an instance, so use a loose callback ref.
  const setBloom = (el: unknown) => {
    bloom.current = (el as BloomEffect | null) ?? null
  }
  const ca = useMemo(() => new THREE.Vector2(0.00028, 0.00045), [])

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity =
        1.05 + stage.flash * 1.9 + stage.beat * 0.18 + stage.finale * 0.15
    }
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={setBloom}
        intensity={0.88}
        luminanceThreshold={0.58}
        luminanceSmoothing={0.28}
        mipmapBlur
      />
      {/* DepthOfField removed: the "giji-biji" blur is gone — sharp 4K feed */}
      <ChromaticAberration
        offset={ca}
        radialModulation
        modulationOffset={0.35}
      />
      <Noise opacity={0.038} blendFunction={BlendFunction.SCREEN} />
      <Vignette eskil={false} offset={0.16} darkness={0.92} />
    </EffectComposer>
  )
}

/* ------------------------------------------------------------------ */
/* Flash light                                                        */
/* ------------------------------------------------------------------ */

function FlashLight() {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    if (light.current) {
      light.current.intensity = stage.flash * 2.4
    }
  })
  return (
    <pointLight
      ref={light}
      position={[0, 58, -80]}
      color="#ffe0b0"
      intensity={0}
      distance={700}
      decay={0.6}
    />
  )
}

/* ------------------------------------------------------------------ */
/* World                                                              */
/* ------------------------------------------------------------------ */

function World() {
  return (
    <>
      <fog attach="fog" args={['#070b14', 130, 1150]} />
      <ambientLight intensity={0.3} color="#3a4a72" />
      <hemisphereLight args={['#2b3a5c', '#0a0b12', 0.68]} />
      <directionalLight
        position={[60, 90, 20]}
        color="#8ea6d8"
        intensity={0.55}
      />

      <Sky />
      <Ghat />
      <DiyaField count={QUALITY.diyas} />
      <HeroGlow />
      <Rangoli />
      <Lotus />
      <City />
      <Lanterns />
      <FlashLight />
      <FireworksSystem />
      <Sweets />
      <TextMorphParticles />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Experience                                                         */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const started = useRef(false)

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      stage.pointerX = (e.clientX / window.innerWidth) * 2 - 1
      stage.pointerY = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    // Dev-only bridge for QA (seeks late-film beats without waiting 75s)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __stage?: unknown; __seek?: (s: number) => void }).__stage =
        stage
      ;(
        window as unknown as { __stage?: unknown; __seek?: (s: number) => void }
      ).__seek = (s: number) => {
        seekTimeline(s)
      }
    }

    const offBeat = beats.on((_time, index) => {
      stage.beat = 1
      const textShowing = stage.textIn > 0.02 && stage.textOut < 0.9
      if (stage.act >= 4 && stage.fireworks > 0.15 && !textShowing) {
        fx.burstRandom?.(index % 3 === 0)
      }
    })

    let raf = 0
    const boot = () => {
      if (started.current) return
      started.current = true
      void beats.load()
      startTimeline()
      beats.reset(0)
      fadeInAudio(2000)
      setUI({ ready: true, phase: 'experience' })
      fx.clear?.()
    }
    raf = window.setTimeout(boot, 650)

    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.clearTimeout(raf)
      offBeat()
      beats.stop()
    }
  }, [])

  return (
    <Canvas
      dpr={[1, QUALITY.dprCap]}
      camera={{ fov: 36, near: 0.08, far: 1600, position: [0, 2.46, 1.55] }}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#070b14')
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.2
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <CameraRig />
      <World />
      {QUALITY.post ? <Post /> : null}
    </Canvas>
  )
}
