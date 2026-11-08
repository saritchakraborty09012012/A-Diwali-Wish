import { useEffect, useRef } from 'react'
import { CAPTIONS } from '../config'
import { fadeInAudio } from '../lib/audio'
import { setUI, showCaption } from '../lib/store'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

/**
 * The no-WebGL show. Same story beats, drawn in Canvas2D: a ghat, a city,
 * diyas, fireworks and the same wish card on top. Calm and short.
 */
export function Fallback() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const timers: number[] = []
    fadeInAudio(2000)
    timers.push(
      window.setTimeout(() => {
        setUI({ act: 1 })
        showCaption({ ...CAPTIONS.one, hold: 5.2 }, 1)
      }, 3200),
    )
    timers.push(
      window.setTimeout(() => showCaption({ ...CAPTIONS.two, hold: 4.4 }, 2), 9200),
    )
    timers.push(
      window.setTimeout(() => {
        setUI({ act: 3 })
        showCaption({ ...CAPTIONS.four, hold: 5.6 }, 4)
      }, 16000),
    )
    timers.push(
      window.setTimeout(() => {
        setUI({ act: 5, letterboxOpen: true, giftOpen: true, freeplay: true })
      }, 26000),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let dpr = 1

    const stars: Array<{ x: number; y: number; r: number; a: number }> = []
    const buildings: Array<{
      x: number
      w: number
      top: number
      windows: Array<{ x: number; y: number; lit: boolean }>
    }> = []
    const particles: Particle[] = []
    const diyas: Array<{ x: number; phase: number }> = []

    const setup = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      stars.length = 0
      for (let i = 0; i < 160; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.55,
          r: Math.random() * 1.4 + 0.3,
          a: Math.random(),
        })
      }

      buildings.length = 0
      const horizon = h * 0.62
      let x = -20
      while (x < w + 20) {
        const bw = 22 + Math.random() * 54
        const bh = 20 + Math.random() * Math.min(180, h * 0.24)
        const windows: Array<{ x: number; y: number; lit: boolean }> = []
        for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
            windows.push({ x: wx, y: wy, lit: Math.random() < 0.55 })
          }
        }
        buildings.push({ x, w: bw, top: horizon - bh, windows })
        x += bw + 4 + Math.random() * 10
      }

      diyas.length = 0
      for (let i = 0; i < 16; i++) {
        diyas.push({ x: (w / 16) * i + 18, phase: Math.random() * 6.28 })
      }
    }

    setup()
    window.addEventListener('resize', setup)

    const burst = (cx: number, cy: number) => {
      const count = 70
      const colors = ['#ffd166', '#ff9f1c', '#fff3c4', '#e63946', '#ff7a90']
      const color = colors[Math.floor(Math.random() * colors.length)]
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.1
        const speed = 60 + Math.random() * 190
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1.6 + Math.random() * 1.2,
          max: 2.8,
          color,
          size: 1.2 + Math.random() * 1.8,
        })
      }
    }

    let raf = 0
    let last = performance.now()
    let spawnAt = 9
    let elapsed = 0
    let nextAuto = 9

    const onPointer = (e: PointerEvent) => {
      burst(e.clientX, e.clientY)
    }
    canvas.addEventListener('pointerdown', onPointer)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      elapsed += dt
      const t = elapsed

      const horizon = h * 0.62

      /* sky */
      const sky = ctx.createLinearGradient(0, 0, 0, horizon)
      sky.addColorStop(0, '#04060c')
      sky.addColorStop(0.55, '#0a1020')
      sky.addColorStop(1, '#1a1009')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, horizon)

      /* stars */
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 0.8 + s.a * 12))
        ctx.fillStyle = '#cfd8ff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      /* moon */
      const moonX = w * 0.78
      const moonY = horizon * 0.26
      const moon = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 90)
      moon.addColorStop(0, 'rgba(230,238,255,0.95)')
      moon.addColorStop(0.18, 'rgba(200,215,255,0.45)')
      moon.addColorStop(1, 'rgba(180,200,255,0)')
      ctx.fillStyle = moon
      ctx.fillRect(moonX - 100, moonY - 100, 200, 200)

      /* city */
      for (const b of buildings) {
        ctx.fillStyle = '#0a0d15'
        ctx.fillRect(b.x, b.top, b.w, horizon - b.top)
        for (const win of b.windows) {
          if (!win.lit) continue
          const flick = 0.7 + 0.3 * Math.sin(t * 1.7 + win.x * 0.4 + win.y * 0.2)
          ctx.fillStyle = `rgba(255,180,90,${0.55 * flick})`
          ctx.fillRect(win.x, win.y, 3, 4)
        }
      }

      /* water */
      const water = ctx.createLinearGradient(0, horizon, 0, h)
      water.addColorStop(0, '#0c1220')
      water.addColorStop(0.4, '#060a12')
      water.addColorStop(1, '#03050a')
      ctx.fillStyle = water
      ctx.fillRect(0, horizon, w, h - horizon)

      for (let i = 0; i < 34; i++) {
        const x = (w / 34) * i + Math.sin(t * 0.5 + i) * 6
        const len = 20 + ((i * 37) % 90)
        const grad = ctx.createLinearGradient(0, horizon, 0, horizon + len)
        grad.addColorStop(0, 'rgba(255,160,70,0.20)')
        grad.addColorStop(1, 'rgba(255,140,50,0)')
        ctx.fillStyle = grad
        ctx.fillRect(x, horizon, 2.5, len)
      }

      /* diyas */
      for (const d of diyas) {
        const y = horizon - 2
        const flick = 0.8 + 0.2 * Math.sin(t * 6 + d.phase) + 0.08 * Math.sin(t * 17 + d.phase)
        const glow = ctx.createRadialGradient(d.x, y - 6, 0, d.x, y - 6, 34)
        glow.addColorStop(0, `rgba(255,180,80,${0.5 * flick})`)
        glow.addColorStop(1, 'rgba(255,140,40,0)')
        ctx.fillStyle = glow
        ctx.fillRect(d.x - 40, y - 46, 80, 80)

        ctx.fillStyle = '#3a1c0c'
        ctx.beginPath()
        ctx.ellipse(d.x, y + 2, 9, 4, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgba(255,230,160,${0.95 * flick})`
        ctx.beginPath()
        ctx.moveTo(d.x, y - 20 * flick)
        ctx.bezierCurveTo(d.x + 7, y - 9, d.x + 6, y - 2, d.x, y)
        ctx.bezierCurveTo(d.x - 6, y - 2, d.x - 7, y - 9, d.x, y - 20 * flick)
        ctx.fill()
      }

      /* auto fireworks */
      if (t > nextAuto) {
        nextAuto = t + 1.6 + Math.random() * 1.4
        burst(w * (0.2 + Math.random() * 0.6), h * (0.16 + Math.random() * 0.28))
      }
      void spawnAt

      /* particles */
      ctx.globalCompositeOperation = 'lighter'
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.vy += 42 * dt
        p.vx *= 1 - 0.9 * dt
        p.vy *= 1 - 0.9 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const a = Math.max(0, p.life / p.max)
        ctx.globalAlpha = a
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      /* vignette */
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.72)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setup)
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fallback-canvas"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
