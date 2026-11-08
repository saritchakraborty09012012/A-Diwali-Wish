import gsap from 'gsap'
import { CAPTIONS, FINALE_AT, TOTAL_DURATION } from '../config'
import { clearCaption, getUI, setUI, showCaption } from './store'
import { resetStage, stage } from './stage'

/**
 * The whole film lives on one GSAP master timeline. It never touches React
 * state per frame — it writes into the mutable `stage` object which the
 * render loop reads. Captions / chrome are pushed through the tiny store.
 */

let active: gsap.core.Timeline | null = null

gsap.ticker.lagSmoothing(500, 33)

const F = FINALE_AT
const GIFT_AT = F + 25
const CARD_AT = F + 27.5
const END_AT = Math.max(TOTAL_DURATION, CARD_AT + 6)

type CameraKey = {
  x?: number
  y?: number
  z?: number
  tx?: number
  ty?: number
  tz?: number
  fov?: number
}

function cam(
  tl: gsap.core.Timeline,
  at: number,
  duration: number,
  key: CameraKey,
  ease = 'power3.inOut',
): void {
  const vars: gsap.TweenVars = { duration, ease }
  if (key.x !== undefined) vars.camX = key.x
  if (key.y !== undefined) vars.camY = key.y
  if (key.z !== undefined) vars.camZ = key.z
  if (key.tx !== undefined) vars.tgtX = key.tx
  if (key.ty !== undefined) vars.tgtY = key.ty
  if (key.tz !== undefined) vars.tgtZ = key.tz
  if (key.fov !== undefined) vars.fov = key.fov
  tl.to(stage, vars, at)
}

function build(): gsap.core.Timeline {
  const tl = gsap.timeline({
    paused: true,
    smoothChildTiming: true,
    onComplete: () => {
      setUI({ freeplay: true, act: 5 })
    },
  })

  /* ---------------------------------------------------------------- *
   * ACT 1 — Andhera se roshni (0 → 15s)
   * ---------------------------------------------------------------- */
  cam(tl, 0, 3.6, { z: 6.2, y: 3.15, tz: 2.0, ty: 1.45, fov: 47 }, 'power2.inOut')
  cam(tl, 3.4, 6.2, { z: 21.5, y: 2.55, tz: 0.0, ty: 1.0, fov: 55 }, 'power3.inOut')

  tl.to(stage, { diya: 1, duration: 4.6, ease: 'power1.out' }, 0.55)
  tl.to(stage, { smoke: 1, duration: 4.5, ease: 'power1.out' }, 0.2)
  tl.to(stage, { smoke: 0.22, duration: 3.5, ease: 'power1.inOut' }, 6.5)
  tl.to(stage, { godray: 1, duration: 9, ease: 'power1.inOut' }, 1.2)
  tl.to(stage, { intro: 0, duration: 2.2, ease: 'power2.out' }, 0.2)

  tl.call(
    () => {
      setUI({ act: 1 })
      showCaption({ ...CAPTIONS.one, hold: 5.4 }, 1)
    },
    undefined,
    4.4,
  )
  tl.call(
    () => {
      showCaption({ ...CAPTIONS.two, hold: 4.6 }, 2)
    },
    undefined,
    10.8,
  )

  /* ---------------------------------------------------------------- *
   * ACT 2 — Rangoli bloom (15 → 30s)
   * ---------------------------------------------------------------- */
  tl.call(() => setUI({ act: 2 }), undefined, 15)
  cam(tl, 14, 7.2, { y: 11.6, z: 1.4, ty: 2.0, tz: -9, fov: 50 }, 'power2.inOut')
  cam(tl, 21.2, 8.8, { y: 9.4, z: 3.6, fov: 52 }, 'sine.inOut')

  tl.to(stage, { rangoli: 1, duration: 12.4, ease: 'power1.inOut' }, 14.6)
  tl.to(stage, { lotus: 1, duration: 7.4, ease: 'power2.out' }, 20.2)

  tl.call(() => showCaption({ ...CAPTIONS.three, hold: 5.4 }, 3), undefined, 23.6)

  /* ---------------------------------------------------------------- *
   * ACT 3 — City of light (30 → 55s)
   * ---------------------------------------------------------------- */
  tl.call(() => setUI({ act: 3 }), undefined, 29.6)
  cam(tl, 29, 8.4, { y: 34, z: -4, tx: 0, ty: 8, tz: -78, fov: 55 }, 'power2.inOut')
  cam(tl, 37.4, 10, { x: 10, y: 44, z: -22, tx: 2, ty: 14, tz: -98 }, 'sine.inOut')
  cam(tl, 47.4, 8.6, { x: 18, y: 48, z: -34, tx: 0, ty: 18, tz: -112 }, 'none')

  tl.to(stage, { city: 1, duration: 16, ease: 'none' }, 29.4)
  tl.to(stage, { lantern: 1, duration: 15, ease: 'power1.inOut' }, 32)
  tl.call(() => showCaption({ ...CAPTIONS.four, hold: 6.2 }, 4), undefined, 34.6)

  /* ---------------------------------------------------------------- *
   * TENSION (55 → FINALE_AT)
   * ---------------------------------------------------------------- */
  cam(tl, 55, Math.max(2, F - 55), { x: 13, y: 49.5, z: -41, ty: 22, tz: -118, fov: 50 }, 'sine.inOut')
  tl.to(stage, { timeScale: 0.22, duration: Math.max(2, F - 55), ease: 'power2.inOut' }, 55)
  tl.to(stage, { flash: 0.22, duration: Math.max(2, F - 55), ease: 'power2.in' }, 55)

  /* ---------------------------------------------------------------- *
   * ACT 4 — The finale
   * ---------------------------------------------------------------- */
  tl.call(
    () => {
      setUI({ act: 4, letterboxOpen: true })
      stage.shake = 1
      stage.flash = 1
      gsap.to(stage, { shake: 0, duration: 1.4, ease: 'power2.out' })
      gsap.to(stage, { flash: 0.35, duration: 1.6, ease: 'power2.out' })
    },
    undefined,
    F,
  )
  cam(tl, F, 8, { x: 9, y: 51, z: -49, tx: 0, ty: 30, tz: -120, fov: 60 }, 'expo.out')
  cam(tl, F + 8, 5, { x: 6, y: 52.5, z: -54, ty: 34, tz: -126, fov: 58 }, 'sine.inOut')

  tl.to(stage, { fireworks: 1, duration: 1.2, ease: 'power2.out' }, F)
  tl.to(stage, { timeScale: 1, duration: 2, ease: 'power2.out' }, F)

  /* Finale text morph — biggest words, held longer */
  tl.to(stage, { textIn: 1, duration: 2.6, ease: 'power2.inOut' }, F + 12)
  tl.to(stage, { fireworks: 0.34, duration: 1.6, ease: 'power2.inOut' }, F + 12)
  tl.to(stage, { textMorph: 1, duration: 2.6, ease: 'power2.inOut' }, F + 14)
  tl.call(() => showCaption({ ...CAPTIONS.five, hold: 6.4, variant: 'finale' }, 5), undefined, F + 14.2)
  tl.to(stage, { textOut: 1, duration: 1.8, ease: 'power2.in' }, F + 19.4)
  tl.to(stage, { fireworks: 0.6, duration: 3, ease: 'power2.out' }, F + 19.8)

  /* Mithai aur chocolate raining over the city — bigger, longer */
  tl.to(stage, { sweets: 1, duration: 2.4, ease: 'power1.inOut' }, F + 20.8)
  tl.call(
    () => showCaption({ ...CAPTIONS.six, hold: 4.2, variant: 'finale' }, 6),
    undefined,
    F + 21.2,
  )
  tl.to(stage, { sweets: 0, duration: 1.6, ease: 'power2.in' }, F + 24.2)

  /* ---------------------------------------------------------------- *
   * ACT 5 — The gift
   * ---------------------------------------------------------------- */
  tl.call(
    () => {
      setUI({ act: 5 })
      clearCaption()
    },
    undefined,
    GIFT_AT,
  )
  cam(tl, GIFT_AT, 8, { x: 2, y: 50, z: -58, tx: 0, ty: 30, tz: -122, fov: 54 }, 'power2.inOut')
  tl.to(stage, { gift: 1, duration: 3.2, ease: 'expo.out' }, GIFT_AT + 0.2)
  tl.to(stage, { dim: 0.62, duration: 3.5, ease: 'power2.inOut' }, GIFT_AT + 1.4)
  tl.to(stage, { fireworks: 0.22, duration: 3, ease: 'power2.out' }, GIFT_AT + 1.2)
  tl.call(() => setUI({ giftOpen: true }), undefined, CARD_AT)

  tl.to({}, { duration: Math.max(0.5, END_AT - CARD_AT) }, CARD_AT)

  return tl
}

export function startTimeline(): gsap.core.Timeline {
  killTimeline()
  resetStage()
  setUI({
    act: 0,
    letterboxOpen: false,
    giftOpen: false,
    freeplay: false,
    skipped: false,
    caption: null,
  })
  active = build()
  active.play(0)
  return active
}

export function replayTimeline(): gsap.core.Timeline {
  return startTimeline()
}

export function timelineTime(): number {
  return active ? active.time() : 0
}

/** Dev-only helper: jump the playhead (used for QA of late-film beats). */
export function seekTimeline(sec: number): void {
  if (active) active.seek(sec, true)
}

export function isTimelineRunning(): boolean {
  return Boolean(active && active.isActive())
}

export function killTimeline(): void {
  if (active) {
    active.kill()
    active = null
  }
}

/**
 * Press & hold: freeze the film's progression. The GSAP playhead (and with it
 * the camera keys + stage progress) stops, while every shader-driven ambient
 * system — water, flames, window flicker, fireworks physics — keeps breathing.
 */
export function pauseTimeline(): void {
  active?.pause()
}

export function resumeTimeline(): void {
  if (active && !getUI().giftOpen && !getUI().skipped) active.play()
}

export function finaleTime(): number {
  return FINALE_AT
}

export function giftTime(): number {
  return GIFT_AT
}
