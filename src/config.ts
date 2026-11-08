/**
 * Tamaso Ma Jyotirgamaya — global configuration.
 *
 * Everything here is intentionally a plain constant so it can be tweaked
 * without touching the film itself.
 */

/** Whose name appears on the gate, the wish card and the share sheet. */
export const SENDER = 'Sarit, Reyana & Family'

/**
 * Absolute second (from the start of the film) at which the finale begins.
 * Acts 1-3 run 0..55s, the tension build runs 55s..FINALE_AT.
 * The finale itself lasts 25 seconds.
 */
export const FINALE_AT = 60

/** Total length of the film in seconds. The gift card opens near the end. */
export const TOTAL_DURATION = 95

/** Optional pre-analysed beat map. Array of timestamps in seconds. */
export const BEATS_URL = '/audio/beats.json'

/** The song. Drop your file in public/audio/song.mp3. Missing is fine. */
export const SONG_URL = '/audio/song.mp3'

/**
 * Optional GLB hook. Set USE_GLB to true and drop a Draco-compressed model
 * at GLB_URL to replace the procedural diya with a Blender model.
 * Nothing is downloaded while this is false.
 */
export const USE_GLB = false
export const GLB_URL = '/models/diya.glb'
export const DRACO_DECODER_URL =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'

export const PALETTE = {
  night: '#070b14',
  flame: '#ff9f1c',
  gold: '#ffd166',
  deepRed: '#c1121f',
  warmWhite: '#f4e9d8',
} as const

export const CAPTIONS = {
  one: {
    kicker: 'तमसो मा ज्योतिर्गमय',
    main: 'Andhere se roshni ki taraf.',
  },
  two: {
    kicker: '',
    main: 'Ek diya se shuruaat hoti he...',
  },
  three: {
    kicker: '',
    main: '...aur ghar roshan hota he.',
  },
  four: {
    kicker: '',
    main: '...aur poora shehar jagmaga uthta he.',
  },
  five: {
    kicker: '',
    main: 'Happy Diwali',
  },
  six: {
    kicker: '',
    main: 'Mithai aur chocolate — sabke liye!',
  },
} as const

/** The exact words of the gift. */
export const WISH = {
  line1:
    'Is Diwali, aapki zindagi me itni roshni ho ki andhera bhi aapse milne se pehle sochne lage.',
  line2:
    'Laxmi ji ka aashirwad, Ganesh ji ki kripa, aur apno ka saath. Yahi sabse badi Diwali he.',
  sign: '— Sarit, Reyana & Family',
}

/** Cinematic palette used by the 3D scenes. */
export const WORLD = {
  waterY: -2.6,
  terraceY: 2.0,
  rangoliZ: -9,
  cityZ: -110,
  cityRadius: 150,
} as const
