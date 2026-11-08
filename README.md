# Tamaso Ma Jyotirgamaya — Happy Diwali

A cinematic, interactive Diwali film in the browser, sent by **Sarit, Reyana & Family**.

Tap **"Diya jalao"** → one diya wakes up in the dark → a ghat full of diyas, a rangoli
that draws itself, a whole city of light, sky lanterns, a fireworks finale with a
particle text morph, and a gift card with a wish — plus a rain of mithai & chocolate.

Everything is procedural (no 3D assets, no image assets) and only needs:

```
npm install
npm run dev     # local preview
npm run build   # production build (tsc + vite)
```

Deploy the `dist/` folder to **Vercel as-is** — zero config needed
(Vite serves a static bundle; `public/` is copied verbatim).

---

## The five acts (~95 seconds)

| Act | Time | What happens |
|-----|------|--------------|
| 1 | 0–15s | Dark ghat, one diya, the wave of lighting |
| 2 | 15–30s | Rangoli mandala + a lotus bloom |
| 3 | 30–55s | The city of light — avenue, temple, lanterns |
| 4 | 60–85s | Fireworks finale + text morph `शुभ दीपावली` → `Sarit, Reyana & Family` |
| 5 | 85s+ | The gift card, mithai & chocolate rain |

Controls: **Mute** (bottom-right), **Skip** (top-right), **"Mithai baanto"**
(bottom-centre) for a sweet rain, tap anywhere in free-play for fireworks on
demand. Tilt your phone for gyroscope parallax. Tap the gift diya 5× for a
secret extra show.

Personalised link: append a name to the URL — `your-site.vercel.app/#Rahul` —
the gate and the gift card will read *"Rahul, ye aapke liye"*.

---

## Adding your own song

The site ships with a royalty-free instrumental (Pixabay — *Festival of Lights*
by FASSounds, 100s, trimmed + faded). To use a different track:

1. Drop it at `public/audio/song.mp3`
2. Run `npm run make:beats` → generates `public/audio/beats.json` (BPM + beat
   times used to sync the fireworks)
3. Rebuild / reload — that's it.

If the file is missing the site still works silently (one console warning).

**Copyright note:** use a track you own, a royalty-free library, or a
Creative Commons song. Downloading commercial music for a public website
without a licence is copyright infringement.

Beat detection: with `beats.json` present the finale locks to the track;
without it the site falls back to a live Web Audio bass-peak detector.

---

## Tuning

All knobs live in `src/config.ts`:

| Constant | Meaning |
|----------|---------|
| `SENDER` | name shown everywhere (`Sarit, Reyana & Family`) |
| `FINALE_AT` | second where the fireworks finale starts (default **60**) |
| `TOTAL_DURATION` | film length (default **95**) |
| `BEATS_URL` / `SONG_URL` | audio assets |
| `USE_GLB` / `GLB_URL` | optional Blender model hook (see below) |
| `CAPTIONS` / `WISH` | on-screen words |

---

## Blender models (optional)

The diya/city are procedural by design. If you ever want a real Blender model
in the hero slot: set `USE_GLB = true` in `src/config.ts`, export a Draco
GLB to `public/models/diya.glb`, and the loader hook picks it up. Nothing is
downloaded while the flag is off.

Your flat-builder GLBs (`apartment.glb`, `tower.glb`) are too heavy per-instance
(300–900 meshes each) for a 500-building city, so the city is procedurally
rebuilt in that visual style instead (avenue market, torana gate, string
lights, rooftop parapets, water tanks, balconies).

---

## Tech

Vite · React 18 · TypeScript · Three.js + React Three Fiber · drei ·
`@react-three/postprocessing` (Bloom, Vignette, ChromaticAberration, Noise,
DepthOfField) · GSAP master timeline · Tailwind · Howler · self-hosted
Cinzel / Tiro Devanagari Hindi / Inter · custom GLSL (flame, rangoli, water).

The heavy 3D chunk is lazy-loaded after the gate click; the gate itself is a
tiny Canvas2D flame (the diya starts **unlit** and only catches fire when you
tap "Diya jalao"). Mobile/low-end devices automatically halve particle
counts, cap DPR and drop DepthOfField. If WebGL is missing entirely, a
Canvas2D fallback plays the same story.
