import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { stage } from '../lib/stage'
import { QUALITY } from '../lib/device'

const lanternVertex = /* glsl */ `
  attribute vec3 iPos;
  attribute float iPhase;
  attribute float iSpeed;
  attribute float iScale;
  attribute float iTint;

  uniform float uTime;
  uniform float uTimeScale;
  uniform float uReveal;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vTint;

  void main() {
    vUv = uv;
    vTint = iTint;

    float life = 150.0;
    float t = mod(uTime * iSpeed * uTimeScale + iPhase * life, life);

    vec3 p = iPos;
    p.y += t * 0.46;
    p.x += sin(t * 0.11 + iPhase * 6.2831) * 3.6;
    p.z += cos(t * 0.09 + iPhase * 4.1) * 3.2;

    vec3 toCam = cameraPosition - p;
    toCam.y = 0.0;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(0.0001))));

    float s = iScale;
    vec3 worldPos = p + right * position.x * s + vec3(0.0, position.y * s, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);

    float stagger = smoothstep(iPhase * 0.35, iPhase * 0.35 + 0.35, uReveal);
    float fadeIn = smoothstep(0.0, 4.0, t);
    float fadeOut = 1.0 - smoothstep(life - 18.0, life, t);
    vAlpha = stagger * fadeIn * fadeOut;
  }
`

const lanternFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vTint;

  void main() {
    if (vAlpha < 0.004) discard;

    vec2 p = vUv - 0.5;

    float bodyWidth = 0.185 * (1.0 - 0.45 * abs(p.y) * 2.0);
    float body = 1.0 - smoothstep(bodyWidth * 0.72, bodyWidth, abs(p.x));
    body *= 1.0 - smoothstep(0.30, 0.37, abs(p.y));

    float top = smoothstep(0.26, 0.31, p.y) * (1.0 - smoothstep(0.34, 0.385, p.y));
    float bottom = smoothstep(-0.26, -0.31, p.y) * (1.0 - smoothstep(-0.34, -0.385, p.y));

    vec3 warm = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.82, 0.48), vTint);
    vec3 col = warm * body;
    col = mix(col, vec3(1.0, 0.62, 0.22), top);
    col = mix(col, vec3(0.9, 0.35, 0.08), bottom);

    float core = exp(-length(p * vec2(2.6, 2.2)) * 3.2);
    col += vec3(1.0, 0.78, 0.42) * core * 0.9;

    float flicker = 0.86 + 0.14 * sin(uTime * 5.0 + vUv.x * 9.0 + vTint * 30.0);
    float alpha = (body * 0.92 + core * 0.5) * vAlpha * flicker;

    gl_FragColor = vec4(col * alpha * 1.5, alpha);
  }
`

export function Lanterns() {
  const count = QUALITY.lanterns

  const { geometry, material } = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.attributes.position)
    geo.setAttribute('uv', base.attributes.uv)

    const pos = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const scale = new Float32Array(count)
    const tint = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 280
      pos[i * 3 + 1] = 2 + Math.random() * 14
      pos[i * 3 + 2] = -210 + Math.random() * 230
      phase[i] = Math.random()
      speed[i] = 0.5 + Math.random() * 0.8
      scale[i] = 1.1 + Math.random() * 1.7
      tint[i] = Math.random()
    }

    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(phase, 1))
    geo.setAttribute('iSpeed', new THREE.InstancedBufferAttribute(speed, 1))
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(scale, 1))
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 1))
    geo.instanceCount = count
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 40, -90), 400)

    const mat = new THREE.ShaderMaterial({
      vertexShader: lanternVertex,
      fragmentShader: lanternFragment,
      uniforms: {
        uTime: { value: 0 },
        uTimeScale: { value: 1 },
        uReveal: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [count])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uReveal.value = stage.lantern
    material.uniforms.uTimeScale.value = stage.timeScale
  })

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={4}
    />
  )
}
