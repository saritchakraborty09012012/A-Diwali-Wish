import { useUI } from '../lib/store'

export function Letterbox() {
  const open = useUI((s) => s.letterboxOpen)

  return (
    <div className={`letterbox ${open ? 'letterbox-open' : ''}`} aria-hidden="true">
      <div className="letterbox-bar letterbox-top" />
      <div className="letterbox-bar letterbox-bottom" />
    </div>
  )
}
