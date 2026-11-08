import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { WORLD } from '../config'
import { glowTexture } from '../lib/textures'

function makePetalGeometry(): THREE.BufferGeometry {
  const segU = 12
  const segV = 7
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segU; i++) {
    const u = i / segU
    const width =
      Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.72) * 0.36
    for (let j = 0; j <= segV; j++) {
      const v = j / segV
      const x = (v - 0.5) * 2 * width
      const y = u
      // gentle outward cup + a fine central crease
      const z =
        Math.sin(u * Math.PI) * 0.16 +
        Math.abs(v - 0.5) * 0.09 * Math.sin(u * Math.PI)
      positions.push(x, y, z)
      uvs.push(v, u)
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j
      const b = a + segV + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

interface PetalSpec {
  angle: number
  length: number
  closed: number
  open: number
  radius: number
  delay: number
}

export function Lotus() {
  const root = useRef<THREE.Group>(null)
  const petalRefs = useRef<Array<THREE.Group | null>>([])
  const coreRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const glowRef = useRef<THREE.Sprite>(null)

  const geometry = useMemo(() => makePetalGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d97a52',
        roughness: 0.52,
        metalness: 0.08,
        emissive: new THREE.Color('#ff5e14'),
        emissiveIntensity: 0.42,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const petals = useMemo<PetalSpec[]>(() => {
    const rings = [
      { count: 12, length: 1.9, closed: -0.14, open: 1.34, radius: 0.24, base: 0 },
      { count: 10, length: 1.42, closed: -0.26, open: 1.06, radius: 0.19, base: 0.1 },
      { count: 8, length: 0.96, closed: -0.4, open: 0.74, radius: 0.14, base: 0.2 },
    ]
    const out: PetalSpec[] = []
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.count; i++) {
        out.push({
          angle: (i / ring.count) * Math.PI * 2 + ri * 0.24,
          length: ring.length,
          closed: ring.closed,
          open: ring.open,
          radius: ring.radius,
          delay: ring.base + (i % 4) * 0.03,
        })
      }
    })
    return out
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock }) => {
    const t = stage.lotus
    const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)

    petalRefs.current.forEach((petal, i) => {
      if (!petal) return
      const spec = petals[i]
      const local = ease((t - spec.delay) / (1 - spec.delay + 0.0001))
      const sway = Math.sin(clock.elapsedTime * 0.9 + i * 0.7) * 0.035 * t
      petal.rotation.x = THREE.MathUtils.lerp(spec.closed, spec.open, local) + sway
      petal.rotation.z = Math.sin(clock.elapsedTime * 0.7 + i) * 0.02 * t
    })

    if (root.current) {
      const s = 0.6 + t * 0.4
      root.current.scale.setScalar(s)
      root.current.rotation.y = clock.elapsedTime * 0.045
    }
    if (lightRef.current) {
      lightRef.current.intensity = 6 + t * 26 + Math.sin(clock.elapsedTime * 2.2) * 2
    }
    if (coreRef.current) {
      const m = coreRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.8 + t * 1.6
    }
    if (glowRef.current) {
      const g = 0.5 + t * 1.4
      glowRef.current.scale.set(g, g, 1)
      const m = glowRef.current.material as THREE.SpriteMaterial
      m.opacity = 0.25 + t * 0.55
    }
  })

  return (
    <group position={[0, WORLD.terraceY + 0.02, WORLD.rangoliZ]}>
      <group ref={root}>
        {petals.map((spec, i) => (
          <group key={i} rotation-y={spec.angle}>
            <group
              position={[0, 0, spec.radius]}
              ref={(node) => {
                petalRefs.current[i] = node
              }}
            >
              <mesh
                geometry={geometry}
                material={material}
                scale={[spec.length * 0.85, spec.length, spec.length * 0.85]}
              />
            </group>
          </group>
        ))}
        <mesh ref={coreRef} position={[0, 0.14, 0]}>
          <sphereGeometry args={[0.2, 20, 16]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffae3a"
            emissiveIntensity={1.2}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
        <sprite ref={glowRef} position={[0, 0.32, 0]} scale={[1, 1, 1]}>
          <spriteMaterial
            map={glowTexture()}
            color="#ffc46b"
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.5}
          />
        </sprite>
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.9, 0]}
        color="#ffb347"
        intensity={8}
        distance={26}
        decay={2}
      />
    </group>
  )
}
