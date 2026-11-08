/**
 * A tiny imperative bridge so HTML overlays (free-play clicks, the easter egg)
 * can talk to the 3D scene without prop-drilling refs through React.
 */

export const fx: {
  burstAtNDC: ((x: number, y: number) => void) | null
  burstRandom: ((big?: boolean) => void) | null
  extraShow: (() => void) | null
  sweetShower: (() => void) | null
  clear: (() => void) | null
} = {
  burstAtNDC: null,
  burstRandom: null,
  extraShow: null,
  sweetShower: null,
  clear: null,
}
