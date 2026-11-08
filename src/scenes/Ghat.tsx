import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GHAT, reflectionLights, stepTopY, stepZ } from '../lib/world'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'
import { WORLD } from '../config'
import { makeWaterFragment, waterVertex } from '../shaders/water.glsl'
import { rayTexture, smokeTexture } from '../lib/textures'

/* ------------------------------------------------------------------ */
/* Stone                                                              */
/* ------------------------------------------------------------------ */

function Steps() {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#191c23',
        roughness: 0.78,
        metalness: 0.12,
      }),
    [],
  )
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])

  return (
    <group>
      {Array.from({ length: GHAT.steps }).map((_, i) => {
        const top = stepTopY(i)
        const height = top + 4.4
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[0, top - height / 2, stepZ(i)]}
            scale={[GHAT.width, height, GHAT.stepDepth + 0.03]}
          />
        )
      })}
      {/* terrace */}
      <mesh
        geometry={geo}
        material={mat}
        position={[0, WORLD.terraceY - 3.2, -13.5]}
        scale={[84, 6.4, 27]}
      />
      {/* low parapet along the back */}
      <mesh
        geometry={geo}
        material={mat}
        position={[0, WORLD.terraceY + 0.42, -26.4]}
        scale={[84, 0.85, 1.1]}
      />
      {/* two long side walls to frame the ghat */}
      <mesh
        geometry={geo}
        material={mat}
        position={[-27, WORLD.terraceY - 0.4, -12]}
        scale={[1.2, 5, 29]}
      />
      <mesh
        geometry={geo}
        material={mat}
        position={[27, WORLD.terraceY - 0.4, -12]}
        scale={[1.2, 5, 29]}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Water                                                              */
/* ------------------------------------------------------------------ */

function Water() {
  const lights = useMemo(() => reflectionLights(QUALITY.waterLights), [])

  const material = useMemo(() => {
    const vectors = Array.from({ length: QUALITY.waterLights }, (_, i) => {
      const l = lights[i]
      return l ? new THREE.Vector3(l[0], l[1], l[2]) : new THREE.Vector3(0, -999, 0)
    })
    return new THREE.ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: makeWaterFragment(QUALITY.waterLights),
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#04060c') },
        uShallow: { value: new THREE.Color('#0a1220') },
        uFog: { value: new THREE.Color('#070b14') },
        uLights: { value: vectors },
        uLightCount: { value: lights.length },
        uOpacity: { value: 1 },
        uGlow: { value: 1 },
      },
    })
  }, [lights])

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uGlow.value = 0.35 + stage.diya * 0.85
  })

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, WORLD.waterY, 100]}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    >
      <planeGeometry args={[520, 190, 1, 1]} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Rising embers / dust                                               */
/* ------------------------------------------------------------------ */

const emberVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float life = 16.0;
    float t = mod(uTime * aSpeed + aPhase * life, life);
    vec3 p = position;
    p.x += sin(t * 0.55 + aPhase * 6.283) * 1.1;
    p.z += cos(t * 0.42 + aPhase * 4.1) * 0.9;
    p.y += t * 0.55;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio * (42.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;

    float fadeIn = smoothstep(0.0, 1.6, t);
    float fadeOut = 1.0 - smoothstep(life * 0.5, life, t);
    float twinkle = 0.65 + 0.35 * sin(uTime * 5.0 + aPhase * 30.0);
    vAlpha = fadeIn * fadeOut * twinkle * uOpacity;
  }
`

const emberFragment = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.58, 0.18) * a * vAlpha, a * vAlpha);
  }
`

function Embers() {
  const count = QUALITY.embers

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70
      pos[i * 3 + 1] = -1.5 + Math.random() * 26
      pos[i * 3 + 2] = -40 + Math.random() * 60
      phase[i] = Math.random()
      speed[i] = 0.55 + Math.random() * 0.9
      size[i] = 0.8 + Math.random() * 2.4
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: emberVertex,
        fragmentShader: emberFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(QUALITY.dprCap, 2) },
          uOpacity: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uOpacity.value =
      0.25 + stage.diya * 0.75 + stage.finale * 0.25
  })

  return (
    <points geometry={geometry} material={material} frustumCulled={false} />
  )
}

/* ------------------------------------------------------------------ */
/* Smoke                                                              */
/* ------------------------------------------------------------------ */

function Smoke() {
  const group = useRef<THREE.Group>(null)
  const texture = useMemo(() => smokeTexture(), [])
  const planes = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => ({
        pos: [
          (Math.random() - 0.5) * 46,
          1.5 + Math.random() * 7,
          2 + Math.random() * 18,
        ] as [number, number, number],
        scale: 12 + Math.random() * 16,
        rot: Math.random() * Math.PI,
        speed: 0.02 + Math.random() * 0.04,
        seed: i * 1.7,
      })),
    [],
  )

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      const p = planes[i]
      child.rotation.z = p.rot + Math.sin(clock.elapsedTime * p.speed * 6 + p.seed) * 0.08
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity = (0.10 + 0.10 * Math.sin(clock.elapsedTime * 0.25 + p.seed)) * stage.smoke
    })
  })

  return (
    <group ref={group}>
      {planes.map((p, i) => (
        <mesh key={i} position={p.pos} scale={[p.scale, p.scale * 0.8, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.12}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            color="#c9b9a4"
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Fake god rays                                                      */
/* ------------------------------------------------------------------ */

function GodRays() {
  const group = useRef<THREE.Group>(null)
  const texture = useMemo(() => rayTexture(), [])
  const shafts = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        x: -18 + i * 7.2 + (Math.random() - 0.5) * 3,
        z: -34 - Math.random() * 12,
        w: 2.4 + Math.random() * 2.6,
        h: 34 + Math.random() * 18,
        rot: -0.34 + Math.random() * 0.12,
        phase: Math.random() * 6.28,
      })),
    [],
  )

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      const s = shafts[i]
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity =
        (0.10 + 0.05 * Math.sin(clock.elapsedTime * 0.3 + s.phase)) *
        stage.godray *
        (0.35 + stage.city * 0.65)
    })
  })

  return (
    <group ref={group}>
      {shafts.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, 17, s.z]}
          rotation={[0, 0, s.rot]}
          scale={[s.w, s.h, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            color="#ffcf8a"
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Warm light from the diyas                                          */
/* ------------------------------------------------------------------ */

function GhatLights() {
  const refs = useRef<Array<THREE.PointLight | null>>([])
  const spots: Array<[number, number, number]> = [
    [0, 2.6, 2.2],
    [-7, 1.2, 5.4],
    [7, 0.7, 6.2],
    [-3, 2.4, -8],
    [4, 2.4, -13],
  ]

  useFrame(({ clock }) => {
    const flick = 0.88 + Math.sin(clock.elapsedTime * 5.1) * 0.06 + Math.sin(clock.elapsedTime * 11.3) * 0.03
    refs.current.forEach((l, i) => {
      if (!l) return
      l.intensity = stage.diya * (46 + i * 6) * flick
    })
  })

  return (
    <group>
      {spots.map((p, i) => (
        <pointLight
          key={i}
          ref={(node) => {
            refs.current[i] = node
          }}
          position={p}
          color={i % 2 === 0 ? '#ff9f1c' : '#ffb347'}
          intensity={0}
          distance={34}
          decay={2}
        />
      ))}
    </group>
  )
}

export function Ghat() {
  return (
    <group>
      <Steps />
      <Water />
      <Embers />
      <Smoke />
      <GodRays />
      <GhatLights />
    </group>
  )
}
