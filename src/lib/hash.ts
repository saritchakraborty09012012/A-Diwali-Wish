import { SENDER } from '../config'

/**
 * The recipient name is optional and comes from the URL hash.
 *   /#Rahul  →  "Rahul"
 *   /#/Rahul →  "Rahul"
 * Anything malformed is ignored, never thrown.
 */

const MAX_NAME = 26

export function getRecipient(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let raw = window.location.hash.replace(/^#/, '')
    if (raw.startsWith('/')) raw = raw.slice(1)
    if (!raw) return null
    let decoded = raw
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      decoded = raw
    }
    // Strip markup-ish characters and collapse whitespace.
    decoded = decoded
      .replace(/[<>{}\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!decoded) return null
    return decoded.slice(0, MAX_NAME)
  } catch {
    return null
  }
}

/** "Rahul, ye aapke liye" — or null when there is no name. */
export function greeting(): string | null {
  const name = getRecipient()
  return name ? `${name}, ye aapke liye` : null
}

export function shareUrl(name?: string | null): string {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(window.location.href)
    url.hash = ''
    const who = (name ?? getRecipient() ?? '').trim()
    if (who) url.hash = encodeURIComponent(who)
    return url.toString()
  } catch {
    return window.location.href
  }
}

export function shareMessage(name?: string | null): string {
  const who = (name ?? getRecipient() ?? '').trim()
  return who
    ? `${who}, aapke liye ek diya jalaya he — ${SENDER}`
    : `Aapke liye ek diya jalaya he — ${SENDER}`
}
