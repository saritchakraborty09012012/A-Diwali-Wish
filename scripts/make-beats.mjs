/**
 * Turns public/audio/song.mp3 into public/audio/beats.json.
 *
 *   npm install
 *   npm run make:beats
 *
 * Uses mpg123-decoder (WASM) + music-tempo, so there is no native build step
 * and no ffmpeg requirement. If the song is missing the script exits politely.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const songPath = path.join(root, 'public', 'audio', 'song.mp3')
const outPath = path.join(root, 'public', 'audio', 'beats.json')

if (!fs.existsSync(songPath)) {
  console.log('')
  console.log('  No song found at public/audio/song.mp3')
  console.log('  Drop your track there and run `npm run make:beats` again.')
  console.log('  The site works without it (it falls back to a live beat detector).')
  console.log('')
  process.exit(0)
}

let MusicTempo
let MPEGDecoder
try {
  ;({ default: MusicTempo } = await import('music-tempo'))
  ;({ MPEGDecoder } = await import('mpg123-decoder'))
} catch (err) {
  console.error('Missing dev dependencies. Run `npm install` first.')
  console.error(String(err))
  process.exit(1)
}

console.log('Decoding song.mp3 ...')
const buffer = fs.readFileSync(songPath)
const decoder = new MPEGDecoder()
await decoder.ready
const decoded = decoder.decode(new Uint8Array(buffer))
decoder.free()

const { channelData, sampleRate } = decoded
if (!channelData || !channelData.length) {
  console.error('Could not decode the MP3.')
  process.exit(1)
}

console.log(`Decoded ${(channelData[0].length / sampleRate).toFixed(1)}s at ${sampleRate}Hz`)

// mono mix
const frames = channelData[0].length
const mono = new Float32Array(frames)
const channels = channelData.length
for (let c = 0; c < channels; c++) {
  const data = channelData[c]
  for (let i = 0; i < frames; i++) mono[i] += data[i] / channels
}

// music-tempo expects 44.1kHz
const TARGET = 44100
let samples = mono
if (Math.abs(sampleRate - TARGET) > 1) {
  const ratio = sampleRate / TARGET
  const length = Math.floor(frames / ratio)
  const resampled = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const src = i * ratio
    const i0 = Math.floor(src)
    const i1 = Math.min(frames - 1, i0 + 1)
    const frac = src - i0
    resampled[i] = mono[i0] * (1 - frac) + mono[i1] * frac
  }
  samples = resampled
  console.log(`Resampled to ${TARGET}Hz`)
}

console.log('Analysing tempo ...')
let mt
try {
  // music-tempo reads maxBeatInterval/minBeatInterval/expiryTime — there is
  // no timeStep option; passing one breaks the constructor.
  mt = new MusicTempo(samples, { minBeatInterval: 0.4, expiryTime: 12 })
} catch (err) {
  console.error('Tempo extraction failed:', String(err))
  process.exit(1)
}

const beats = Array.from(mt.beats || [])
  .filter((n) => Number.isFinite(n) && n >= 0)
  .map((n) => Math.round(n * 1000) / 1000)

if (!beats.length) {
  console.error('No beats detected — try another track.')
  process.exit(1)
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(beats, null, 0))
console.log('')
console.log(`  BPM:   ${Math.round(Number(mt.tempo))}`)
console.log(`  Beats: ${beats.length}`)
console.log(`  Wrote: public/audio/beats.json`)
console.log('')
