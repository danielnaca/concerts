// Top and bottom HSL stops for the gradient
// H lerps 205→197, S lerps 28→19%, L lerps 83→41%
const TOP = { h: 205, s: 0, l: 0.95 }
const BOT = { h: 0, s: 0, l: 0.12 }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hlsToHex(h: number, l: number, s: number): string {
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

/**
 * Returns [topHex, bottomHex] for the page gradient.
 * hueShift offsets both H values so different concerts can have different hues.
 */
export function gradientStops(hueShift = 0): [string, string] {
  const top = hlsToHex((TOP.h + hueShift) / 360, TOP.l, TOP.s)
  const bot = hlsToHex((BOT.h + hueShift) / 360, BOT.l, BOT.s)
  return [top, bot]
}

/**
 * Tile color for artist at position i of n artists.
 * Lerps along the same H/S/L ramp as the background gradient.
 */
export function tileColor(i: number, n: number, hueShift = 0): string {
  const t = i * 0.2
  const h = lerp(TOP.h + hueShift, BOT.h + hueShift, t) / 360
  const s = lerp(TOP.s, BOT.s, t)
  const l = lerp(TOP.l, BOT.l, t)
  return hlsToHex(h, l, s)
}

/**
 * Uniform color for side carousel cards — midpoint between
 * lightest (i=0) and darkest (i=n-1) tile of a concert.
 */
export function midTileColor(n: number, hueShift = 0): string {
  const t = (n - 1) * 0.1
  const h = lerp(TOP.h + hueShift, BOT.h + hueShift, t) / 360
  const s = lerp(TOP.s, BOT.s, t)
  const l = lerp(TOP.l, BOT.l, t)
  return hlsToHex(h, l, s)
}
