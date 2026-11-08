/**
 * Rangoli mandala — polar-coordinate SDF drawing, revealed outward by uProgress.
 * Rendered additively on the stone terrace so it glows like coloured powder.
 */

export const rangoliVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const rangoliFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uProgress;
  uniform float uOpacity;
  uniform float uBeat;

  varying vec2 vUv;

  #define TAU 6.28318530718

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

  float lineMask(float dist, float width) {
    return 1.0 - smoothstep(0.0, width, abs(dist));
  }

  float dotRing(vec2 p, float radius, float count, float size) {
    float sector = TAU / count;
    float a = atan(p.y, p.x);
    float nearest = floor(a / sector + 0.5) * sector;
    vec2 c = vec2(cos(nearest), sin(nearest)) * radius;
    return 1.0 - smoothstep(size * 0.45, size, length(p - c));
  }

  float petalBand(vec2 p, float r, float a, float count, float r0, float r1, float width) {
    float k = cos(a * count);
    float boundary = mix(r0, r1, 0.5 + 0.5 * k);
    return lineMask(r - boundary, width);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);

    if (r > 1.02) discard;

    vec3 gold = vec3(1.0, 0.80, 0.38);
    vec3 deepGold = vec3(0.95, 0.55, 0.14);
    vec3 red = vec3(0.78, 0.08, 0.13);
    vec3 orange = vec3(1.0, 0.42, 0.06);
    vec3 white = vec3(1.0, 0.94, 0.80);
    vec3 cream = vec3(1.0, 0.86, 0.62);

    vec3 col = vec3(0.0);
    float ink = 0.0;

    // outer double ring
    float m = lineMask(r - 0.965, 0.010);
    col = mix(col, gold, m);
    ink = max(ink, m);

    m = lineMask(r - 0.925, 0.006);
    col = mix(col, cream, m);
    ink = max(ink, m);

    // 32 scallops on the outer ring
    float scallop = 0.895 + 0.028 * cos(a * 32.0);
    m = lineMask(r - scallop, 0.010);
    col = mix(col, deepGold, m);
    ink = max(ink, m);

    // big petal crown
    m = petalBand(p, r, a, 24.0, 0.70, 0.885, 0.012);
    col = mix(col, red, m * 0.95);
    ink = max(ink, m);

    m = petalBand(p, r, a + TAU / 48.0, 24.0, 0.70, 0.885, 0.006);
    col = mix(col, gold, m);
    ink = max(ink, m);

    // petal fill (soft)
    float fill = (1.0 - smoothstep(0.86, 0.885, r)) * smoothstep(0.68, 0.72, r);
    float petalShape = smoothstep(-0.15, 0.55, cos(a * 24.0));
    col += mix(orange, red, petalShape) * fill * petalShape * 0.22;
    ink = max(ink, fill * petalShape * 0.55);

    // ring of dots
    m = dotRing(p, 0.635, 40.0, 0.022);
    col = mix(col, gold, m);
    ink = max(ink, m);

    m = dotRing(p, 0.585, 40.0, 0.009);
    col = mix(col, white, m);
    ink = max(ink, m);

    // second petal ring
    m = petalBand(p, r, a, 16.0, 0.36, 0.545, 0.011);
    col = mix(col, deepGold, m);
    ink = max(ink, m);

    float fill2 = (1.0 - smoothstep(0.52, 0.545, r)) * smoothstep(0.34, 0.38, r);
    float shape2 = smoothstep(-0.1, 0.6, cos(a * 16.0));
    col += mix(orange, gold, shape2) * fill2 * shape2 * 0.28;
    ink = max(ink, fill2 * shape2 * 0.6);

    // inner lotus
    m = petalBand(p, r, a, 8.0, 0.06, 0.30, 0.012);
    col = mix(col, red, m);
    ink = max(ink, m);

    m = petalBand(p, r, a + TAU / 16.0, 8.0, 0.06, 0.30, 0.006);
    col = mix(col, gold, m);
    ink = max(ink, m);

    // centre bindu
    float centre = 1.0 - smoothstep(0.028, 0.05, r);
    col = mix(col, white, centre);
    ink = max(ink, centre);

    // a whisper of fine rings
    m = lineMask(r - 0.34, 0.004) * 0.6;
    col = mix(col, cream, m);
    ink = max(ink, m);

    // ---- progressive reveal ----
    float head = uProgress * 1.18;
    float vis = 1.0 - smoothstep(head - 0.035, head + 0.01, r);
    vis = clamp(vis, 0.0, 1.0);

    // bright drawing head
    float glowHead = exp(-pow((r - head) * 16.0, 2.0)) * (1.0 - step(1.0, head));
    glowHead *= 0.55;

    // powder grain
    float grain = 0.72 + 0.38 * noise(p * 210.0 + uTime * 0.15);

    float alpha = (ink * vis * grain + glowHead) * uOpacity;
    col += vec3(1.0, 0.86, 0.55) * glowHead * 0.8;
    col += vec3(1.0, 0.45, 0.10) * uBeat * 0.05 * vis;

    // gentle breathing so the powder feels alive
    alpha *= 0.92 + 0.08 * sin(uTime * 1.4 + r * 4.0);

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col * alpha * 1.15, alpha);
  }
`
