import Konva from 'konva'
import type { Options } from 'roughjs/bin/core'
import type { PagePattern, TapeKind } from '../templates'
import { gen, toKonva, withAlpha } from './rough-konva'

export type Point = [number, number]

/** PRNG determinístico (mulberry32): o mesmo seed desenha sempre igual. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Traço de caneta: irregular, curvo e com dupla passada (padrão do Rough.js). */
export function pen(ink: string, width: number, seed: number): Options {
  return { stroke: ink, strokeWidth: width, roughness: 2.1, bowing: 2.6, seed }
}

/**
 * Quadrilátero torto dentro de w×h (centro na origem), com um ponto no
 * meio de cada lado para o lado "envergar". Os pontos só entram, nunca
 * saem, então a foto que cobre o retângulo cobre a forma inteira.
 */
export function wobblyQuad(w: number, h: number, seed: number, amount = 0.025): Point[] {
  const r = rng(seed)
  const j = Math.min(w, h) * amount
  const d = () => r() * j
  const corners: Point[] = [
    [-w / 2 + d(), -h / 2 + d()],
    [w / 2 - d(), -h / 2 + d()],
    [w / 2 - d(), h / 2 - d()],
    [-w / 2 + d(), h / 2 - d()],
  ]
  const points: Point[] = []
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4]
    // Meio do lado, puxado para dentro em direção ao centro.
    const t = 0.35 + r() * 0.3
    const mx = a[0] + (b[0] - a[0]) * t
    const my = a[1] + (b[1] - a[1]) * t
    const pull = 1 - (r() * j * 0.7) / Math.hypot(mx, my)
    points.push(a, [mx * pull, my * pull])
  })
  return points
}

/** Recorta um grupo Konva no formato de um polígono. */
export function clipToPolygon(group: Konva.Group, points: Point[]): void {
  group.clipFunc((ctx) => {
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  })
}

/** Linha ondulada à mão, de x0 a x1 na altura y. */
export function squiggle(x0: number, x1: number, y: number, amp: number, opts: Options): Konva.Path[] {
  const r = rng(opts.seed ?? 1)
  const steps = Math.max(6, Math.round((x1 - x0) / (amp * 6)))
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    points.push([x, y + Math.sin(i * 1.7 + r() * 0.8) * amp])
  }
  return toKonva(gen.curve(points, opts))
}

/** Pauta do papel (pontilhado, linhas ou quadriculado), desenhada numa forma só. */
export function pagePattern(
  kind: PagePattern,
  w: number,
  h: number,
  ink: string,
  unit: number,
  top: number,
  left = unit,
): Konva.Shape {
  return new Konva.Shape({
    listening: false,
    sceneFunc: (context) => {
      const c = context._context
      c.save()
      c.fillStyle = withAlpha(ink, 0.22)
      c.strokeStyle = withAlpha(ink, kind === 'grid' ? 0.1 : 0.14)
      c.lineWidth = unit * 0.035
      if (kind === 'dots') {
        for (let y = top; y < h - unit / 2; y += unit) {
          for (let x = left; x < w - unit / 2; x += unit) {
            c.beginPath()
            c.arc(x, y, unit * 0.055, 0, Math.PI * 2)
            c.fill()
          }
        }
      } else {
        c.beginPath()
        for (let y = top; y < h; y += unit) {
          c.moveTo(left - unit, y)
          c.lineTo(w, y)
        }
        if (kind === 'grid') {
          for (let x = left; x < w; x += unit) {
            c.moveTo(x, top - unit)
            c.lineTo(x, h)
          }
        }
        c.stroke()
      }
      c.restore()
    },
  })
}

/** Espiral de caderno (topo ou lateral esquerda): furos e argolas desenhadas à mão. */
export function spiralBinding(side: 'top' | 'left', w: number, h: number, ink: string, unit: number): Konva.Shape[] {
  const nodes: Konva.Shape[] = []
  const length = side === 'top' ? w : h
  const gap = unit * 1.15
  const count = Math.floor((length - unit * 2) / gap)
  const start = (length - (count - 1) * gap) / 2
  for (let i = 0; i < count; i++) {
    const along = start + i * gap
    // Calcula como se fosse no topo e troca os eixos para a lateral.
    const at = (a: number, b: number): Point => (side === 'top' ? [a, b] : [b, a])
    const [hx, hy] = at(along, unit * 1.25)
    const [ex, ey] = at(along - unit * 0.12, unit * 0.72)
    const [ew, eh] = side === 'top' ? [unit * 0.42, unit * 1.3] : [unit * 1.3, unit * 0.42]
    nodes.push(new Konva.Circle({ x: hx, y: hy, radius: unit * 0.2, fill: withAlpha(ink, 0.85), listening: false }))
    nodes.push(...toKonva(gen.ellipse(ex, ey, ew, eh, pen(ink, unit * 0.09, 500 + i))))
  }
  return nodes
}

const TAPE_COLORS = ['rgba(242,193,78,0.62)', 'rgba(150,205,210,0.62)', 'rgba(240,160,160,0.62)']

/** Pedaço de fita adesiva com pontas rasgadas, centrado em (cx, cy). */
function tapePiece(cx: number, cy: number, len: number, thick: number, angle: number, color: string, seed: number): Konva.Path[] {
  const r = rng(seed)
  const half = len / 2
  const t = thick / 2
  // Contorno com pontas em zigue-zague (fita rasgada com a mão).
  const local: Point[] = [[-half, -t], [half, -t]]
  for (let k = 1; k < 4; k++) local.push([half + (r() - 0.5) * thick * 0.35, -t + (thick * k) / 4])
  local.push([half, t], [-half, t])
  for (let k = 3; k > 0; k--) local.push([-half + (r() - 0.5) * thick * 0.35, -t + (thick * k) / 4])

  const a = (angle * Math.PI) / 180
  const points = local.map(([x, y]): Point => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)])
  return toKonva(gen.polygon(points, { stroke: 'none', fill: color, fillStyle: 'solid', roughness: 0.8, seed }))
}

/** Fita prendendo a foto, em coordenadas do slot (centro na origem). */
export function tape(kind: TapeKind, w: number, h: number, index: number, seed: number): Konva.Path[] {
  const r = rng(seed)
  const color = TAPE_COLORS[index % TAPE_COLORS.length]
  const thick = Math.min(w, h) * 0.14
  if (kind === 'top') {
    return tapePiece((r() - 0.5) * w * 0.2, -h / 2, w * 0.34, thick, (r() - 0.5) * 10, color, seed)
  }
  const len = Math.min(w, h) * 0.42
  return [
    ...tapePiece(-w / 2 + len * 0.18, -h / 2 + len * 0.18, len, thick, -45 + (r() - 0.5) * 8, color, seed),
    ...tapePiece(w / 2 - len * 0.18, h / 2 - len * 0.18, len, thick, -45 + (r() - 0.5) * 8, color, seed + 1),
  ]
}
