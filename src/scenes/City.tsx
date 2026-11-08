import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'
import { WORLD } from '../config'
import { glowTexture } from '../lib/textures'

/* ------------------------------------------------------------------ */
/* Deterministic random                                               */
/* ------------------------------------------------------------------ */

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* Buildings — instanced beveled boxes with a facade shader.           */
/*                                                                     */
/* The layout is a Diwali bazaar: a clear central avenue running from  */
/* the ghat to the far temple, buildings in street rows on both sides, */
/* and a taller skyline ring behind. Grid-first ordering is what makes */
/* the city readable ("clarity") instead of a foggy blob.              */
/* ------------------------------------------------------------------ */

const buildingVertex = /* glsl */ `
  attribute float iSeed;
  attribute float iWave;

  varying vec3 vFace;
  varying float vSeed;
  varying float vWave;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  void main() {
    vec3 sc = vec3(
      length(instanceMatrix[0].xyz),
      length(instanceMatrix[1].xyz),
      length(instanceMatrix[2].xyz)
    );

    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(instanceMatrix) * normal);

    vFace = vec3(uv * vec2(sc.x + sc.z, sc.y), 0.0);
    vSeed = iSeed;
    vWave = iWave;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const buildingFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWave;
  uniform vec3 uFog;
  uniform float uDim;
  uniform float uFlash;

  varying vec3 vFace;
  varying float vSeed;
  varying float vWave;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    float roof = smoothstep(0.45, 0.85, n.y);

    /* street-facing facade coordinates (metres) */
    vec2 grid = vFace.xy * vec2(1.55, 1.15);
    vec2 cell = floor(grid);
    vec2 f = fract(grid);

    /* windows */
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.16, f.y) * step(f.y, 0.76);
    win *= 1.0 - roof;

    float r1 = hash(cell + vSeed * 61.73);
    float r2 = hash(cell * 1.71 + vSeed * 13.17);

    // rolling wave: closer buildings + luckier windows light earlier
    float threshold = vWave + r1 * 0.20;
    float on = step(threshold, uWave) * step(r2, 0.84);

    vec3 warmA = vec3(1.0, 0.60, 0.20);
    vec3 warmB = vec3(1.0, 0.86, 0.58);
    vec3 coolC = vec3(0.62, 0.74, 0.95);
    vec3 redC = vec3(0.95, 0.22, 0.16);
    vec3 windowColor = warmA;
    windowColor = mix(windowColor, warmB, step(0.55, r2));
    windowColor = mix(windowColor, coolC, step(0.83, r2) * step(r2, 0.90));
    windowColor = mix(windowColor, redC, step(0.90, r2));

    float flicker = 0.82 + 0.18 * sin(uTime * 2.3 + r1 * 44.0 + vSeed * 9.0);

    /* base plaster with vertical pilaster striping */
    float pil = 0.92 + 0.14 * step(0.5, fract(vFace.x * 0.16 + vSeed * 0.13));
    vec3 base = vec3(0.027, 0.033, 0.050) * pil;
    base *= 0.7 + 0.55 * max(0.0, n.y);

    vec3 col = base;
    col += windowColor * win * on * 3.6 * flicker;

    /* balcony railings: a bright line every few floors */
    float floorLine = step(0.94, f.y) * step(f.y, 0.985);
    float hasRail = step(0.45, r1) * step(r1, 0.80);
    col += warmB * floorLine * hasRail * on * 0.85 * (1.0 - roof);

    /* cornice at the top + marigold string under it */
    float crownBand = step(0.90, f.y) * step(0.30, r1) * on;
    col += warmB * crownBand * 0.5 * (1.0 - roof);
    float garland = smoothstep(0.86, 0.90, f.y) * step(0.10, r2) * on;
    col += vec3(1.0, 0.45, 0.08) * garland * 0.35 * (1.0 - roof);

    /* plinth: darker stone base, warm string line above it */
    float plinth = smoothstep(1.6, 0.4, vFace.y);
    col *= 1.0 - plinth * 0.55;
    float plinthLine = smoothstep(2.1, 1.6, vFace.y) * smoothstep(1.2, 1.6, vFace.y);
    col += vec3(1.0, 0.58, 0.22) * plinthLine * 0.65;

    col *= 1.0 - roof * 0.30;

    float dist = length(vWorld - cameraPosition);
    col = mix(col, uFog, smoothstep(150.0, 720.0, dist));

    /* gentle glow around the city core */
    col += vec3(0.032, 0.019, 0.006) * (1.0 - smoothstep(0.0, 260.0, dist)) * uWave;

    /* a firework flash really does light up the city */
    col += vec3(1.0, 0.72, 0.42) * uFlash * 0.30 * (1.0 - smoothstep(0.0, 380.0, dist));

    col *= 1.0 - uDim * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`

interface BuildingDatum {
  x: number
  y: number
  z: number
  sx: number
  sz: number
  sy: number
  rot: number
  seed: number
  wave: number
}

function generateBuildings(count: number): BuildingDatum[] {
  const rand = rng(0x1f2e3d)
  const list: BuildingDatum[] = []

  const push = (
    x: number,
    z: number,
    sy: number,
    sx: number,
    sz: number,
    rot = 0,
  ) => {
    const wave =
      Math.min(1, Math.hypot(x, z - WORLD.cityZ) / 320) * 0.82 + rand() * 0.12
    list.push({
      x,
      y: -0.4,
      z,
      sx,
      sz,
      sy,
      rot,
      seed: rand() * 100,
      wave: Math.min(1, wave),
    })
  }

  /* --- bazaar rows along the avenue --- */
  const bazaarBudget = Math.round(count * 0.55)
  let z = -56
  let guard = 0
  while (z > -262 && list.length < bazaarBudget && guard++ < 400) {
    const side = guard % 2 === 0 ? -1 : 1
    const slot = 11 + rand() * 10
    const x = side * (17 + slot * 0.55 + rand() * 4)
    if (rand() > 0.16) {
      const core = 1 - Math.min(1, Math.abs(z - WORLD.cityZ) / 240)
      const sy = 5 + Math.pow(rand(), 2.0) * (14 + core * 30)
      push(x, z - rand() * 4, sy, 4 + rand() * 7, 4 + rand() * 7, (rand() - 0.5) * 0.05)
    }
    z -= 6 + rand() * 7
  }

  /* --- skyline ring + far towers --- */
  while (list.length < count) {
    const angle = rand() * Math.PI * 2
    const radius = Math.pow(rand(), 0.6) * 330
    const x = Math.cos(angle) * radius * 1.18
    const zz = WORLD.cityZ - 30 + Math.sin(angle) * radius * 0.95
    if (zz > -50) continue
    // keep the avenue clear
    if (Math.abs(x) < 24 && zz > -300 && zz < -50) continue
    const core = 1 - Math.min(1, Math.hypot(x * 0.8, zz - WORLD.cityZ) / 300)
    const far = zz < -290 ? 1.6 : 1
    const sy = (4 + Math.pow(rand(), 2.1) * (16 + core * 36)) * far
    if (sy > 70 && rand() < 0.5) continue
    push(x, zz, sy, 3 + rand() * 8, 3 + rand() * 8, (rand() - 0.5) * 0.2)
  }

  return list
}

function Buildings({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const { data, geometry, material } = useMemo(() => {
    const list = generateBuildings(count)
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.035)
    const seeds = new Float32Array(list.length)
    const waves = new Float32Array(list.length)
    list.forEach((b, i) => {
      seeds[i] = b.seed
      waves[i] = b.wave
    })
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    geo.setAttribute('iWave', new THREE.InstancedBufferAttribute(waves, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: buildingVertex,
      fragmentShader: buildingFragment,
      uniforms: {
        uTime: { value: 0 },
        uWave: { value: 0 },
        uFog: { value: new THREE.Color('#070b14') },
        uDim: { value: 0 },
        uFlash: { value: 0 },
      },
    })
    return { data: list, geometry: geo, material: mat }
  }, [count])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const mat4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    data.forEach((b, i) => {
      e.set(0, b.rot, 0)
      q.setFromEuler(e)
      p.set(b.x, b.y + b.sy / 2, b.z)
      s.set(b.sx, b.sy, b.sz)
      mat4.compose(p, q, s)
      m.setMatrixAt(i, mat4)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [data])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uWave.value = stage.city
    material.uniforms.uDim.value = stage.dim
    material.uniforms.uFlash.value = stage.flash
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, data.length]}
      frustumCulled={false}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Facade dressing — parapets, water tanks, antennas, balconies        */
/* ------------------------------------------------------------------ */

function makeInstanceMatrix(
  items: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number }>,
): THREE.Matrix4[] {
  const mat4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  return items.map((it) => {
    e.set(0, it.rot, 0)
    q.setFromEuler(e)
    p.set(it.x, it.y, it.z)
    s.set(it.sx, it.sy, it.sz)
    return mat4.clone().compose(p, q, s)
  })
}

function InstancedBoxes({
  items,
  material,
  geometry,
}: {
  items: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number }>
  material: THREE.Material
  geometry: THREE.BufferGeometry
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const matrices = useMemo(() => makeInstanceMatrix(items), [items])
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [matrices])
  useEffect(() => () => {
    mesh.current?.dispose()
  }, [])
  return (
    <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false} />
  )
}

function useBoxGeometry(): THREE.BufferGeometry {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

function useStandardMaterial(opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(opts), [])
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}

const EMPTY_ITEM = { x: 0, y: -100, z: 0, sx: 0.001, sy: 0.001, sz: 0.001, rot: 0 }

function Dressing() {
  const box = useBoxGeometry()

  const rimMat = useStandardMaterial({
    color: '#1c1410',
    roughness: 0.6,
    metalness: 0.2,
    emissive: new THREE.Color('#ff9f1c'),
    emissiveIntensity: 0.55,
  })
  const tankMat = useStandardMaterial({
    color: '#14161c',
    roughness: 0.85,
    metalness: 0.15,
  })
  const poleMat = useStandardMaterial({
    color: '#0d0f14',
    roughness: 0.8,
    metalness: 0.3,
  })
  const slabMat = useStandardMaterial({
    color: '#151a22',
    roughness: 0.7,
    metalness: 0.1,
    emissive: new THREE.Color('#ff8c2e'),
    emissiveIntensity: 0.5,
  })

  const parts = useMemo(() => {
    const rand = rng(0x77aa)
    const list = generateBuildings(QUALITY.buildings)
    const rims: typeof EMPTY_ITEM[] = []
    const tanks: typeof EMPTY_ITEM[] = []
    const poles: typeof EMPTY_ITEM[] = []
    const slabs: typeof EMPTY_ITEM[] = []
    const slabCap = QUALITY.diyas + 380

    for (const b of list) {
      const top = b.y + b.sy
      rims.push({
        x: b.x,
        y: top + 0.16,
        z: b.z,
        sx: b.sx + 0.34,
        sy: 0.32,
        sz: b.sz + 0.34,
        rot: b.rot,
      })
      if (rand() < 0.42) {
        tanks.push({
          x: b.x + (rand() - 0.5) * b.sx * 0.4,
          y: top + 0.75,
          z: b.z + (rand() - 0.5) * b.sz * 0.4,
          sx: 0.55 + rand() * 0.4,
          sy: 1.1 + rand() * 0.8,
          sz: 0.55 + rand() * 0.4,
          rot: 0,
        })
      }
      if (rand() < 0.30) {
        poles.push({
          x: b.x + (rand() - 0.5) * b.sx * 0.5,
          y: top + 1.5,
          z: b.z + (rand() - 0.5) * b.sz * 0.5,
          sx: 0.07,
          sy: 2.4 + rand() * 2.2,
          sz: 0.07,
          rot: 0,
        })
      }
      // balconies on avenue buildings
      if (Math.abs(b.x) < 60 && b.sy > 8) {
        const face = b.x < 0 ? 1 : -1
        const floors = Math.floor(b.sy / 3.4)
        for (let f = 1; f <= floors; f++) {
          if (rand() < 0.36 || slabs.length >= slabCap) continue
          slabs.push({
            x: b.x + face * (b.sx / 2 + 0.55),
            y: b.y + f * 3.4,
            z: b.z + (rand() - 0.5) * b.sz * 0.3,
            sx: 1.15,
            sy: 0.16,
            sz: Math.min(b.sz * 0.6, 3.4),
            rot: 0,
          })
        }
      }
    }

    return { rims, tanks, poles, slabs }
  }, [])

  return (
    <group>
      <InstancedBoxes items={parts.rims} material={rimMat} geometry={box} />
      <InstancedBoxes items={parts.tanks} material={tankMat} geometry={box} />
      <InstancedBoxes items={parts.poles} material={poleMat} geometry={box} />
      <InstancedBoxes items={parts.slabs} material={slabMat} geometry={box} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* String lights along the avenue + street lamps                       */
/* ------------------------------------------------------------------ */

function StringLights() {
  const bulbsPerWire = QUALITY.dust > 800 ? 16 : 10

  const { bulbs, wires, poles, lampHeads, glowMat, wireMat } = useMemo(() => {
    const rand = rng(0x5eed)
    const bulbPos: number[] = []
    const wirePos: number[] = []
    const poleItems: typeof EMPTY_ITEM[] = []
    const headItems: typeof EMPTY_ITEM[] = []
    const poleXs = [-13.5, 13.5]
    const poleZs: number[] = []
    for (let z = -58; z > -245; z -= 21) poleZs.push(z)

    const glowMatLocal = new THREE.PointsMaterial({
      size: 1.9,
      sizeAttenuation: true,
      map: glowTexture(),
      color: '#ffbe6e',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    })

    for (const px of poleXs) {
      for (let i = 0; i < poleZs.length; i++) {
        const z = poleZs[i]
        poleItems.push({ x: px, y: 3.6, z, sx: 0.14, sy: 7.2, sz: 0.14, rot: 0 })
        headItems.push({ x: px, y: 7.3, z, sx: 0.7, sy: 0.7, sz: 0.7, rot: 0 })
        if (i === poleZs.length - 1) continue
        const z2 = poleZs[i + 1]
        const sag = 1.5 + rand() * 0.6
        const steps = 18
        for (let s = 0; s <= steps; s++) {
          const t = s / steps
          const y = 7.1 - Math.sin(t * Math.PI) * sag
          const zz = z + (z2 - z) * t
          wirePos.push(px, y, zz)
          if (s % Math.ceil(steps / bulbsPerWire) === 0) {
            bulbPos.push(px + (rand() - 0.5) * 0.1, y - 0.14, zz)
          }
        }
      }
    }

    const bulbGeo = new THREE.BufferGeometry()
    bulbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bulbPos), 3))
    bulbGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 12, -150), 400)
    const wireGeo = new THREE.BufferGeometry()
    wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wirePos), 3))

    const wireMat = new THREE.LineBasicMaterial({
      color: '#2a1c0e',
      transparent: true,
      opacity: 0.75,
    })

    return { bulbs: bulbGeo, wires: wireGeo, poles: poleItems, lampHeads: headItems, glowMat: glowMatLocal, wireMat }
  }, [bulbsPerWire])

  useEffect(() => () => {
    bulbs.dispose()
    wires.dispose()
    glowMat.dispose()
    wireMat.dispose()
  }, [bulbs, wires, glowMat, wireMat])

  /* a handful of real warm lights so the avenue needs no fake */
  const lampLights = useMemo(
    () => [[-13, -90], [13, -130], [-13, -170], [13, -205], [-13, -235], [13, -65]],
    [],
  )

  const poleMat = useStandardMaterial({ color: '#0d0f14', roughness: 0.8, metalness: 0.35 })
  const headMat = useStandardMaterial({
    color: '#3a2a12',
    roughness: 0.4,
    metalness: 0.2,
    emissive: new THREE.Color('#ffc27a'),
    emissiveIntensity: 2.6,
  })
  const box = useBoxGeometry()

  return (
    <group>
      <InstancedBoxes items={poles} material={poleMat} geometry={box} />
      <InstancedBoxes items={lampHeads} material={headMat} geometry={box} />
      <lineSegments geometry={wires} material={wireMat} />
      <points geometry={bulbs} material={glowMat} frustumCulled={false} renderOrder={5} />
      {lampLights.map(([x, z], i) => (
        <pointLight
          key={i}
          position={[x, 7.4, z]}
          color="#ffb25e"
          intensity={26}
          distance={46}
          decay={2}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Torana gateway at the ghat's back wall                              */
/* ------------------------------------------------------------------ */

function Torana() {
  const stone = useStandardMaterial({ color: '#12161f', roughness: 0.8, metalness: 0.15 })
  const gold = useStandardMaterial({
    color: '#8a5a18',
    roughness: 0.35,
    metalness: 0.85,
    emissive: new THREE.Color('#ffb347'),
    emissiveIntensity: 0.7,
  })
  const marigold = useStandardMaterial({
    color: '#b4480a',
    roughness: 0.7,
    emissive: new THREE.Color('#ff7a14'),
    emissiveIntensity: 1.4,
  })

  const garland = useMemo(() => {
    const items: typeof EMPTY_ITEM[] = []
    // two hanging garland swags across the beam
    for (let span = 0; span < 2; span++) {
      const x0 = span === 0 ? -9.4 : 0.3
      const x1 = span === 0 ? -0.3 : 9.4
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        const x = x0 + (x1 - x0) * t
        const y = 7.6 - Math.sin(t * Math.PI) * 1.1
        items.push({ x, y, z: -49.2, sx: 0.34, sy: 0.34, sz: 0.34, rot: 0 })
      }
    }
    // diya row along the beam front
    for (let x = -9; x <= 9; x += 1.3) {
      items.push({ x, y: 8.15, z: -49.2, sx: 0.3, sy: 0.3, sz: 0.3, rot: 0 })
    }
    return items
  }, [])

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.17, 8, 6), [])
  useEffect(() => () => sphereGeo.dispose(), [sphereGeo])

  return (
    <group>
      <mesh material={stone} position={[-9.7, 3.6, -49.4]} scale={[1.6, 7.2, 1.6]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={stone} position={[9.7, 3.6, -49.4]} scale={[1.6, 7.2, 1.6]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={stone} position={[0, 7.6, -49.4]} scale={[21, 1.3, 1.7]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={gold} position={[0, 8.6, -49.4]} scale={[21.5, 0.35, 1.8]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {garland.map((g, i) => (
        <mesh key={i} geometry={sphereGeo} material={marigold} position={[g.x, g.y, g.z]} />
      ))}
      <pointLight position={[0, 7.2, -47]} color="#ff9f1c" intensity={30} distance={34} decay={2} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Temples — stepped vimana, gold kalash, flanking domes               */
/* ------------------------------------------------------------------ */

function makeShikhara(): THREE.LatheGeometry {
  const profile = [
    [0.001, 0],
    [1.05, 0.04],
    [1.12, 0.6],
    [0.92, 1.5],
    [0.62, 2.5],
    [0.34, 3.4],
    [0.16, 4.1],
    [0.08, 4.5],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(profile, 16)
}

function Temples() {
  const shikhara = useMemo(() => makeShikhara(), [])
  const stone = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#12161f',
        roughness: 0.85,
        metalness: 0.1,
        emissive: new THREE.Color('#2a1404'),
        emissiveIntensity: 0.55,
      }),
    [],
  )
  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8a5a18',
        roughness: 0.35,
        metalness: 0.85,
        emissive: new THREE.Color('#ffb347'),
        emissiveIntensity: 0.9,
      }),
    [],
  )
  const dome = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a26',
        roughness: 0.6,
        metalness: 0.35,
        emissive: new THREE.Color('#5a3210'),
        emissiveIntensity: 0.35,
      }),
    [],
  )

  const temples = useMemo(
    () => [
      { x: 0, z: -150, s: 7.0, h: 1.15 },
      { x: -34, z: -118, s: 3.4, h: 1.0 },
      { x: 40, z: -92, s: 3.8, h: 1.05 },
      { x: -72, z: -92, s: 2.9, h: 0.9 },
      { x: 78, z: -104, s: 3.4, h: 1 },
      { x: 16, z: -118, s: 3.1, h: 0.92 },
      { x: -32, z: -196, s: 3.0, h: 0.95 },
      { x: 30, z: -210, s: 2.8, h: 0.9 },
    ],
    [],
  )

  useEffect(() => () => {
    shikhara.dispose()
    stone.dispose()
    gold.dispose()
    dome.dispose()
  }, [shikhara, stone, gold, dome])

  return (
    <group>
      {temples.map((t, i) => (
        <group key={i} position={[t.x, -0.4, t.z]} scale={t.s}>
          <mesh material={stone} position={[0, 0.7, 0]}>
            <boxGeometry args={[3.2, 1.4, 3.2]} />
          </mesh>
          <mesh material={stone} position={[0, 1.7, 0]}>
            <boxGeometry args={[2.6, 0.7, 2.6]} />
          </mesh>
          {/* stepped vimana */}
          <mesh
            geometry={shikhara}
            material={stone}
            position={[0, 2.05, 0]}
            scale={[1, t.h * 1.5, 1]}
          />
          <mesh
            geometry={shikhara}
            material={stone}
            position={[0, 2.05 + t.h * 1.5 * 2.2, 0]}
            scale={[0.62, t.h * 0.95, 0.62]}
          />
          <mesh material={gold} position={[0, 2.05 + t.h * 1.5 * 4.5, 0]}>
            <sphereGeometry args={[0.22, 10, 8]} />
          </mesh>
          {/* trishul finial */}
          <mesh material={gold} position={[0, 2.05 + t.h * 1.5 * 4.5 + 0.5, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.9, 6]} />
          </mesh>
          {/* small flanking domes */}
          <mesh material={dome} position={[-1.9, 1.55, 0.4]} scale={[1, 0.7, 1]}>
            <sphereGeometry args={[0.55, 12, 10]} />
          </mesh>
          <mesh material={dome} position={[1.9, 1.55, -0.4]} scale={[1, 0.7, 1]}>
            <sphereGeometry args={[0.55, 12, 10]} />
          </mesh>
          {(i === 0 || i === 1) && (
            <pointLight
              position={[0, 1.2, 1.6]}
              color="#ffb347"
              intensity={7}
              distance={13}
              decay={2}
            />
          )}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Ground — wet basalt plaza, avenue baked in                          */
/* ------------------------------------------------------------------ */

function makeGroundTexture(): THREE.CanvasTexture {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#0a0d14'
  ctx.fillRect(0, 0, S, S)

  // warm core glow
  const glow = ctx.createRadialGradient(S / 2, S * 0.36, 30, S / 2, S * 0.36, S * 0.55)
  glow.addColorStop(0, 'rgba(255,140,50,0.10)')
  glow.addColorStop(1, 'rgba(255,140,50,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)

  // paver speckle
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const warm = Math.random() < 0.6
    ctx.fillStyle = warm
      ? `rgba(255,${150 + Math.random() * 60 | 0},70,${0.02 + Math.random() * 0.05})`
      : `rgba(150,170,220,${0.015 + Math.random() * 0.04})`
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }

  // avenue strip (x centre of the plane)
  const av = ctx.createLinearGradient(S * 0.47, 0, S * 0.53, 0)
  av.addColorStop(0, 'rgba(70,52,30,0)')
  av.addColorStop(0.5, 'rgba(120,84,40,0.22)')
  av.addColorStop(1, 'rgba(70,52,30,0)')
  ctx.fillStyle = av
  ctx.fillRect(S * 0.47, 0, S * 0.06, S)

  // paver seams
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 32; i++) {
    ctx.beginPath()
    ctx.moveTo((i / 32) * S, 0)
    ctx.lineTo((i / 32) * S, S)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, (i / 32) * S)
    ctx.lineTo(S, (i / 32) * S)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.anisotropy = 4
  return tex
}

function CityGround() {
  const tex = useMemo(() => makeGroundTexture(), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex,
        color: '#aab4cc',
        roughness: 0.55,
        metalness: 0.25,
      }),
    [tex],
  )
  useEffect(() => () => {
    tex.dispose()
    mat.dispose()
  }, [tex, mat])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.45, -230]} material={mat}>
      <planeGeometry args={[900, 460]} />
    </mesh>
  )
}

export function City() {
  return (
    <group>
      <CityGround />
      <Buildings count={QUALITY.buildings} />
      <Dressing />
      <StringLights />
      <Torana />
      <Temples />
    </group>
  )
}
