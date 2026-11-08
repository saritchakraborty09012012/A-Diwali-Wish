import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flameFragment, flameVertex } from '../shaders/flame.glsl'
import { generateDiyas, HERO } from '../lib/world'
import { stage } from '../lib/stage'
import { glowTexture } from '../lib/textures'

function makeBowlGeometry(): THREE.LatheGeometry {
  const profile: Array<[number, number]> = [
    [0.0, 0.0],
    [0.14, 0.0],
    [0.235, 0.025],
    [0.30, 0.085],
    [0.335, 0.165],
    [0.35, 0.235],
    [0.33, 0.235],
    [0.305, 0.185],
    [0.275, 0.115],
    [0.215, 0.06],
    [0.09, 0.038],
    [0.0, 0.036],
  ]
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y))
  const geo = new THREE.LatheGeometry(points, 26)
  geo.computeVertexNormals()
  return geo
}

function makeFlameGeometry(
  count: number,
  data: ReturnType<typeof generateDiyas>,
): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  geo.setAttribute('uv', base.attributes.uv)

  const pos = new Float32Array(count * 3)
  const scale = new Float32Array(count)
  const phase = new Float32Array(count)
  const ignite = new Float32Array(count)
  const on = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const d = data[i]
    pos[i * 3 + 0] = d.x
    pos[i * 3 + 1] = d.y + 0.16
    pos[i * 3 + 2] = d.z
    scale[i] = 0.62 * d.scale
    phase[i] = d.phase
    ignite[i] = d.ignite
    on[i] = d.on
  }

  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3))
  geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(scale, 1))
  geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(phase, 1))
  geo.setAttribute('iIgnite', new THREE.InstancedBufferAttribute(ignite, 1))
  geo.setAttribute('iOn', new THREE.InstancedBufferAttribute(on, 1))
  geo.instanceCount = count
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400)
  return geo
}

export function DiyaField({ count }: { count: number }) {
  const data = useMemo(() => generateDiyas(count), [count])
  const bowlRef = useRef<THREE.InstancedMesh>(null)

  const bowlGeo = useMemo(() => makeBowlGeometry(), [])
  const bowlMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7c3b21',
        roughness: 0.82,
        metalness: 0.06,
        emissive: new THREE.Color('#401000'),
        emissiveIntensity: 0.85,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const flameGeo = useMemo(() => makeFlameGeometry(data.length, data), [data])
  const flameMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flameVertex,
        fragmentShader: flameFragment,
        uniforms: {
          uTime: { value: 0 },
          uIgnition: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = bowlRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      e.set(0, d.phase * Math.PI * 2, 0)
      q.setFromEuler(e)
      s.setScalar(d.scale)
      p.set(d.x, d.y, d.z)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [data])

  useFrame(({ clock }) => {
    flameMaterial.uniforms.uTime.value = clock.elapsedTime
    flameMaterial.uniforms.uIgnition.value = stage.diya
  })

  useEffect(() => {
    return () => {
      bowlGeo.dispose()
      bowlMat.dispose()
      flameGeo.dispose()
      flameMaterial.dispose()
    }
  }, [bowlGeo, bowlMat, flameGeo, flameMaterial])

  return (
    <group>
      <instancedMesh
        ref={bowlRef}
        args={[bowlGeo, bowlMat, data.length]}
        frustumCulled={false}
      />
      <mesh
        geometry={flameGeo}
        material={flameMaterial}
        frustumCulled={false}
        renderOrder={5}
      />
    </group>
  )
}

export function HeroGlow() {
  const sprite = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    if (!sprite.current) return
    const pulse = 0.92 + Math.sin(clock.elapsedTime * 6.2) * 0.06 + Math.sin(clock.elapsedTime * 2.1) * 0.04
    const grow = 1 + stage.intro * 1.9
    sprite.current.scale.set(3.4 * grow * pulse, 3.4 * grow * pulse, 1)
    const mat = sprite.current.material as THREE.SpriteMaterial
    mat.opacity = 0.28 + stage.intro * 0.62
  })

  return (
    <sprite
      ref={sprite}
      position={[HERO.x, HERO.y + 0.34, HERO.z]}
      renderOrder={6}
    >
      <spriteMaterial
        map={glowTexture()}
        color="#ffb347"
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.5}
      />
    </sprite>
  )
}
