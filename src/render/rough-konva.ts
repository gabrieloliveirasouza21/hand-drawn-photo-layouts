import Konva from 'konva'
import rough from 'roughjs'

/** Gerador do Rough.js: calcula as formas "rabiscadas" sem desenhar. */
export const gen = rough.generator()

type Drawable = ReturnType<typeof gen.rectangle>

/** Converte uma forma do Rough.js em nós Konva.Path (um por traço). */
export function toKonva(drawable: Drawable): Konva.Path[] {
  return gen.toPaths(drawable).map(
    (p) =>
      new Konva.Path({
        data: p.d,
        stroke: p.stroke === 'none' ? undefined : p.stroke,
        strokeWidth: p.strokeWidth,
        fill: !p.fill || p.fill === 'none' ? undefined : p.fill,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
      }),
  )
}

/** Mistura duas cores "#rrggbb": t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16)
  const cb = parseInt(b.slice(1), 16)
  const ch = (shift: number) =>
    Math.round(((ca >> shift) & 255) * (1 - t) + ((cb >> shift) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** "#rrggbb" para "rgba(r,g,b,a)". */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
