/**
 * Diya flame — a cylindrical billboard with a hand-tuned procedural flame.
 * Shared by every diya on the ghat (instanced) and by the hero diya.
 */

export const flameVertex = /* glsl */ `
  attribute vec3 iPos;
  attribute float iScale;
  attribute float iPhase;
  attribute float iIgnite;
  attribute float iOn;

  uniform float uTime;
  uniform float uIgnition;

  varying vec2 vUv;
  varying float vOn;
  varying float vPhase;

  void main() {
    vUv = uv;
    vPhase = iPhase;

    float on = iOn * smoothstep(iIgnite, iIgnite + 0.10, uIgnition);
    vOn = on;

    // Cylindrical billboard: always faces the camera, stays upright.
    vec3 toCam = cameraPosition - iPos;
    toCam.y = 0.0;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(0.0001))));

    float s = iScale * (0.55 + 0.45 * on);
    vec3 worldPos = iPos
      + right * position.x * s
      + vec3(0.0, (position.y + 0.5) * s, 0.0);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`

export const flameFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  varying vec2 vUv;
  varying float vOn;
  varying float vPhase;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    if (vOn <= 0.001) discard;

    float t = uTime * 2.35 + vPhase * 6.2831853;
    vec2 p = vec2(vUv.x - 0.5, vUv.y);

    // organic sway, stronger toward the tip
    float sway = (fbm(vec2(vUv.y * 2.1 - t * 0.55, vPhase * 3.0)) - 0.5) * 0.17 * vUv.y;
    float x = p.x - sway;
    float y = clamp(p.y / 0.94, 0.0, 1.0);

    float width = 0.255 * pow(max(1.0 - y, 0.0), 0.52);
    width *= 0.55 + 0.45 * smoothstep(0.0, 0.22, y);
    width = max(width, 0.004);

    float d = abs(x) / width;
    float body = 1.0 - smoothstep(0.30, 1.0, d);
    body *= smoothstep(-0.03, 0.09, p.y);
    body *= 1.0 - smoothstep(0.74, 1.0, y);

    float core = 1.0 - smoothstep(0.0, 0.85, d * 1.35 + y * 0.95);

    vec3 outer = vec3(1.0, 0.28, 0.02);
    vec3 mid = vec3(1.0, 0.60, 0.10);
    vec3 inner = vec3(1.0, 0.94, 0.70);

    vec3 col = mix(outer, mid, smoothstep(0.0, 0.55, body));
    col = mix(col, inner, smoothstep(0.30, 1.0, core));

    float flick = 0.74 + 0.38 * fbm(vec2(vUv.x * 7.0 + t, vUv.y * 5.0 - t * 1.9));

    float alpha = body * flick * vOn;
    alpha = clamp(alpha, 0.0, 1.0);

    // soft halo around the flame
    float halo = exp(-length(vec2(p.x * 2.3, (p.y - 0.34) * 1.15)) * 4.6);
    col += vec3(1.0, 0.50, 0.13) * halo * 0.24;

    // faint blue-ish base where the wick meets the oil
    col += vec3(0.25, 0.35, 1.0) * (1.0 - smoothstep(0.0, 0.14, p.y)) * 0.10;

    gl_FragColor = vec4(col * alpha * 1.18, alpha);
  }
`
