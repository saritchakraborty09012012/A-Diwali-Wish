import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Gate } from './scenes/Gate'
import { Captions } from './components/Captions'
import { Letterbox } from './components/Letterbox'
import { MuteButton } from './components/MuteButton'
import { Cursor } from './components/Cursor'
import { GiftCard } from './scenes/GiftCard'
import { Fallback } from './scenes/Fallback'

import { hasWebGL, requestGyroPermission, watchGyro } from './lib/device'
import { getRecipient } from './lib/hash'
import { setUI, toast, useUI } from './lib/store'
import { stage } from './lib/stage'
import { fx } from './lib/fx'
import {
  fadeInAudio,
  pauseAudio,
  restartAudio,
  resumeAudio,
  unlockAudio,
} from './lib/audio'
import { beats } from './lib/beats'
import { pauseTimeline, resumeTimeline, startTimeline } from './lib/timeline'

const Experience = lazy(() => import('./scenes/Experience'))
const prefetchExperience = () => import('./scenes/Experience')

function Toast() {
  const message = useUI((s) => s.toast)
  if (!message) return null
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

export default function App() {
  const phase = useUI((s) => s.phase)
  const mode = useUI((s) => s.mode)
  const giftOpen = useUI((s) => s.giftOpen)
  const freeplay = useUI((s) => s.freeplay)

  const [expanding, setExpanding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runId, setRunId] = useState(0)

  const busyRef = useRef(false)
  const gyroCleanup = useRef<(() => void) | null>(null)
  const experiencePromise = useRef<Promise<unknown> | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const heldRef = useRef(false)

  /* ---------------------------------------------------------------- */
  /* boot                                                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    setUI({
      recipient: getRecipient(),
      mode: hasWebGL() ? '3d' : '2d',
    })

    // warm the 3D chunk while the gate is on screen
    experiencePromise.current = prefetchExperience().catch(() => null)

    let p = 0.2
    setUI({ progress: p })
    const tick = window.setInterval(() => {
      p = Math.min(0.9, p + 0.045)
      setUI({ progress: p })
    }, 170)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearInterval(tick)
      setUI({ progress: 1 })
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(finish).catch(finish)
    }
    const fallbackTimer = window.setTimeout(finish, 3800)

    const veil = document.getElementById('boot-veil')
    if (veil) {
      window.requestAnimationFrame(() => {
        veil.style.opacity = '0'
        window.setTimeout(() => veil.remove(), 1000)
      })
    }

    return () => {
      window.clearInterval(tick)
      window.clearTimeout(fallbackTimer)
      gyroCleanup.current?.()
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /* gate                                                              */
  /* ---------------------------------------------------------------- */
  const begin = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setExpanding(true)

    // iOS needs this inside the user gesture
    try {
      const allowed = await requestGyroPermission()
      if (allowed) {
        gyroCleanup.current = watchGyro((x, y) => {
          stage.gyroX = x
          stage.gyroY = y
        })
      }
    } catch {
      /* no gyro, no problem */
    }

    const delay = new Promise((resolve) => window.setTimeout(resolve, 2200))
    await Promise.race([unlockAudio(), delay])

    try {
      await Promise.race([
        experiencePromise.current ?? prefetchExperience(),
        new Promise((resolve) => window.setTimeout(resolve, 3200)),
      ])
    } catch {
      /* the lazy fallback in Suspense handles it */
    }

    window.setTimeout(() => {
      setUI({ phase: 'experience', ready: true })
    }, 850)
  }, [])

  /* ---------------------------------------------------------------- */
  /* controls                                                          */
  /* ---------------------------------------------------------------- */
  const handleSweets = useCallback(() => {
    fx.sweetShower?.()
    toast('Mithai aur chocolate baant rahe hain!')
  }, [])

  const replay = useCallback(() => {
    setUI({
      giftOpen: false,
      freeplay: false,
      caption: null,
      letterboxOpen: false,
      act: 0,
    })
    fx.clear?.()

    if (mode === '2d') {
      restartAudio()
      setRunId((r) => r + 1)
      return
    }

    startTimeline()
    beats.reset(0)
    restartAudio()
  }, [mode])

  /* tap → patakha phootega; press & hold → scene freeze (ambient keeps
     flowing: water, flames and fireworks dance on their shader clocks,
     only the film's playhead stops) */
  const onTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phase !== 'experience') return
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1)
      const textShowing = stage.textIn > 0.02 && stage.textOut < 0.9
      if (!textShowing) fx.burstAtNDC?.(x, y)
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, textarea, select')) return
      holdTimerRef.current = window.setTimeout(() => {
        heldRef.current = true
        pauseTimeline()
        pauseAudio()
        toast('Film ruki hai — chhodo to phir chale')
      }, 260)
    },
    [phase],
  )

  const endHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (heldRef.current) {
      heldRef.current = false
      resumeTimeline()
      resumeAudio()
    }
  }, [])

  /* keep audio state fresh when the tab returns */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && phase === 'experience') {
        fadeInAudio(600)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [phase])

  return (
    <div
      className="app-root"
      onPointerDown={onTap}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onPointerLeave={endHold}
    >
      {phase !== 'experience' ? (
        <Gate onBegin={begin} expanding={expanding} loading={busy} />
      ) : null}

      {phase === 'experience' && mode === '3d' ? (
        <Suspense fallback={<div className="black-veil" />}>
          <Experience />
        </Suspense>
      ) : null}

      {phase === 'experience' && mode === '2d' ? <Fallback key={runId} /> : null}

      {phase === 'experience' ? (
        <>
          <div className="vignette-overlay" aria-hidden="true" />
          <div className="film-grain" aria-hidden="true" />
          <div className="entry-flash" key={`flash-${runId}`} aria-hidden="true" />

          <Captions />
          <Letterbox />
          <MuteButton />

          {freeplay && !giftOpen ? (
            <button
              type="button"
              className="sweet-btn"
              onClick={handleSweets}
              aria-label="Mithai aur chocolate baanto"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <circle cx="12" cy="14" r="6.4" fill="#f5a52b" />
                <circle cx="9.6" cy="12.2" r="1" fill="#d97e14" />
                <circle cx="14" cy="11.4" r="0.9" fill="#d97e14" />
                <circle cx="11" cy="15.6" r="0.9" fill="#ffe0a1" />
                <ellipse cx="10" cy="11.6" rx="2.3" ry="1.4" fill="#fff4d6" opacity="0.85" transform="rotate(-24 10 11.6)" />
              </svg>
              <span className="font-cinzel">Mithai baanto</span>
            </button>
          ) : null}

          <Cursor />
          <GiftCard onReplay={replay} />
          <Toast />
        </>
      ) : null}
    </div>
  )
}
