/**
 * Ganga water — custom ShaderMaterial.
 * Deep ink-blue base, animated ripples, moon glints, and fake reflection
 * streaks for the nearest diyas (a stretched, noise-wobbled light pool
 * under every flame). No render targets, no double scene render.
 */

export const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export function makeWaterFragment(maxLights: number): string {
  return /* glsl */ `
  precision highp float;

  #define MAX_LIGHTS ${maxLights}

  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFog;
  uniform vec3 uLights[MAX_LIGHTS];
  uniform int uLightCount;
  uniform float uOpacity;
  uniform float uGlow;

  varying vec3 vWorld;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * noise(p);
      p *= 2.07;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz;
    float dist = length(vWorld - cameraPosition);

    // large slow swell + small ripples
    float swell = sin(p.y * 0.16 - uTime * 0.55) * 0.5
                + sin(p.x * 0.11 + uTime * 0.37) * 0.5;
    float ripple = fbm(p * 1.4 + vec2(uTime * 0.35, -uTime * 0.22));
    float micro = sin(p.x * 3.1 + uTime * 1.9 + ripple * 3.0)
                * sin(p.y * 2.6 - uTime * 1.4 + ripple * 2.0);

    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 70.0, dist));
    col += vec3(0.030, 0.020, 0.010) * (swell * 0.5 + 0.5);

    // horizon warmth from the ghat
    col += vec3(0.055, 0.030, 0.012) * (1.0 - smoothstep(0.0, 90.0, dist));

    // moon / sky sparkle
    float glint = pow(max(0.0, micro), 16.0);
    glint *= 1.0 - smoothstep(10.0, 120.0, dist);
    col += vec3(1.0, 0.86, 0.62) * glint * 0.55;

    // fake reflections of the diyas
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec3 L = uLights[i];
      vec2 d = p - L.xz;
      float forward = d.y;
      if (forward > -0.6 && forward < 46.0) {
        float wobble = sin(forward * 1.6 + uTime * 1.5 + float(i) * 2.1) * 0.11
                     + sin(forward * 4.1 - uTime * 2.3 + float(i) * 0.7) * 0.045
                     + (fbm(vec2(forward * 0.9, uTime * 0.6 + float(i))) - 0.5) * 0.16;
        float width = 0.10 + max(forward, 0.0) * 0.052;
        float u = (d.x - wobble) / width;
        float streak = exp(-u * u);
        streak *= 1.0 - smoothstep(0.0, 42.0, forward);
        streak *= smoothstep(-0.6, 0.9, forward);
        float flicker = 0.72 + 0.28 * sin(uTime * 6.5 + float(i) * 1.73);
        col += vec3(1.0, 0.54, 0.17) * streak * 0.85 * flicker * uGlow;
      }
    }

    // moon path
    float mb = (p.x - 26.0) / 9.0;
    float moonBand = exp(-mb * mb);
    col += vec3(0.30, 0.34, 0.50) * moonBand * 0.055 * (1.0 - smoothstep(20.0, 150.0, dist));

    col = mix(col, uFog, smoothstep(55.0, 190.0, dist));

    gl_FragColor = vec4(col, uOpacity);
  }
  `
}
