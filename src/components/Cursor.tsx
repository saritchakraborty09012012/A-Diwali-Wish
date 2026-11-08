import { useEffect, useRef } from 'react'
import { isTouchDevice } from '../lib/device'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  sprite: number
}

function makeSprite(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, color)
  g.addColorStop(0.35, color.replace('1)', '0.55)'))
  g.addColorStop(1, color.replace('1)', '0)'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return c
}

/** A small flame trail that follows the pointer on desktop. */
export function Cursor() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isTouchDevice()) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sprites = [
      makeSprite('rgba(255,225,150,1)'),
      makeSprite('rgba(255,170,60,1)'),
      makeSprite('rgba(255,120,30,1)'),
    ]

    let dpr = 1
    let w = 0
    let h = 0
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const sparks: Spark[] = []
    let lastX = 0
    let lastY = 0
    let hasPointer = false

    const onMove = (e: PointerEvent) => {
      if (!hasPointer) {
        hasPointer = true
        lastX = e.clientX
        lastY = e.clientY
      }
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      const speed = Math.min(26, Math.hypot(dx, dy))
      const n = Math.max(1, Math.round(speed / 6))
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 18 - dx * 0.5,
          vy: -8 - Math.random() * 22 - dy * 0.2,
          life: 0.5 + Math.random() * 0.45,
          max: 0.95,
          size: 8 + Math.random() * 16,
          sprite: Math.floor(Math.random() * 3),
        })
      }
      if (sparks.length > 220) sparks.splice(0, sparks.length - 220)
      lastX = e.clientX
      lastY = e.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        s.vy += 16 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        const a = Math.max(0, s.life / s.max)
        ctx.globalAlpha = a * 0.75
        const size = s.size * (0.6 + a * 0.6)
        ctx.drawImage(sprites[s.sprite], s.x - size / 2, s.y - size / 2, size, size)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={ref} className="cursor-canvas" aria-hidden="true" />
}
