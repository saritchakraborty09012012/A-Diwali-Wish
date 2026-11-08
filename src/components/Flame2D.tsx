import { useEffect, useRef } from 'react'

interface Flame2DProps {
  /** 0..1 — while the page boots the flame itself is the progress bar. */
  progress: number
  /** false until the visitor taps "Diya jalao" — the diya stays unlit. */
  lit?: boolean
  className?: string
}

/**
 * The gate's diya. Canvas2D, not WebGL, so the first paint is instant and
 * the initial JS payload stays tiny. Procedural, no image assets.
 *
 * The diya starts unlit (bujha hua): only the bowl, the dark wick and a
 * faint smoke wisp — so the button "Diya jalao" actually makes sense.
 * When `lit` flips true (the tap), a spark lands on the wick, the flame
 * swallows up over ~800ms with a burst of embers, and the film begins.
 */
export function Flame2D({ progress, lit = false, className }: Flame2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress
  const litRef = useRef(lit)
  const litAtRef = useRef(-1)

  useEffect(() => {
    if (lit && !litRef.current) {
      litAtRef.current = performance.now()
    }
    litRef.current = lit
  }, [lit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 320
    const H = 460
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let start = performance.now()
    const embers: Array<{ x: number; y: number; vy: number; life: number; size: number }> = []
    let sparkBurstDone = false
    let sparkBurstAt = -1

    const drawFlame = (
      cx: number,
      baseY: number,
      height: number,
      width: number,
      sway: number,
      fill: string | CanvasGradient,
      alpha: number,
    ) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(cx - width / 2, baseY)
      ctx.bezierCurveTo(
        cx - width * 0.95,
        baseY - height * 0.32,
        cx - width * 0.42 + sway,
        baseY - height * 0.78,
        cx + sway * 1.6,
        baseY - height,
      )
      ctx.bezierCurveTo(
        cx + width * 0.42 + sway,
        baseY - height * 0.78,
        cx + width * 0.95,
        baseY - height * 0.32,
        cx + width / 2,
        baseY,
      )
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }

    const loop = (now: number) => {
      const t = (now - start) / 1000
      const p = progressRef.current
      const isLit = litRef.current
      const igniteT = litAtRef.current >= 0 ? (now - litAtRef.current) / 1000 : 0
      // 0 → 1 over ~800ms with a slight overshoot ease
      const ignite = Math.min(1, Math.max(0, igniteT / 0.8))
      const eased =
        ignite < 1 ? 1 - Math.pow(1 - ignite, 3) + Math.sin(ignite * Math.PI * 2) * 0.06 : 1
      const lite = isLit ? Math.min(1, Math.max(0, eased)) : 0

      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const baseY = 358

      /* spark burst at the moment of lighting */
      if (isLit && !sparkBurstDone) {
        sparkBurstDone = true
        sparkBurstAt = igniteT
        for (let i = 0; i < 16; i++) {
          embers.push({
            x: cx + (Math.random() - 0.5) * 36,
            y: baseY - 14,
            vy: 40 + Math.random() * 90,
            life: 1,
            size: 1 + Math.random() * 2.4,
          })
        }
      }
      const burstAge = sparkBurstAt >= 0 ? igniteT - sparkBurstAt : 99
      const preloadGlow = isLit ? lite : p * 0.55

      /* aura (only after the tap) */
      if (lite > 0.02) {
        const aura = ctx.createRadialGradient(cx, baseY - 60, 4, cx, baseY - 60, 210)
        aura.addColorStop(0, `rgba(255,180,80,${0.34 * lite})`)
        aura.addColorStop(0.35, `rgba(255,130,30,${0.12 * lite})`)
        aura.addColorStop(1, 'rgba(255,110,20,0)')
        ctx.fillStyle = aura
        ctx.fillRect(0, 0, W, H)
      }

      /* flame — only once lit (height 0 while unlit) */
      if (lite > 0.02) {
        const scale = 0.28 + 0.72 * lite
        const flicker =
          1 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 21.7) * 0.025 + Math.sin(t * 3.1) * 0.04
        const flameH = 152 * scale * flicker
        const flameW = 46 * scale * (1 + Math.sin(t * 7.1) * 0.04)
        const sway = Math.sin(t * 2.4) * 5 * scale + Math.sin(t * 5.7 + 1.3) * 2.4 * scale

        ctx.globalCompositeOperation = 'lighter'
        drawFlame(cx, baseY, flameH, flameW * 2.3, sway, `rgba(255,92,10,${0.3 * lite})`, 1)
        drawFlame(cx, baseY, flameH * 0.86, flameW * 1.5, sway * 0.85, `rgba(255,158,40,${0.55 * lite})`, 1)

        const coreGrad = ctx.createLinearGradient(cx, baseY, cx, baseY - flameH * 0.8)
        coreGrad.addColorStop(0, 'rgba(255,250,225,0.98)')
        coreGrad.addColorStop(0.45, 'rgba(255,226,150,0.92)')
        coreGrad.addColorStop(1, 'rgba(255,170,60,0)')
        drawFlame(cx, baseY, flameH * 0.66, flameW * 0.85, sway * 0.6, coreGrad, lite)

        /* blue base */
        const blue = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, 30 * scale)
        blue.addColorStop(0, `rgba(120,170,255,${0.35 * lite})`)
        blue.addColorStop(1, 'rgba(80,120,255,0)')
        ctx.fillStyle = blue
        ctx.beginPath()
        ctx.ellipse(cx, baseY, 26 * scale, 10 * scale, 0, 0, Math.PI * 2)
        ctx.fill()

        /* shockwave ring from the spark */
        if (burstAge < 0.5) {
          const rr = 8 + burstAge * 220
          const ring = ctx.createRadialGradient(cx, baseY - 30, rr * 0.6, cx, baseY - 30, rr)
          ring.addColorStop(0, 'rgba(255,220,150,0)')
          ring.addColorStop(0.75, `rgba(255,200,110,${0.5 * (1 - burstAge * 2)})`)
          ring.addColorStop(1, 'rgba(255,200,110,0)')
          ctx.fillStyle = ring
          ctx.beginPath()
          ctx.arc(cx, baseY - 30, rr, 0, Math.PI * 2)
          ctx.fill()
        }

        /* embers */
        if (Math.random() < 0.22 * lite) {
          embers.push({
            x: cx + (Math.random() - 0.5) * 70 * scale,
            y: baseY - flameH * 0.5,
            vy: 18 + Math.random() * 34,
            life: 1,
            size: 1 + Math.random() * 2,
          })
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i]
          e.y -= e.vy * 0.016
          e.x += Math.sin(t * 3 + i) * 0.35
          e.life -= 0.012
          if (e.life <= 0) {
            embers.splice(i, 1)
            continue
          }
          ctx.globalAlpha = Math.max(0, e.life) * 0.8 * lite
          ctx.fillStyle = 'rgba(255,170,70,1)'
          ctx.beginPath()
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }

      /* wick shimmer before lighting (boot progress hint) */
      if (!isLit && p > 0.02) {
        const wickGlow = ctx.createRadialGradient(cx, baseY - 16, 0, cx, baseY - 16, 34)
        wickGlow.addColorStop(0, `rgba(255,160,60,${0.1 * p})`)
        wickGlow.addColorStop(1, 'rgba(255,140,40,0)')
        ctx.fillStyle = wickGlow
        ctx.fillRect(cx - 40, baseY - 56, 80, 80)
      }

      /* bowl */
      const bowl = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0)
      bowl.addColorStop(0, '#3a1a0c')
      bowl.addColorStop(0.28, '#8a4a20')
      bowl.addColorStop(0.5, '#c1763a')
      bowl.addColorStop(0.72, '#7c3d18')
      bowl.addColorStop(1, '#2d1308')

      ctx.beginPath()
      ctx.moveTo(cx - 84, baseY - 6)
      ctx.bezierCurveTo(cx - 78, baseY + 44, cx - 34, baseY + 64, cx, baseY + 64)
      ctx.bezierCurveTo(cx + 34, baseY + 64, cx + 78, baseY + 44, cx + 84, baseY - 6)
      ctx.closePath()
      ctx.fillStyle = bowl
      ctx.fill()

      /* rim */
      ctx.beginPath()
      ctx.ellipse(cx, baseY - 6, 84, 15, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#2a1108'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255,196,110,0.75)'
      ctx.stroke()

      ctx.beginPath()
      ctx.ellipse(cx, baseY - 6, 70, 11, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#120806'
      ctx.fill()

      /* oil shimmer */
      const oil = ctx.createRadialGradient(cx, baseY - 4, 0, cx, baseY - 4, 46)
      oil.addColorStop(0, `rgba(255,180,80,${0.22 + 0.38 * preloadGlow})`)
      oil.addColorStop(1, 'rgba(255,140,40,0)')
      ctx.fillStyle = oil
      ctx.beginPath()
      ctx.ellipse(cx, baseY - 4, 46, 8, 0, 0, Math.PI * 2)
      ctx.fill()

      /* wick */
      ctx.strokeStyle = 'rgba(20,12,8,0.95)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, baseY - 4)
      ctx.lineTo(cx + 2, baseY - 18)
      ctx.stroke()

      /* unlit wick: a faint smoke curl, taaki bujha lage, broken nahin */
      if (!isLit || lite < 0.4) {
        const smokeAlpha = isLit ? (1 - lite) * 0.3 : 0.16
        for (let s = 0; s < 3; s++) {
          const st = (t * 0.35 + s / 3) % 1
          const sy = baseY - 22 - st * 52
          const sx = cx + 2 + Math.sin(t * 1.5 + st * 6) * 3 * st
          ctx.globalAlpha = smokeAlpha * (1 - st)
          ctx.fillStyle = 'rgba(160,165,180,1)'
          ctx.beginPath()
          ctx.arc(sx, sy, 2.2 + st * 5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      /* gold base shadow */
      const shadow = ctx.createRadialGradient(cx, baseY + 66, 0, cx, baseY + 66, 110)
      shadow.addColorStop(0, `rgba(255,150,50,${0.16 * Math.max(preloadGlow, lite)})`)
      shadow.addColorStop(1, 'rgba(255,120,20,0)')
      ctx.fillStyle = shadow
      ctx.beginPath()
      ctx.ellipse(cx, baseY + 68, 110, 20, 0, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    />
  )
}
