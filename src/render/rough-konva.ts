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

/** "#rrggbb" para "rgba(r,g,b,a)". */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
