/**
 * Generates public/og.png (1200x630) and public/apple-touch-icon.png.
 * Run: npm run make:og
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const outDir = path.join(root, 'public')
fs.mkdirSync(outDir, { recursive: true })

function tryFont(file, family) {
  const p = path.join(root, 'node_modules', '@fontsource', file)
  try {
    if (fs.existsSync(p)) return GlobalFonts.registerFromPath(p, family)
  } catch {
    /* ignore */
  }
  return false
}

tryFont('cinzel/files/cinzel-latin-700-normal.woff2', 'Cinzel')
tryFont('cinzel/files/cinzel-latin-600-normal.woff2', 'Cinzel Semi')
tryFont(
  'tiro-devanagari-hindi/files/tiro-devanagari-hindi-devanagari-400-normal.woff2',
  'Tiro Devanagari',
)
tryFont('inter/files/inter-latin-400-normal.woff2', 'Inter')

const SERIF = '"Cinzel", Georgia, "Times New Roman", serif'
const SANS = 'Inter, "Segoe UI", system-ui, sans-serif'
const DEV = '"Tiro Devanagari", "Nirmala UI", serif'

function drawDiya(ctx, cx, cy, scale) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)

  const glow = ctx.createRadialGradient(0, -40, 0, 0, -40, 220)
  glow.addColorStop(0, 'rgba(255, 180, 70, 0.55)')
  glow.addColorStop(0.4, 'rgba(255, 140, 40, 0.18)')
  glow.addColorStop(1, 'rgba(255, 120, 20, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(-240, -280, 480, 480)

  const flame = ctx.createLinearGradient(0, -60, 0, -210)
  flame.addColorStop(0, '#fffbe8')
  flame.addColorStop(0.45, '#ffd166')
  flame.addColorStop(1, '#ff7a00')

  ctx.beginPath()
  ctx.moveTo(0, -40)
  ctx.bezierCurveTo(34, -96, 52, -128, 52, -160)
  ctx.bezierCurveTo(52, -196, 30, -214, 0, -214)
  ctx.bezierCurveTo(-30, -214, -52, -196, -52, -160)
  ctx.bezierCurveTo(-52, -128, -34, -96, 0, -40)
  ctx.closePath()
  ctx.fillStyle = flame
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(0, -78)
  ctx.bezierCurveTo(18, -108, 26, -126, 26, -150)
  ctx.bezierCurveTo(26, -176, 14, -188, 0, -188)
  ctx.bezierCurveTo(-14, -188, -26, -176, -26, -150)
  ctx.bezierCurveTo(-26, -126, -18, -108, 0, -78)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 253, 242, 0.92)'
  ctx.fill()

  const bowl = ctx.createLinearGradient(0, -30, 0, 110)
  bowl.addColorStop(0, '#ffe9a8')
  bowl.addColorStop(0.32, '#ffc45e')
  bowl.addColorStop(0.72, '#b8791d')
  bowl.addColorStop(1, '#5a3406')

  ctx.beginPath()
  ctx.moveTo(-128, -34)
  ctx.bezierCurveTo(-116, 56, -64, 104, 0, 104)
  ctx.bezierCurveTo(64, 104, 116, 56, 128, -34)
  ctx.closePath()
  ctx.fillStyle = bowl
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(0, -34, 128, 20, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#2a1406'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.85)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.restore()
}

/* ------------------------------ OG image ------------------------------ */

const W = 1200
const H = 630
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

const bg = ctx.createLinearGradient(0, 0, 0, H)
bg.addColorStop(0, '#04060c')
bg.addColorStop(0.55, '#080d18')
bg.addColorStop(1, '#140c06')
ctx.fillStyle = bg
ctx.fillRect(0, 0, W, H)

// bokeh
for (let i = 0; i < 70; i++) {
  const x = Math.random() * W
  const y = Math.random() * H
  const r = 1 + Math.random() * 3.4
  ctx.globalAlpha = 0.15 + Math.random() * 0.55
  ctx.fillStyle = Math.random() > 0.4 ? '#ffd8a0' : '#aebfe6'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
ctx.globalAlpha = 1

// warm floor glow
const floor = ctx.createRadialGradient(W / 2, H + 60, 10, W / 2, H + 60, 520)
floor.addColorStop(0, 'rgba(255, 150, 45, 0.34)')
floor.addColorStop(1, 'rgba(255, 130, 30, 0)')
ctx.fillStyle = floor
ctx.fillRect(0, 0, W, H)

// thin gold frame
ctx.strokeStyle = 'rgba(255, 209, 102, 0.22)'
ctx.lineWidth = 2
ctx.strokeRect(28, 28, W - 56, H - 56)

// diya
drawDiya(ctx, W / 2, H - 64, 0.8)

// Devanagari line
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.font = `400 44px ${DEV}`
ctx.fillStyle = 'rgba(255, 209, 102, 0.92)'
ctx.fillText('तमसो मा ज्योतिर्गमय', W / 2, 132)

// main title
const title = 'Happy Diwali'
const titleGrad = ctx.createLinearGradient(W / 2 - 320, 0, W / 2 + 320, 0)
titleGrad.addColorStop(0, '#b8791d')
titleGrad.addColorStop(0.22, '#ffd166')
titleGrad.addColorStop(0.45, '#fff6d5')
titleGrad.addColorStop(0.68, '#ffb43a')
titleGrad.addColorStop(1, '#ffd166')
ctx.font = `700 96px ${SERIF}`
ctx.fillStyle = titleGrad
ctx.shadowColor = 'rgba(255, 160, 50, 0.35)'
ctx.shadowBlur = 40
ctx.fillText(title, W / 2, 232)
ctx.shadowBlur = 0

// sender
ctx.font = `600 30px ${SANS}`
ctx.fillStyle = 'rgba(244, 233, 216, 0.9)'
ctx.fillText('Sarit, Reyana & Family', W / 2, 316)

// sub
ctx.font = `400 20px ${SANS}`
ctx.fillStyle = 'rgba(244, 233, 216, 0.42)'
ctx.fillText('Tap to open your Diwali gift. Best with the sound on.', W / 2, 362)

fs.writeFileSync(path.join(outDir, 'og.png'), canvas.toBuffer('image/png'))
console.log('wrote public/og.png')

/* --------------------------- Apple touch icon -------------------------- */

const icon = createCanvas(180, 180)
const ictx = icon.getContext('2d')
ictx.fillStyle = '#070b14'
ictx.fillRect(0, 0, 180, 180)
drawDiya(ictx, 90, 148, 0.52)
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), icon.toBuffer('image/png'))
console.log('wrote public/apple-touch-icon.png')
