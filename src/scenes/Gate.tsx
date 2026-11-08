import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Flame2D } from '../components/Flame2D'
import { SENDER } from '../config'
import { useUI } from '../lib/store'

interface GateProps {
  onBegin: () => void
  expanding: boolean
  loading: boolean
}

export function Gate({ onBegin, expanding, loading }: GateProps) {
  const progress = useUI((s) => s.progress)
  const recipient = useUI((s) => s.recipient)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const kickerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const chars = titleRef.current?.querySelectorAll('.gate-char')
    const tl = gsap.timeline({ delay: 0.35 })

    if (kickerRef.current) {
      tl.fromTo(
        kickerRef.current,
        { opacity: 0, y: 12, filter: 'blur(10px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' },
        0,
      )
    }

    if (chars && chars.length) {
      tl.fromTo(
        chars,
        { opacity: 0, y: 14, filter: 'blur(9px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.042,
        },
        0.5,
      )
    }

    if (subRef.current) {
      tl.fromTo(
        subRef.current,
        { opacity: 0, y: 10, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power2.out' },
        1.6,
      )
    }

    if (buttonRef.current) {
      tl.fromTo(
        buttonRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' },
        2.4,
      )
    }

    return () => {
      tl.kill()
    }
  }, [])

  const letters = Array.from(SENDER)

  return (
    <div className={`gate ${expanding ? 'gate-expanding' : ''}`}>
      <div className="gate-aura" aria-hidden="true" />
      <div className="gate-content">
        {recipient ? (
          <p ref={kickerRef} className="gate-recipient font-tiro">
            {recipient}, ye aapke liye
          </p>
        ) : (
          <p ref={kickerRef} className="gate-recipient gate-recipient-quiet font-tiro">
            ek chhoti si roshni
          </p>
        )}

        <div className="gate-diya">
          <Flame2D progress={progress} lit={expanding} />
        </div>

        <h1 ref={titleRef} className="gate-title gold-foil font-cinzel" aria-label={SENDER}>
          {letters.map((ch, i) => (
            <span key={i} className="gate-char" aria-hidden="true">
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>

        <p ref={subRef} className="gate-sub font-body">
          aapke liye kuch laaye hain
        </p>

        <button
          ref={buttonRef}
          type="button"
          className="gate-button"
          onClick={onBegin}
          disabled={loading}
        >
          <span className="gate-button-glow" aria-hidden="true" />
          <span className="gate-button-label font-cinzel">
            {loading ? 'Jal raha he...' : 'Diya jalao'}
          </span>
        </button>

        <p className="gate-hint font-body">Best with the sound on</p>
      </div>
      <div className="gate-flash" aria-hidden="true" />
    </div>
  )
}
