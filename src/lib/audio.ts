import { Howl, Howler } from 'howler'
import { SONG_URL } from '../config'
import { setUI } from './store'

/**
 * Audio is intentionally lazy: nothing is fetched until the gate is clicked,
 * which also satisfies every browser autoplay policy. A missing song is a
 * non-event — one console warning, the film plays silently.
 */

let sound: Howl | null = null
let analyser: AnalyserNode | null = null
let muted = false
let unlocked = false
let warned = false
let available = true
let targetVolume = 0.85

const STORAGE_KEY = 'tmj.muted'

if (typeof window !== 'undefined') {
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    muted = false
  }
}

function warnMissing(): void {
  if (warned) return
  warned = true
  available = false
  setUI({ audioAvailable: false })
  // eslint-disable-next-line no-console
  console.warn(
    '[Tamaso Ma Jyotirgamaya] public/audio/song.mp3 not found. ' +
      'The film will play silently. Drop a track in public/audio/song.mp3 to add music.',
  )
}

function ensureSound(): Howl {
  if (sound) return sound
  sound = new Howl({
    src: [SONG_URL],
    html5: false,
    preload: false,
    volume: 0,
    loop: false,
    onloaderror: () => warnMissing(),
    onplayerror: () => {
      // A blocked context can happen if the gesture was swallowed.
      try {
        Howler.ctx?.resume()
      } catch {
        /* noop */
      }
    },
  })
  return sound
}

/** Called from the gate click. Resolves when the track is playable (or failed). */
export function unlockAudio(): Promise<boolean> {
  if (unlocked) return Promise.resolve(available)
  unlocked = true

  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    let howl: Howl
    try {
      howl = ensureSound()
      // Nudge the shared AudioContext inside the user gesture.
      if (Howler.ctx && Howler.ctx.state === 'suspended') {
        void Howler.ctx.resume()
      }
      Howler.mute(muted)
    } catch {
      warnMissing()
      finish(false)
      return
    }

    const onLoad = () => {
      try {
        howl.volume(0)
        if (!howl.playing()) howl.play()
      } catch {
        /* noop */
      }
      finish(true)
    }

    howl.once('load', onLoad)
    howl.once('loaderror', () => {
      warnMissing()
      finish(false)
    })

    try {
      howl.load()
      howl.volume(0)
      howl.play()
    } catch {
      warnMissing()
      finish(false)
    }

    // Never hold the curtain for more than 4.5s.
    window.setTimeout(() => finish(available), 4500)
  })
}

/** Start the 2 second fade-in once the film is actually rolling. */
export function fadeInAudio(ms = 2000): void {
  if (!sound || !available) return
  try {
    if (!sound.playing()) sound.play()
    sound.volume(0)
    sound.fade(0, targetVolume, ms)
  } catch {
    /* noop */
  }
}

export function restartAudio(): void {
  if (!sound || !available) return
  try {
    sound.stop()
    sound.volume(0)
    sound.play()
    sound.seek(0)
    sound.fade(0, targetVolume, 1800)
  } catch {
    /* noop */
  }
}

export function stopAudio(): void {
  try {
    sound?.stop()
  } catch {
    /* noop */
  }
}

/** Hold-to-pause: freeze the song with the film (Howler keeps position). */
export function pauseAudio(): void {
  try {
    if (sound?.playing()) sound.pause()
  } catch {
    /* noop */
  }
}

export function resumeAudio(): void {
  try {
    if (sound && available && !sound.playing()) sound.play()
  } catch {
    /* noop */
  }
}

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): boolean {
  muted = !muted
  try {
    Howler.mute(muted)
    window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
  } catch {
    /* noop */
  }
  setUI({ muted })
  return muted
}

export function isAudioAvailable(): boolean {
  return available
}

/** Current playback position in seconds (0 when unavailable). */
export function audioTime(): number {
  if (!sound || !available) return 0
  try {
    const t = sound.seek()
    return typeof t === 'number' && Number.isFinite(t) ? t : 0
  } catch {
    return 0
  }
}

/** Web Audio tap used by the fallback beat detector. */
export function getAnalyser(): AnalyserNode | null {
  if (analyser) return analyser
  try {
    const ctx = Howler.ctx as AudioContext | undefined
    const master = Howler.masterGain as GainNode | undefined
    if (!ctx || !master) return null
    analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.55
    master.connect(analyser)
    return analyser
  } catch {
    return null
  }
}
