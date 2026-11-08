import { toggleMute } from '../lib/audio'
import { useUI } from '../lib/store'

export function MuteButton() {
  const muted = useUI((s) => s.muted)

  return (
    <button
      type="button"
      className="mute-button"
      aria-label={muted ? 'Unmute the music' : 'Mute the music'}
      aria-pressed={muted}
      onClick={() => toggleMute()}
    >
      <span className="mute-ring" aria-hidden="true" />
      {muted ? (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
          <path
            d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
          <path
            d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M15.4 8.6a4.8 4.8 0 010 6.8M17.9 6.1a8.3 8.3 0 010 11.8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
