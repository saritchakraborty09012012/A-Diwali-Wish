import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useUI } from '../lib/store'

export function Captions() {
  const caption = useUI((s) => s.caption)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!caption || !el) return

    const tl = gsap.timeline()
    tl.fromTo(
      el,
      { opacity: 0, filter: 'blur(16px)', y: 22 },
      {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        duration: 2.1,
        ease: 'power2.out',
      },
    ).to(
      el,
      {
        opacity: 0,
        filter: 'blur(10px)',
        y: -14,
        duration: 1.5,
        ease: 'power2.in',
      },
      Math.max(1.2, caption.hold - 1.7),
    )

    return () => {
      tl.kill()
    }
  }, [caption])

  if (!caption) return null

  const isFinale = caption.variant === 'finale'

  return (
    <div
      className={`captions ${isFinale ? 'captions-finale' : 'captions-act'}`}
      aria-live="polite"
    >
      <div key={caption.id} ref={ref} className="captions-inner">
        {caption.kicker ? (
          <p className="caption-kicker font-tiro">{caption.kicker}</p>
        ) : null}
        <p className={isFinale ? 'caption-main-finale font-cinzel' : 'caption-main font-cinzel'}>
          {caption.main}
        </p>
      </div>
    </div>
  )
}
