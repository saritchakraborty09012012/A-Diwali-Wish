import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SENDER, WISH } from '../config'
import { useUI, toast } from '../lib/store'
import { shareMessage, shareUrl } from '../lib/hash'
import { fx } from '../lib/fx'

interface GiftCardProps {
  onReplay: () => void
}

function GiftDiya({ onTap }: { onTap: () => void }) {
  return (
    <button
      type="button"
      className="gift-diya"
      onClick={onTap}
      aria-label="Tap the diya"
    >
      <div className="gift-petals" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="gift-petal"
            style={
              {
                '--a': `${i * 36}deg`,
                '--i': i,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <svg viewBox="0 0 200 150" className="gift-diya-svg" aria-hidden="true">
        <defs>
          <linearGradient id="giftBowl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe9a8" />
            <stop offset="28%" stopColor="#ffc45e" />
            <stop offset="62%" stopColor="#b8791d" />
            <stop offset="100%" stopColor="#5a3406" />
          </linearGradient>
          <linearGradient id="giftFlame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="45%" stopColor="#ffd166" />
            <stop offset="100%" stopColor="#ff7a00" />
          </linearGradient>
          <radialGradient id="giftGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffb347" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9f1c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="88" rx="86" ry="46" fill="url(#giftGlow)" />
        <path
          d="M28 88 C38 122 66 138 100 138 C134 138 162 122 172 88 Z"
          fill="url(#giftBowl)"
        />
        <ellipse cx="100" cy="88" rx="72" ry="12" fill="#2a1406" />
        <ellipse
          cx="100"
          cy="88"
          rx="72"
          ry="12"
          fill="none"
          stroke="#ffe9a8"
          strokeOpacity="0.85"
          strokeWidth="2"
        />
        <path
          d="M100 46 C112 62 118 70 118 80 C118 91 110 98 100 98 C90 98 82 91 82 80 C82 70 88 62 100 46 Z"
          fill="url(#giftFlame)"
        />
        <path
          d="M100 62 C106 71 109 76 109 82 C109 88 105 92 100 92 C95 92 91 88 91 82 C91 76 94 71 100 62 Z"
          fill="#fffdf2"
          opacity="0.9"
        />
      </svg>
      <span className="gift-diya-glow" aria-hidden="true" />
    </button>
  )
}

export function GiftCard({ onReplay }: GiftCardProps) {
  const open = useUI((s) => s.giftOpen)
  const recipient = useUI((s) => s.recipient)

  const layer = useRef<HTMLDivElement>(null)
  const diya = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const items = useRef<HTMLDivElement>(null)
  const taps = useRef(0)
  const tapTimer = useRef<number | null>(null)
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (!open) return
    const d = diya.current
    const c = card.current
    if (!d || !c) return

    setOpened(false)
    const tl = gsap.timeline()
    tl.fromTo(
      d,
      { y: '-72vh', opacity: 0, scale: 0.86 },
      { y: '0vh', opacity: 1, scale: 1, duration: 2.6, ease: 'expo.out' },
    )
    tl.call(() => setOpened(true), undefined, 2.35)
    tl.fromTo(
      c,
      { opacity: 0, y: 46, scale: 0.94, filter: 'blur(14px)' },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 2,
        ease: 'power3.out',
      },
      3.05,
    )
    if (items.current) {
      tl.fromTo(
        items.current.querySelectorAll('.wish-reveal'),
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power2.out',
          stagger: 0.14,
        },
        3.7,
      )
    }

    return () => {
      tl.kill()
    }
  }, [open])

  useEffect(
    () => () => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current)
    },
    [],
  )

  const handleDiyaTap = () => {
    taps.current += 1
    if (tapTimer.current) window.clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => {
      taps.current = 0
    }, 2600)

    if (taps.current >= 5) {
      taps.current = 0
      fx.extraShow?.()
      toast('Aapke liye ek khaas aatishbaazi')
    }
  }

  const handleShare = async () => {
    const url = shareUrl(recipient)
    const text = shareMessage(recipient)
    const data = {
      title: 'Happy Diwali from Sarit, Reyana & Family',
      text,
      url,
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(data)
        return
      }
    } catch {
      /* user cancelled — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copy ho gaya')
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = url
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast('Link copy ho gaya')
      } catch {
        toast('Link: ' + url)
      }
    }
  }

  const handleSweets = () => {
    fx.sweetShower?.()
    toast('Mithai aur chocolate baant rahe hain!')
  }

  if (!open) return null

  return (
    <div ref={layer} className="gift-layer">
      <div className={`gift-stage ${opened ? 'gift-opened' : ''}`}>
        <div ref={diya} className="gift-diya-wrap">
          <GiftDiya onTap={handleDiyaTap} />
        </div>

        <div ref={card} className="wish-card">
          <div className="wish-card-edge" aria-hidden="true" />
          <div className="wish-card-inner" ref={items}>
            {recipient ? (
              <p className="wish-recipient font-tiro wish-reveal">
                {recipient}, ye aapke liye
              </p>
            ) : null}

            <p className="wish-om font-tiro wish-reveal">शुभ दीपावली</p>

            <p className="wish-line wish-reveal">{WISH.line1}</p>
            <p className="wish-line wish-reveal">{WISH.line2}</p>
            <p className="wish-sign font-cinzel wish-reveal">{WISH.sign}</p>

            <div className="mithai-thali wish-reveal" aria-hidden="true">
              <svg viewBox="0 0 340 92" className="mithai-svg">
                <defs>
                  <radialGradient id="thaliLadoo" cx="40%" cy="32%" r="75%">
                    <stop offset="0%" stopColor="#ffe6ad" />
                    <stop offset="55%" stopColor="#f5a52b" />
                    <stop offset="100%" stopColor="#b45f0c" />
                  </radialGradient>
                  <linearGradient id="thaliBarfi" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fff7e0" />
                    <stop offset="60%" stopColor="#f3dba6" />
                    <stop offset="100%" stopColor="#c79d55" />
                  </linearGradient>
                  <linearGradient id="thaliChoco" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a5426" />
                    <stop offset="100%" stopColor="#4a250a" />
                  </linearGradient>
                  <linearGradient id="thaliPlate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffe9a8" />
                    <stop offset="45%" stopColor="#ffc45e" />
                    <stop offset="100%" stopColor="#7a4a10" />
                  </linearGradient>
                </defs>
                <ellipse cx="170" cy="78" rx="128" ry="12" fill="rgba(255,160,50,0.16)" />
                {/* latoos */}
                <g>
                  <circle cx="74" cy="56" r="22" fill="url(#thaliLadoo)" />
                  <circle cx="106" cy="64" r="18" fill="url(#thaliLadoo)" />
                  <circle cx="52" cy="66" r="15" fill="url(#thaliLadoo)" />
                  <ellipse cx="66" cy="49" rx="7" ry="4.5" fill="#fff7dd" opacity="0.85" transform="rotate(-24 66 49)" />
                </g>
                {/* barfi diamonds */}
                <g transform="translate(232 58) rotate(45)">
                  <rect x="-15" y="-15" width="30" height="30" rx="4" fill="url(#thaliBarfi)" />
                  <rect x="-15" y="-15" width="30" height="8" fill="#ffffff" opacity="0.65" />
                </g>
                <g transform="translate(262 64) rotate(45)">
                  <rect x="-13" y="-13" width="26" height="26" rx="4" fill="url(#thaliBarfi)" />
                  <rect x="-13" y="-13" width="26" height="7" fill="#ffffff" opacity="0.6" />
                </g>
                <circle cx="232" cy="54" r="2.4" fill="#5ca84c" />
                <circle cx="248" cy="52" r="2.2" fill="#5ca84c" transform="rotate(20 248 52)" />
                {/* chocolate bar */}
                <g transform="translate(150 58) rotate(-10)">
                  <rect x="-22" y="-14" width="44" height="28" rx="3" fill="url(#thaliChoco)" />
                  <rect x="-18" y="-10" width="17" height="8" rx="1.5" fill="#6e3f18" />
                  <rect x="2" y="-10" width="17" height="8" rx="1.5" fill="#6e3f18" />
                  <rect x="-18" y="1" width="17" height="8" rx="1.5" fill="#6e3f18" />
                  <rect x="2" y="1" width="17" height="8" rx="1.5" fill="#6e3f18" />
                  <rect x="-22" y="-14" width="44" height="4" fill="#ffd696" opacity="0.28" />
                </g>
                {/* jalebi coil */}
                <circle cx="300" cy="60" r="13" fill="none" stroke="#f0850a" strokeWidth="4.5" strokeDasharray="7 3.5" />
                <circle cx="300" cy="60" r="7" fill="none" stroke="#ffb347" strokeWidth="2.5" strokeDasharray="4 3" />
                {/* thali plate */}
                <path d="M36 78 C60 88 280 88 304 78 C286 86 54 86 36 78 Z" fill="url(#thaliPlate)" />
                <path d="M36 78 C60 88 280 88 304 78" stroke="#ffe9a8" strokeWidth="1.6" fill="none" opacity="0.7" />
              </svg>
              <span className="mithai-caption font-tiro">mithai aur chocolate</span>
            </div>

            <div className="wish-actions wish-reveal">
              <button type="button" className="wish-btn" onClick={onReplay}>
                <span className="font-cinzel">Phir se dekho</span>
              </button>
              <button type="button" className="wish-btn wish-btn-sweet" onClick={handleSweets}>
                <span className="font-cinzel">Mithai baanto</span>
              </button>
              <button type="button" className="wish-btn wish-btn-solid" onClick={handleShare}>
                <span className="font-cinzel">Apni diya jalao</span>
              </button>
            </div>

            <p className="wish-footer font-body wish-reveal">
              {SENDER} · Diwali
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
