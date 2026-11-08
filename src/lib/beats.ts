import { BEATS_URL } from '../config'
import { audioTime, getAnalyser } from './audio'

export type BeatHandler = (time: number, index: number) => void

/**
 * Beat engine.
 * 1. Prefers a pre-analysed /public/audio/beats.json (array of seconds).
 * 2. Falls back to a Web Audio AnalyserNode bass-energy peak detector.
 * 3. If there is no audio at all it simply stays quiet.
 */
class BeatEngine {
  beats: number[] = []
  loaded = false
  private handlers = new Set<BeatHandler>()
  private index = 0
  private running = false
  private offset = 0
  private lastPeak = -10
  private avg = 0
  private freq: Uint8Array | null = null

  async load(url = BEATS_URL): Promise<boolean> {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return false
      const json: unknown = await res.json()
      const list = Array.isArray(json)
        ? json
        : (json as { beats?: unknown })?.beats
      if (!Array.isArray(list)) return false
      const parsed = list
        .map((n) => (typeof n === 'number' ? n : Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b)
      if (parsed.length === 0) return false
      this.beats = parsed
      this.loaded = true
      return true
    } catch {
      return false
    }
  }

  on(handler: BeatHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  reset(offset = 0): void {
    this.index = 0
    this.offset = offset
    this.running = true
    this.lastPeak = -10
    this.avg = 0
  }

  stop(): void {
    this.running = false
  }

  /** Called every frame with the authoritative film time. */
  update(filmTime: number): void {
    if (!this.running) return
    const t = filmTime - this.offset
    if (t < 0) return

    if (this.loaded) {
      while (
        this.index < this.beats.length &&
        this.beats[this.index] <= t + 0.02
      ) {
        const beatTime = this.beats[this.index]
        this.index++
        // Ignore ancient beats after a seek / tab return.
        if (t - beatTime < 0.4) this.emit(beatTime, this.index - 1)
      }
      return
    }

    const analyser = getAnalyser()
    if (!analyser) return
    if (!this.freq || this.freq.length !== analyser.frequencyBinCount) {
      this.freq = new Uint8Array(analyser.frequencyBinCount)
    }
    analyser.getByteFrequencyData(this.freq)
    const bins = this.freq
    // Bass: roughly 20-180 Hz with a 1024 FFT at 44.1/48kHz.
    const n = Math.min(10, bins.length)
    let energy = 0
    for (let i = 1; i < n; i++) energy += bins[i]
    energy /= n - 1

    this.avg = this.avg * 0.92 + energy * 0.08
    const now = audioTime() || t
    const overThreshold = energy > 74 && energy > this.avg * 1.34
    if (overThreshold && now - this.lastPeak > 0.24) {
      this.lastPeak = now
      this.emit(now, -1)
    }
  }

  private emit(time: number, index: number): void {
    this.handlers.forEach((h) => {
      try {
        h(time, index)
      } catch {
        /* a broken listener must never stop the film */
      }
    })
  }
}

export const beats = new BeatEngine()
