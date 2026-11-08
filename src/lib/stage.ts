/**
 * `stage` is the single mutable bridge between the GSAP master timeline and
 * the render loop. Nothing in here triggers a React re-render — that is the
 * whole point. React only owns UI chrome (captions, card, buttons).
 */

export interface Stage {
  /** seconds since the film started, mirrored from the GSAP timeline */
  elapsed: number
  act: number

  /* camera */
  camX: number
  camY: number
  camZ: number
  tgtX: number
  tgtY: number
  tgtZ: number
  fov: number
  roll: number

  /* parallax */
  gyroX: number
  gyroY: number
  pointerX: number
  pointerY: number

  /* scene progress 0..1 */
  intro: number
  smoke: number
  diya: number
  rangoli: number
  lotus: number
  city: number
  lantern: number
  godray: number
  dim: number

  /* finale */
  finale: number
  fireworks: number
  flash: number
  shake: number
  beat: number
  textIn: number
  textMorph: number
  textOut: number
  letterbox: number

  /* celebration */
  /** mithai & chocolate rain intensity 0..1 */
  sweets: number

  /* gift */
  gift: number

  /* bookkeeping */
  reset: number
  qualityPulse: number
  /** slows drifting elements during the tension build */
  timeScale: number
}

export const stage: Stage = {
  elapsed: 0,
  act: 0,

  camX: 0,
  camY: 2.5,
  camZ: 1.6,
  tgtX: 0,
  tgtY: 2.1,
  tgtZ: 0.2,
  fov: 38,
  roll: 0,

  gyroX: 0,
  gyroY: 0,
  pointerX: 0,
  pointerY: 0,

  intro: 1,
  smoke: 0,
  diya: 0,
  rangoli: 0,
  lotus: 0,
  city: 0,
  lantern: 0,
  godray: 0,
  dim: 0,

  finale: 0,
  fireworks: 0,
  flash: 0,
  shake: 0,
  beat: 0,
  textIn: 0,
  textMorph: 0,
  textOut: 0,
  letterbox: 1,
  sweets: 0,

  gift: 0,

  reset: 0,
  qualityPulse: 0,
  timeScale: 1,
}

/** Initial camera keyframe (act 0 → 1). Also used by replay. */
export const STAGE_START = {
  camX: 0,
  camY: 2.46,
  camZ: 1.55,
  tgtX: 0,
  tgtY: 2.08,
  tgtZ: 0.35,
  fov: 36,
}

export function resetStage(): void {
  stage.elapsed = 0
  stage.act = 0
  Object.assign(stage, STAGE_START)
  stage.roll = 0
  stage.gyroX = 0
  stage.gyroY = 0
  stage.pointerX = 0
  stage.pointerY = 0
  stage.intro = 1
  stage.smoke = 0
  stage.diya = 0
  stage.rangoli = 0
  stage.lotus = 0
  stage.city = 0
  stage.lantern = 0
  stage.godray = 0
  stage.dim = 0
  stage.finale = 0
  stage.fireworks = 0
  stage.flash = 0
  stage.shake = 0
  stage.beat = 0
  stage.textIn = 0
  stage.textMorph = 0
  stage.textOut = 0
  stage.letterbox = 1
  stage.sweets = 0
  stage.gift = 0
  stage.timeScale = 1
  stage.reset += 1
}
