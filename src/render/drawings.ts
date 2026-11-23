import Konva from 'konva'
import type { Options } from 'roughjs/bin/core'
import type { Drawing, DrawingKind } from '../templates'
import { gen, toKonva, withAlpha } from './rough-konva'
import { rng, type Point } from './sketch'

/**
 * Rabiscos de fundo de sketchbook, desenhados como caneta esferográfica:
 * traço fino, um pouco transparente, com tremidas do Rough.js.
 * Cada função desenha centrada em (0,0), dentro de um quadrado de lado `s`.
 */

type Pen = (seed: number) => Options

const rotate = ([x, y]: Point, a: number): Point => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
const move = (points: Point[], dx: number, dy: number): Point[] => points.map(([x, y]) => [x + dx, y + dy])

/** Folha/pétala em forma de amêndoa, da base (0,0) até (len, 0), girada em `angle`. */
function almond(len: number, width: number, angle: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= 10; i++) pts.push([(len * i) / 10, (width / 2) * Math.sin((Math.PI * i) / 10)])
  for (let i = 9; i > 0; i--) pts.push([(len * i) / 10, -(width / 2) * Math.sin((Math.PI * i) / 10)])
  return pts.map((p) => rotate(p, angle))
}

function leaf(x: number, y: number, len: number, angle: number, pen: Pen, seed: number): Konva.Path[] {
  const shape = move(almond(len, len * 0.42, angle), x, y)
  const tip = rotate([len * 0.85, 0], angle)
  return [...toKonva(gen.curve([...shape, shape[0]], pen(seed))), ...toKonva(gen.line(x, y, x + tip[0], y + tip[1], pen(seed + 1)))]
}

const DRAW: Record<DrawingKind, (s: number, pen: Pen, seed: number) => Konva.Path[]> = {
  // Galho com folhas alternadas.
  branch(s, pen, seed) {
    const r = rng(seed)
    const stem: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      stem.push([Math.sin(t * Math.PI) * s * 0.08, s / 2 - t * s])
    }
    const out = toKonva(gen.curve(stem, pen(seed)))
    for (let i = 1; i < 8; i++) {
      const [x, y] = stem[i]
      const side = i % 2 ? 1 : -1
      const angle = side > 0 ? -0.5 - r() * 0.3 : Math.PI + 0.5 + r() * 0.3
      out.push(...leaf(x, y, s * (0.22 - i * 0.012), angle, pen, seed + i * 3))
    }
    return out
  },

  // Flor de pétalas soltas, com caule e duas folhas.
  flower(s, pen, seed) {
    const head = s * 0.18
    const out = toKonva(gen.circle(0, -s * 0.2, head * 0.7, pen(seed)))
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const base = rotate([head * 0.35, 0], a)
      const petal = move(almond(head * 1.5, head * 0.9, a), base[0], base[1] - s * 0.2)
      out.push(...toKonva(gen.curve([...petal, petal[0]], pen(seed + i))))
    }
    out.push(...toKonva(gen.curve([[0, -s * 0.2 + head * 0.4], [s * 0.04, s * 0.15], [-s * 0.02, s * 0.48]], pen(seed + 20))))
    out.push(...leaf(s * 0.02, s * 0.2, s * 0.2, -0.6, pen, seed + 30), ...leaf(0, s * 0.3, s * 0.2, Math.PI + 0.6, pen, seed + 40))
    return out
  },

  // Espiral.
  swirl(s, pen, seed) {
    const pts: Point[] = []
    for (let a = 0; a < Math.PI * 6; a += 0.35) pts.push(rotate([(s / 2) * (a / (Math.PI * 6)), 0], a))
    return toKonva(gen.curve(pts, pen(seed)))
  },

  // Nuvem de contorno ondulado, com duas linhas de vento.
  cloud(s, pen, seed) {
    const pts: Point[] = []
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const bump = 1 + 0.16 * Math.abs(Math.sin(a * 3.5))
      pts.push([Math.cos(a) * s * 0.42 * bump, Math.sin(a) * s * 0.22 * bump])
    }
    return [
      ...toKonva(gen.curve(pts, pen(seed))),
      ...toKonva(gen.line(-s * 0.5, s * 0.36, -s * 0.05, s * 0.36, pen(seed + 1))),
      ...toKonva(gen.line(-s * 0.3, s * 0.46, s * 0.2, s * 0.46, pen(seed + 2))),
    ]
  },

  // Sol com raios de tamanhos diferentes.
  sun(s, pen, seed) {
    const r = rng(seed)
    const out = toKonva(gen.circle(0, 0, s * 0.4, pen(seed)))
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const [x0, y0] = rotate([s * 0.27, 0], a)
      const [x1, y1] = rotate([s * (0.38 + r() * 0.12), 0], a)
      out.push(...toKonva(gen.line(x0, y0, x1, y1, pen(seed + i))))
    }
    return out
  },

  // Lua crescente com três pontinhos.
  moon(s, pen, seed) {
    const pts: Point[] = []
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI
      pts.push([Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35])
    }
    for (let i = 16; i >= 0; i--) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI
      pts.push([Math.cos(a) * s * 0.16, Math.sin(a) * s * 0.35])
    }
    return [
      ...toKonva(gen.curve(move(pts, -s * 0.1, 0), pen(seed))),
      ...[0, 1, 2].flatMap((k) => toKonva(gen.circle(s * (0.2 + k * 0.1), -s * (0.3 - k * 0.15), s * 0.03, pen(seed + k)))),
    ]
  },

  // Duas colcheias ligadas.
  notes(s, pen, seed) {
    const head = s * 0.16
    const fill = { ...pen(seed), fill: pen(seed).stroke, fillStyle: 'solid' }
    return [
      ...toKonva(gen.ellipse(-s * 0.25, s * 0.28, head * 1.3, head, fill)),
      ...toKonva(gen.ellipse(s * 0.25, s * 0.18, head * 1.3, head, fill)),
      ...toKonva(gen.line(-s * 0.25 + head * 0.6, s * 0.28, -s * 0.25 + head * 0.6, -s * 0.3, pen(seed + 1))),
      ...toKonva(gen.line(s * 0.25 + head * 0.6, s * 0.18, s * 0.25 + head * 0.6, -s * 0.4, pen(seed + 2))),
      ...toKonva(gen.line(-s * 0.25 + head * 0.6, -s * 0.3, s * 0.25 + head * 0.6, -s * 0.4, { ...pen(seed + 3), strokeWidth: (pen(seed).strokeWidth ?? 1) * 3 })),
    ]
  },

  // Raio.
  bolt(s, pen, seed) {
    const pts: Point[] = [
      [s * 0.08, -s * 0.5],
      [-s * 0.22, s * 0.05],
      [0, s * 0.05],
      [-s * 0.12, s * 0.5],
      [s * 0.24, -s * 0.08],
      [s * 0.02, -s * 0.08],
      [s * 0.14, -s * 0.5],
    ]
    return toKonva(gen.polygon(pts, pen(seed)))
  },

  // Seta curva, apontando para a direita.
  arrow(s, pen, seed) {
    const tip: Point = [s * 0.45, -s * 0.1]
    return [
      ...toKonva(gen.curve([[-s * 0.45, s * 0.2], [-s * 0.1, -s * 0.2], [s * 0.2, -s * 0.05], tip], pen(seed))),
      ...toKonva(gen.line(tip[0], tip[1], tip[0] - s * 0.16, tip[1] - s * 0.1, pen(seed + 1))),
      ...toKonva(gen.line(tip[0], tip[1], tip[0] - s * 0.12, tip[1] + s * 0.14, pen(seed + 2))),
    ]
  },

  // Olho estilizado com cílios.
  eye(s, pen, seed) {
    const upper: Point[] = []
    const lower: Point[] = []
    for (let i = 0; i <= 12; i++) {
      const x = -s / 2 + (s * i) / 12
      const k = Math.sin((Math.PI * i) / 12)
      upper.push([x, -k * s * 0.25])
      lower.push([x, k * s * 0.18])
    }
    const out = [
      ...toKonva(gen.curve(upper, pen(seed))),
      ...toKonva(gen.curve(lower, pen(seed + 1))),
      ...toKonva(gen.circle(0, -s * 0.02, s * 0.26, pen(seed + 2))),
      ...toKonva(gen.circle(0, -s * 0.02, s * 0.1, { ...pen(seed + 3), fill: pen(seed).stroke, fillStyle: 'solid' })),
    ]
    for (let i = 2; i <= 10; i += 2) {
      const [x, y] = upper[i]
      out.push(...toKonva(gen.line(x, y, x * 1.15, y - s * 0.12, pen(seed + 10 + i))))
    }
    return out
  },

  // Mancha de café: anéis irregulares marrons, bem transparentes.
  stain(s, _pen, seed) {
    const brown = 'rgba(120,78,40,0.22)'
    return [
      ...toKonva(gen.circle(0, 0, s * 0.8, { stroke: brown, strokeWidth: s * 0.035, roughness: 2.6, seed })),
      ...toKonva(gen.circle(s * 0.02, -s * 0.01, s * 0.74, { stroke: brown, strokeWidth: s * 0.012, roughness: 2.2, seed: seed + 1 })),
      ...toKonva(gen.circle(s * 0.44, s * 0.3, s * 0.06, { stroke: 'none', fill: brown, fillStyle: 'solid', roughness: 1.5, seed: seed + 2 })),
    ]
  },

  // Área sombreada em hachura cruzada.
  hatch(s, pen, seed) {
    const r = rng(seed)
    const pts: Point[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      pts.push(rotate([s * (0.32 + r() * 0.16), 0], a))
    }
    const p = pen(seed)
    return toKonva(
      gen.polygon(pts, { ...p, stroke: 'none', fill: p.stroke, fillStyle: 'cross-hatch', hachureGap: s * 0.06, fillWeight: (p.strokeWidth ?? 1) * 0.8 }),
    )
  },

  // Três linhas onduladas paralelas.
  waves(s, pen, seed) {
    return [0, 1, 2].flatMap((k) => {
      const pts: Point[] = []
      for (let i = 0; i <= 10; i++) pts.push([-s / 2 + (s * i) / 10, (k - 1) * s * 0.16 + Math.sin(i * 1.3) * s * 0.05])
      return toKonva(gen.curve(pts, pen(seed + k)))
    })
  },
}

/**
 * Desenho de fundo posicionado. `ink` = cor da caneta; `width` = espessura
 * do traço; `wash` (opcional) pinta uma mancha de aquarela por baixo.
 */
export function drawing(d: Drawing, ink: string, width: number, seed: number): Konva.Group {
  const group = new Konva.Group({ x: d.x, y: d.y, rotation: d.rotate ?? 0, listening: false })
  const pen: Pen = (s) => ({ stroke: withAlpha(ink, 0.72), strokeWidth: width, roughness: 1.5, bowing: 1.2, seed: s })

  if (d.wash) {
    // Aquarela: mancha irregular, sem contorno, deslocada do desenho.
    const r = rng(seed + 99)
    const blob: Point[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      blob.push(rotate([d.size * (0.3 + r() * 0.12), 0], a))
    }
    group.add(...toKonva(gen.curve(move([...blob, blob[0]], d.size * 0.06, d.size * 0.05), { stroke: 'none', fill: withAlpha(d.wash, 0.35), fillStyle: 'solid', roughness: 2, seed: seed + 99 })))
  }

  group.add(...DRAW[d.kind](d.size, pen, seed))
  return group
}
