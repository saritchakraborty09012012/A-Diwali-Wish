import { useSyncExternalStore } from 'react'

export type Phase = 'gate' | 'loading' | 'experience' | 'fallback'

export interface Caption {
  id: number
  kicker?: string
  main: string
  /** seconds the caption stays on screen */
  hold: number
  variant?: 'act' | 'finale'
}

export interface UIState {
  phase: Phase
  mode: '3d' | '2d'
  act: number
  caption: Caption | null
  letterboxOpen: boolean
  giftOpen: boolean
  muted: boolean
  audioAvailable: boolean
  ready: boolean
  progress: number
  freeplay: boolean
  skipped: boolean
  recipient: string | null
  runId: number
  toast: string | null
}

type Listener = () => void

let state: UIState = {
  phase: 'gate',
  mode: '3d',
  act: 0,
  caption: null,
  letterboxOpen: false,
  giftOpen: false,
  muted: false,
  audioAvailable: true,
  ready: false,
  progress: 0,
  freeplay: false,
  skipped: false,
  recipient: null,
  runId: 0,
  toast: null,
}

const listeners = new Set<Listener>()

export function getUI(): UIState {
  return state
}

export function setUI(patch: Partial<UIState>): void {
  let changed = false
  for (const key of Object.keys(patch) as (keyof UIState)[]) {
    if (state[key] !== patch[key]) {
      changed = true
      break
    }
  }
  if (!changed) return
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeUI(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUI<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(
    subscribeUI,
    () => selector(state),
    () => selector(state),
  )
}

let captionTimer: number | null = null

export function showCaption(caption: Omit<Caption, 'id'>, id: number): void {
  if (captionTimer !== null) {
    window.clearTimeout(captionTimer)
    captionTimer = null
  }
  setUI({ caption: { ...caption, id } })
  captionTimer = window.setTimeout(() => {
    setUI({ caption: null })
    captionTimer = null
  }, caption.hold * 1000)
}

export function clearCaption(): void {
  if (captionTimer !== null) {
    window.clearTimeout(captionTimer)
    captionTimer = null
  }
  setUI({ caption: null })
}

let toastTimer: number | null = null
export function toast(message: string): void {
  setUI({ toast: message })
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    setUI({ toast: null })
    toastTimer = null
  }, 3200)
}
