import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { WORLD } from '../config'
import { rangoliFragment, rangoliVertex } from '../shaders/rangoli.glsl'

const powderVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;

  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float head = uProgress * 1.16;
    float d = head - aRadius;

    float onPulse = smoothstep(-0.02, 0.06, d) * (1.0 - smoothstep(0.0, 0.5, d));
    float pop = sin(clamp(d * 18.0, 0.0, 3.14159)) * 0.16;

    float radius = aRadius * 5.0;
    vec3 p = vec3(cos(aAngle) * radius, 0.03 + pop, sin(aAngle) * radius);
    p.x += sin(uTime * 1.6 + aPhase * 6.28) * 0.05 * onPulse;
    p.z += cos(uTime * 1.4 + aPhase * 5.1) * 0.05 * onPulse;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio * (46.0 / max(1.0, -mv.z)) * (0.6 + onPulse);
    gl_Position = projectionMatrix * mv;

    vColor = aColor;
    vAlpha = onPulse * uOpacity * (0.55 + 0.45 * sin(uTime * 8.0 + aPhase * 20.0));
  }
`

const powderFragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    if (a < 0.01 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor * a * vAlpha * 1.6, a * vAlpha);
  }
`

function Powder({ count = 900 }: { count?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const angle = new Float32Array(count)
    const radius = new Float32Array(count)
    const size = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const palette = [
      new THREE.Color('#ffd166'),
      new THREE.Color('#ff9f1c'),
      new THREE.Color('#c1121f'),
      new THREE.Color('#f4e9d8'),
    ]
    for (let i = 0; i < count; i++) {
      angle[i] = Math.random() * Math.PI * 2
      radius[i] = 0.04 + Math.random() * 1.1
      size[i] = 0.8 + Math.random() * 2.6
      phase[i] = Math.random()
      const c = palette[Math.floor(Math.random() * palette.length)]
      color[i * 3] = c.r
      color[i * 3 + 1] = c.g
      color[i * 3 + 2] = c.b
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1))
    g.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: powderVertex,
        fragmentShader: powderFragment,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uPixelRatio: { value: 1.6 },
          uOpacity: { value: 0 },
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
    material.uniforms.uProgress.value = stage.rangoli
    material.uniforms.uOpacity.value = Math.min(1, stage.rangoli * 5)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

export function Rangoli() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rangoliVertex,
        fragmentShader: rangoliFragment,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uOpacity: { value: 1 },
          uBeat: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uProgress.value = stage.rangoli
    material.uniforms.uBeat.value = stage.beat
    material.uniforms.uOpacity.value = Math.max(0, Math.min(1, stage.rangoli * 8))
  })

  return (
    <group position={[0, WORLD.terraceY + 0.012, WORLD.rangoliZ]}>
      <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={2}>
        <planeGeometry args={[10.2, 10.2]} />
      </mesh>
      <group position={[0, 0.01, 0]}>
        <Powder />
      </group>
    </group>
  )
}
