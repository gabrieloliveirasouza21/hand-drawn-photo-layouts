import type { SceneKind } from '../templates'
import { rng, type Point } from './sketch'

/**
 * Motor de ilustração a nanquim: gera cenas (montanhas, floresta, mar,
 * cidade) feitas só de traços de caneta e hachuras, como desenho de
 * sketchbook com fineliner.
 *
 * Cada cena é desenhada uma vez num canvas próprio, na resolução de
 * impressão, e guardada em cache: redesenhar a tela (arrastar foto,
 * digitar legenda) não gera tudo de novo.
 */

type Op = { kind: 'stroke'; pts: number[]; w: number } | { kind: 'fill'; pts: number[] }

class Pen {
  ops: Op[] = []
  constructor(
    readonly r: () => number,
    /** Espessura base do traço. */
    readonly lw: number,
  ) {}

  /** Traço reto com leve tremida, como caneta na mão. */
  line(x0: number, y0: number, x1: number, y1: number, w = 1): void {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 0.5) return
    const n = Math.max(2, Math.ceil(len / (this.lw * 25)))
    const nx = -(y1 - y0) / len
    const ny = (x1 - x0) / len
    const amp = Math.min(len * 0.025, this.lw * 1.4)
    const pts: number[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const off = (this.r() - 0.5) * amp * (i === 0 || i === n ? 0.3 : 1)
      pts.push(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off)
    }
    this.ops.push({ kind: 'stroke', pts, w: this.lw * w * (0.75 + this.r() * 0.5) })
  }

  /** Traço passando por vários pontos (cada um com leve tremida). */
  path(points: Point[], w = 1, closed = false): void {
    const j = this.lw * 0.6
    const pts = points.flatMap(([x, y]) => [x + (this.r() - 0.5) * j, y + (this.r() - 0.5) * j])
    if (closed) pts.push(pts[0], pts[1])
    this.ops.push({ kind: 'stroke', pts, w: this.lw * w * (0.85 + this.r() * 0.3) })
  }

  /** Pinta a área com a cor do papel, escondendo o que está atrás. */
  cover(points: Point[]): void {
    this.ops.push({ kind: 'fill', pts: points.flat() })
  }

  /**
   * Hachura: linhas paralelas no ângulo dado, cortadas pelo polígono,
   * quebradas em traços de tamanhos variados e com falhas ocasionais.
   */
  hatch(poly: Point[], angleDeg: number, gap: number, w = 0.7, gappy = 0.12): void {
    const a = (angleDeg * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const rp = poly.map(([x, y]): Point => [x * cos + y * sin, -x * sin + y * cos])
    const ys = rp.map((p) => p[1])
    const ymin = Math.min(...ys)
    const ymax = Math.max(...ys)
    const back = (x: number, y: number): Point => [x * cos - y * sin, x * sin + y * cos]

    for (let y = ymin + gap * this.r(); y < ymax; y += gap * (0.75 + this.r() * 0.5)) {
      const xs: number[] = []
      for (let i = 0; i < rp.length; i++) {
        const [x0, y0] = rp[i]
        const [x1, y1] = rp[(i + 1) % rp.length]
        if (y0 === y1 || y < Math.min(y0, y1) || y >= Math.max(y0, y1)) continue
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0))
      }
      xs.sort((p, q) => p - q)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        let x = xs[k] + this.r() * gap * 0.4
        const end = xs[k + 1] - this.r() * gap * 0.4
        while (x < end) {
          const len = Math.min(end - x, gap * (5 + this.r() * 14))
          if (this.r() > gappy) {
            const [ax, ay] = back(x, y)
            const [bx, by] = back(x + len, y + (this.r() - 0.5) * gap * 0.35)
            this.line(ax, ay, bx, by, w)
          }
          x += len + gap * this.r() * 1.2
        }
      }
    }
  }

  /** Sombra escura: hachura cruzada. */
  dark(poly: Point[], angle: number, gap: number): void {
    this.hatch(poly, angle, gap, 0.7, 0.05)
    this.hatch(poly, angle + 65, gap * 1.3, 0.6, 0.15)
  }

  // --- Elementos ---

  pine(x: number, base: number, height: number, shade = 1): void {
    const width = height * (0.34 + this.r() * 0.1)
    const top = base - height
    const crown = base - height * 0.1
    const levels = Math.max(4, Math.round(height / (this.lw * 7)))
    const left: Point[] = [[x, top]]
    const right: Point[] = [[x, top]]
    for (let k = 1; k <= levels; k++) {
      const t = k / levels
      const y = top + (crown - top) * t
      const half = (width / 2) * t * (0.85 + this.r() * 0.3)
      // Galhos em zigue-zague: ponta para fora, volta para dentro.
      left.push([x - half, y], [x - half * 0.55, y - (crown - top) / levels / 3])
      right.push([x + half, y], [x + half * 0.55, y - (crown - top) / levels / 3])
    }
    const outline = [...left, ...right.slice().reverse()]
    this.cover(outline)
    this.path(left, 0.9)
    this.path(right, 0.9)
    this.line(x, crown, x + (this.r() - 0.5) * this.lw, base, 1.1)
    if (shade > 0) {
      const gap = this.lw * (shade > 0.6 ? 2.2 : 3.8)
      this.hatch(outline, 65 + this.r() * 20, gap, 0.7, 0.1)
      if (shade > 0.6) this.hatch(left.concat([[x, crown]]), -50, gap * 1.4, 0.6, 0.2)
    }
  }

  grass(x: number, y: number, size: number): void {
    const n = 4 + Math.floor(this.r() * 5)
    for (let i = 0; i < n; i++) {
      const bx = x + (this.r() - 0.5) * size
      const a = -Math.PI / 2 + (this.r() - 0.5) * 0.9
      const len = size * (0.4 + this.r() * 0.7)
      this.line(bx, y, bx + Math.cos(a) * len, y + Math.sin(a) * len, 0.7)
    }
  }

  bird(x: number, y: number, s: number): void {
    const flap = s * (0.25 + this.r() * 0.25)
    this.path([[x - s, y - flap * 0.6], [x - s * 0.45, y - flap], [x, y]], 0.8)
    this.path([[x, y], [x + s * 0.45, y - flap], [x + s, y - flap * 0.6]], 0.8)
  }

  /** Nuvem cúmulo: bolhas de tamanhos diferentes, mais altas no meio, com cachos internos. */
  cloud(cx: number, cy: number, cw: number): void {
    // Bolhas (círculos) de tamanhos diferentes, mais altas no meio.
    const count = 6 + Math.floor(this.r() * 4)
    const blobs: [number, number, number][] = []
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count
      const lift = Math.sin(t * Math.PI)
      const rad = (cw / count) * (0.5 + lift * 0.45 + this.r() * 0.35)
      blobs.push([cx - cw / 2 + cw * t, cy - lift * cw * 0.09 - (this.r() - 0.3) * rad * 0.7, rad])
    }
    // Contorno = silhueta de cima da união das bolhas (sem riscos internos).
    const pts: Point[] = []
    const steps = 48
    for (let k = 0; k <= steps; k++) {
      const x = cx - cw / 2 + (cw * k) / steps
      let y = cy
      for (const [bx, by, br] of blobs) {
        const dx = x - bx
        if (Math.abs(dx) < br) y = Math.min(y, by - Math.sqrt(br * br - dx * dx))
      }
      pts.push([x, y])
    }
    // Cachos: arco curto nas bolhas que ficam "na frente".
    const inner = blobs.filter(() => this.r() < 0.45).map(([bx, by, br]): [number, number, number] => [bx, by + br * 0.5, br])
    const base: Point[] = [[cx + cw * 0.45, cy + cw * 0.02], [cx - cw * 0.45, cy + cw * 0.015]]
    this.cover([...pts, ...base])
    this.path(pts, 1)
    this.path([[cx - cw * 0.5, cy], [cx - cw * 0.1, cy + cw * 0.025], [cx + cw * 0.5, cy]], 0.8)
    // Cachos: arcos curtos dentro da nuvem.
    for (const [ix, iy, rad] of inner) {
      const arc: Point[] = []
      for (let k = 0; k <= 4; k++) {
        const a = Math.PI * 1.15 + (Math.PI * 0.55 * k) / 4
        arc.push([ix + Math.cos(a) * rad * 0.55, Math.min(cy - this.lw * 3, iy + Math.sin(a) * rad * 0.5)])
      }
      this.path(arc, 0.6)
    }
    // Sombra embaixo.
    this.hatch([[cx - cw * 0.4, cy - cw * 0.03], [cx + cw * 0.42, cy - cw * 0.03], [cx + cw * 0.4, cy + cw * 0.015], [cx - cw * 0.4, cy + cw * 0.01]], 8, this.lw * 2.6, 0.6, 0.3)
  }
}

// --- Cenas ---

/** Linha quebrada entre dois pontos: degraus e recortes de rocha. */
function jagged(pen: Pen, a: Point, b: Point, rough: number, steps = 9): Point[] {
  const pts: Point[] = []
  for (let k = 1; k <= steps; k++) {
    const t = k / steps
    const n = k === steps ? 0 : (pen.r() - 0.5) * rough
    // De vez em quando um "degrau": a linha anda reto antes de cair.
    const step = pen.r() < 0.25 ? rough * 0.6 : 0
    pts.push([a[0] + (b[0] - a[0]) * t + step, a[1] + (b[1] - a[1]) * t + n])
  }
  return pts
}

/** Cordilheira: cumes recortados, lado da sombra hachurado seguindo a encosta. */
function range(pen: Pen, w: number, horizon: number, minTop: number, maxTop: number, peaks: number, shade: number): void {
  const r = pen.r
  const ridge: Point[] = [[-w * 0.05, horizon - (horizon - maxTop) * 0.35]]
  const tops: { p: Point; at: number; valley: number }[] = []
  for (let i = 0; i < peaks; i++) {
    const px = (w * (i + 0.25 + r() * 0.5)) / peaks
    const py = minTop + (maxTop - minTop) * r()
    const rough = (horizon - py) * 0.07
    ridge.push(...jagged(pen, ridge[ridge.length - 1], [px, py], rough))
    const at = ridge.length - 1
    const nx = i + 1 < peaks ? px + (w / peaks) * (0.45 + r() * 0.2) : w * 1.05
    const ny = py + (horizon - py) * (0.3 + r() * 0.35)
    ridge.push(...jagged(pen, [px, py], [nx, ny], rough))
    tops.push({ p: [px, py], at, valley: ridge.length - 1 })
  }
  const body: Point[] = [...ridge, [w * 1.05, horizon], [-w * 0.05, horizon]]
  pen.cover(body)
  pen.path(ridge, 1.3)

  for (const { p: [px, py], at, valley } of tops) {
    const [vx, vy] = ridge[valley]
    // Crista que desce do cume: separa lado iluminado do lado da sombra.
    const foot: Point = [px + (vx - px) * (0.15 + r() * 0.25), horizon]
    const crest = [[px, py] as Point, ...jagged(pen, [px, py], foot, (horizon - py) * 0.05, 7)]
    pen.path(crest, 0.9)
    // Sombra à direita da crista, hachurada no sentido da encosta.
    const shadow: Point[] = [...ridge.slice(at, valley + 1), [vx, horizon], ...crest.slice().reverse()]
    const slope = (Math.atan2(vy - py, vx - px) * 180) / Math.PI
    if (shade > 0.6) pen.dark(shadow, slope + 8, pen.lw * 1.9)
    else pen.hatch(shadow, slope + 10, pen.lw * 2.8, 0.7, 0.12)
    // Lado iluminado: poucos traços curtos seguindo a outra encosta.
    const [lx, ly] = ridge[Math.max(0, at - 8)]
    for (let k = 0; k < 7; k++) {
      const t = 0.15 + r() * 0.7
      const sx = px + (lx - px) * t + r() * (px - lx) * 0.3
      const sy = py + (ly - py) * t + (horizon - py) * r() * 0.45
      const a = Math.atan2(ly - py, lx - px)
      const len = pen.lw * (8 + r() * 18)
      pen.line(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, 0.6)
    }
    // Rachaduras/fendas descendo pela sombra.
    for (let k = 0; k < 3; k++) {
      const [sx, sy] = ridge[at + 1 + Math.floor(r() * Math.max(1, valley - at - 1))]
      pen.path([[sx, sy], ...jagged(pen, [sx, sy], [sx - (horizon - sy) * 0.15, sy + (horizon - sy) * (0.3 + r() * 0.3)], pen.lw * 4, 4)], 1)
    }
  }
}

function forestRow(pen: Pen, w: number, base: number, minH: number, maxH: number, spacing: number, shade: number): Point[] {
  const trees: Point[] = []
  for (let x = -spacing * pen.r(); x < w + spacing; x += spacing * (0.5 + pen.r() * 0.8)) {
    const h = minH + (maxH - minH) * pen.r()
    const b = base + (pen.r() - 0.5) * minH * 0.15
    trees.push([x, h])
    pen.pine(x, b, h, shade)
  }
  return trees
}

function water(pen: Pen, w: number, top: number, bottom: number): void {
  let gap = pen.lw * 4
  for (let y = top + gap; y < bottom; y += gap) {
    let x = -pen.r() * w * 0.1
    while (x < w) {
      const len = w * (0.04 + pen.r() * 0.18)
      if (pen.r() > 0.35) pen.line(x, y, x + len, y + (pen.r() - 0.5) * pen.lw, 0.6)
      x += len + w * (0.02 + pen.r() * 0.1)
    }
    gap *= 1.12
  }
}

// --- Elementos extras (usados por várias cenas) ---

/** Contorno irregular de uma elipse (copas, pedras, cabeças). */
function blob(pen: Pen, cx: number, cy: number, rx: number, ry: number, n = 14, wobble = 0.25): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + (pen.r() - 0.5) * wobble
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return pts
}

function sun(pen: Pen, cx: number, cy: number, rad: number): void {
  pen.cover(blob(pen, cx, cy, rad * 1.05, rad * 1.05, 20, 0.05))
  pen.path(blob(pen, cx, cy, rad, rad, 24, 0.06), 1, true)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + pen.r() * 0.1
    const r0 = rad * 1.3
    const r1 = rad * (1.55 + pen.r() * 0.4)
    pen.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 0.8)
  }
}

function moon(pen: Pen, cx: number, cy: number, rad: number): void {
  const outer: Point[] = []
  const inner: Point[] = []
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI
    outer.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
    inner.push([cx + Math.cos(a) * rad * 0.45, cy + Math.sin(a) * rad])
  }
  const shape = [...outer, ...inner.reverse()]
  pen.cover(shape)
  pen.path(shape, 1, true)
  pen.hatch(shape, 60, pen.lw * 2.2, 0.6, 0.2)
  for (let i = 0; i < 6; i++) {
    const sx = cx + (pen.r() - 0.5) * rad * 8
    const sy = cy + (pen.r() - 0.5) * rad * 3
    const s = pen.lw * (2 + pen.r() * 3)
    pen.line(sx - s, sy, sx + s, sy, 0.6)
    pen.line(sx, sy - s, sx, sy + s, 0.6)
  }
}

/** Árvore de copa redonda, sombreada embaixo. */
function roundTree(pen: Pen, x: number, base: number, size: number): void {
  const cy = base - size * 0.75
  pen.line(x - size * 0.04, base, x - size * 0.03, cy + size * 0.2, 1)
  pen.line(x + size * 0.05, base, x + size * 0.03, cy + size * 0.2, 1)
  const crown = blob(pen, x, cy, size * 0.42, size * 0.36, 16, 0.3)
  pen.cover(crown)
  pen.path(crown, 1, true)
  pen.hatch(crown.filter(([, y]) => y > cy - size * 0.05).concat([[x - size * 0.42, cy], [x + size * 0.42, cy]]), 50, pen.lw * 2.2, 0.6, 0.1)
  pen.hatch(crown, -35, pen.lw * 4, 0.5, 0.4)
}

/** Casinha de campo: paredes, telhado hachurado, porta e janela. */
function house(pen: Pen, x: number, base: number, size: number): void {
  const w = size
  const hh = size * 0.6
  const walls: Point[] = [[x, base], [x, base - hh], [x + w, base - hh], [x + w, base]]
  const roof: Point[] = [[x - w * 0.08, base - hh], [x + w * 0.5, base - hh - size * 0.45], [x + w * 1.08, base - hh]]
  pen.cover([...walls, ...roof])
  pen.path(walls, 1.1)
  pen.path(roof, 1.1, true)
  pen.hatch(roof, 25, pen.lw * 2, 0.6, 0.1)
  const door: Point[] = [[x + w * 0.15, base], [x + w * 0.15, base - hh * 0.6], [x + w * 0.35, base - hh * 0.6], [x + w * 0.35, base]]
  pen.path(door, 0.9)
  pen.dark(door, 80, pen.lw * 1.6)
  const win: Point[] = [[x + w * 0.55, base - hh * 0.65], [x + w * 0.85, base - hh * 0.65], [x + w * 0.85, base - hh * 0.3], [x + w * 0.55, base - hh * 0.3]]
  pen.path(win, 0.8, true)
  pen.line(x + w * 0.7, base - hh * 0.65, x + w * 0.7, base - hh * 0.3, 0.6)
  pen.line(x + w * 0.55, base - hh * 0.47, x + w * 0.85, base - hh * 0.47, 0.6)
  pen.hatch([[x + w * 0.75, base], [x + w, base], [x + w, base - hh], [x + w * 0.92, base - hh]], 90, pen.lw * 2.6, 0.6, 0.2)
}

function fence(pen: Pen, x0: number, y0: number, x1: number, y1: number, posts: number, h0: number, h1: number): void {
  const tops: Point[] = []
  const mids: Point[] = []
  for (let i = 0; i <= posts; i++) {
    const t = i / posts
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    const ph = h0 + (h1 - h0) * t
    pen.line(x, y, x + (pen.r() - 0.5) * pen.lw, y - ph, 1)
    tops.push([x, y - ph * 0.85])
    mids.push([x, y - ph * 0.45])
  }
  pen.path(tops, 0.8)
  pen.path(mids, 0.8)
}

function saguaro(pen: Pen, x: number, base: number, height: number): void {
  const tw = height * 0.12
  const cap = (cx: number, top: number, wd: number): Point[] => {
    const pts: Point[] = []
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI + (Math.PI * k) / 6
      pts.push([cx + Math.cos(a) * wd / 2, top + Math.sin(a) * wd / 2])
    }
    return pts
  }
  const trunk: Point[] = [[x - tw / 2, base], ...cap(x, base - height + tw / 2, tw), [x + tw / 2, base]]
  const parts: Point[][] = [trunk]
  // Braços em "L": saem do tronco, dobram e sobem com a ponta arredondada.
  for (const side of [-1, 1]) {
    if (pen.r() < 0.2) continue
    const ay = base - height * (0.35 + pen.r() * 0.2)
    const aw = tw * 0.8
    const ax = x + side * tw * (1.4 + pen.r() * 0.4)
    const up = height * (0.18 + pen.r() * 0.2)
    const xt = x + (side * tw) / 2
    const top: Point[] = []
    for (let k = 0; k <= 6; k++) {
      // De fora para dentro, por cima.
      const a = side > 0 ? (-Math.PI * k) / 6 : -Math.PI + (Math.PI * k) / 6
      top.push([ax + (Math.cos(a) * aw) / 2, ay - up + (Math.sin(a) * aw) / 2])
    }
    parts.push([[xt, ay + aw], [ax + (side * aw) / 2, ay + aw], ...top, [ax - (side * aw) / 2, ay], [xt, ay]])
  }
  for (const p of parts) {
    pen.cover(p)
    pen.path(p, 1)
  }
  pen.hatch([[x + tw * 0.1, base], [x + tw / 2, base], [x + tw / 2, base - height + tw / 2], [x + tw * 0.1, base - height + tw / 2]], 90, pen.lw * 1.8, 0.6, 0.1)
  pen.line(x - tw * 0.15, base, x - tw * 0.15, base - height + tw * 0.7, 0.5)
}

function palm(pen: Pen, x: number, base: number, height: number, lean: number): void {
  const spine: Point[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    spine.push([x + lean * height * t * t, base - height * t])
  }
  const tw = height * 0.06
  const left = spine.map(([sx, sy], i): Point => [sx - tw * (1 - i * 0.05), sy])
  const right = spine.map(([sx, sy], i): Point => [sx + tw * (1 - i * 0.05), sy])
  pen.cover([...left, ...right.slice().reverse()])
  pen.path(left, 1.1)
  pen.path(right, 1.1)
  // Anéis do tronco e sombra num lado.
  for (let i = 1; i < 10; i++) {
    const [sx, sy] = spine[i]
    pen.path([[sx - tw * 0.95, sy], [sx, sy + pen.lw * 2], [sx + tw * 0.95, sy]], 0.6)
  }
  pen.hatch([...spine.map(([sx, sy]): Point => [sx + tw * 0.2, sy]), ...right.slice().reverse()], 80, pen.lw * 2, 0.5, 0.2)
  const [tx, ty] = spine[10]
  for (let f = 0; f < 9; f++) {
    const a = -Math.PI * 0.95 + (f / 8) * Math.PI * 0.9 + (pen.r() - 0.5) * 0.25
    const len = height * (0.5 + pen.r() * 0.2)
    const frond: Point[] = []
    for (let k = 0; k <= 10; k++) {
      const t = k / 10
      // Sobe um pouco e despenca, como folha de coqueiro.
      frond.push([tx + Math.cos(a) * len * t, ty + Math.sin(a) * len * t * 0.45 + len * 0.7 * t * t])
    }
    pen.path(frond, 1)
    for (let k = 1; k < 10; k++) {
      const [fx, fy] = frond[k]
      const leaf = len * 0.16 * Math.sin((Math.PI * k) / 10)
      pen.line(fx, fy, fx + leaf * 0.35, fy + leaf, 0.6)
      pen.line(fx, fy, fx - leaf * 0.35, fy + leaf, 0.6)
    }
  }
  pen.path(blob(pen, tx, ty + height * 0.03, height * 0.05, height * 0.035, 8, 0.2), 0.8, true)
}

function boat(pen: Pen, cx: number, cy: number, s: number): void {
  const hull: Point[] = [[cx - s, cy - s * 0.15], [cx + s, cy - s * 0.15], [cx + s * 0.7, cy + s * 0.15], [cx - s * 0.7, cy + s * 0.15]]
  pen.cover(hull)
  pen.path(hull, 1, true)
  pen.dark(hull, 80, pen.lw * 1.6)
  pen.line(cx, cy - s * 0.15, cx, cy - s * 1.5, 1)
  const sail: Point[] = [[cx + pen.lw, cy - s * 1.45], [cx + s * 0.8, cy - s * 0.25], [cx + pen.lw, cy - s * 0.25]]
  pen.cover(sail)
  pen.path(sail, 0.9, true)
  pen.hatch(sail, 75, pen.lw * 3, 0.5, 0.3)
  for (let i = 0; i < 3; i++) pen.line(cx - s * (0.6 - i * 0.1), cy + s * (0.3 + i * 0.12), cx + s * (0.5 - i * 0.1), cy + s * (0.3 + i * 0.12), 0.6)
}

function lighthouse(pen: Pen, x: number, base: number, height: number): void {
  const bw = height * 0.16
  const tw = height * 0.1
  const top = base - height * 0.78
  const tower: Point[] = [[x - bw / 2, base], [x - tw / 2, top], [x + tw / 2, top], [x + bw / 2, base]]
  pen.cover(tower)
  pen.path(tower, 1.1, true)
  // Faixas alternadas, uma sim, uma não, hachuradas.
  for (let k = 0; k < 4; k += 2) {
    const y0 = base - ((k + 1) * (base - top)) / 4
    const y1 = base - ((k + 2) * (base - top)) / 4
    const w0 = bw + ((tw - bw) * (base - y0)) / (base - top)
    const w1 = bw + ((tw - bw) * (base - y1)) / (base - top)
    pen.dark([[x - w0 / 2, y0], [x + w0 / 2, y0], [x + w1 / 2, y1], [x - w1 / 2, y1]], 70, pen.lw * 1.8)
  }
  const room: Point[] = [[x - tw * 0.6, top], [x - tw * 0.6, top - height * 0.1], [x + tw * 0.6, top - height * 0.1], [x + tw * 0.6, top]]
  pen.cover(room)
  pen.path(room, 1, true)
  pen.path([[x - tw * 0.75, top - height * 0.1], [x, top - height * 0.2], [x + tw * 0.75, top - height * 0.1]], 1, true)
  for (const dir of [-1, 1]) {
    pen.line(x + dir * tw, top - height * 0.07, x + dir * height * 0.5, top - height * 0.15, 0.6)
    pen.line(x + dir * tw, top - height * 0.03, x + dir * height * 0.5, top + height * 0.02, 0.6)
  }
}

// --- Cenas ---

const SCENES: Record<SceneKind, (pen: Pen, w: number, h: number) => void> = {
  mountains(pen, w, h) {
    const r = pen.r
    const horizon = h * (0.58 + r() * 0.1)
    const clouds = Math.floor(r() * 4)
    for (let i = 0; i < clouds; i++) pen.cloud(w * (0.1 + r() * 0.8), h * (0.06 + r() * 0.14), w * (0.16 + r() * 0.16))
    if (r() < 0.35) sun(pen, w * (0.15 + r() * 0.7), h * (0.08 + r() * 0.06), Math.min(w, h) * 0.05)
    range(pen, w, horizon, h * 0.12, h * 0.3, 2 + Math.floor(r() * 3), 0.4)
    range(pen, w, horizon, h * 0.22, h * 0.42, 2 + Math.round(r()), 1)
    const trees = forestRow(pen, w, horizon, h * 0.06, h * 0.16, w * (0.03 + r() * 0.03), 1)
    pen.cover([[0, horizon], [w, horizon], [w, h], [0, h]])
    if (r() < 0.55) {
      // Lago com reflexo dos pinheiros.
      pen.path([[0, horizon], [w * 0.3, horizon + pen.lw], [w * 0.7, horizon - pen.lw], [w, horizon]], 1.1)
      for (const [x, th] of trees) {
        if (r() < 0.5) continue
        const len = th * (0.3 + r() * 0.4)
        pen.hatch([[x - th * 0.12, horizon + pen.lw * 2], [x + th * 0.12, horizon + pen.lw * 2], [x, horizon + len]], 90, pen.lw * 2.5, 0.6, 0.3)
      }
      water(pen, w, horizon, h)
      if (r() < 0.4) boat(pen, w * (0.2 + r() * 0.6), horizon + (h - horizon) * 0.45, Math.min(w, h) * 0.05)
    } else {
      // Campina com cerca e uma trilha.
      pen.line(0, horizon, w, horizon, 1)
      for (let i = 0; i < 50; i++) {
        const y = horizon + (h - horizon) * r()
        pen.grass(r() * w, y, w * (0.01 + 0.03 * ((y - horizon) / (h - horizon))))
      }
      const fy = horizon + (h - horizon) * 0.55
      fence(pen, -w * 0.02, fy + h * 0.1, w * 0.55, fy - h * 0.05, 7, h * 0.12, h * 0.05)
      if (r() < 0.5) house(pen, w * (0.6 + r() * 0.2), horizon + (h - horizon) * 0.3, Math.min(w, h) * 0.12)
    }
    const birds = Math.floor(r() * 6)
    for (let i = 0; i < birds; i++) pen.bird(w * (0.3 + r() * 0.6), h * (0.05 + r() * 0.12), w * 0.015 + r() * w * 0.01)
  },

  forest(pen, w, h) {
    const r = pen.r
    const hill = h * (0.45 + r() * 0.1)
    // Morros ao fundo.
    const ridge: Point[] = []
    for (let i = 0; i <= 8; i++) ridge.push([(w * i) / 8, hill - h * (0.08 + 0.1 * Math.sin(i * 0.9 + r() * 3))])
    pen.path(ridge, 1)
    pen.hatch([...ridge, [w, hill], [0, hill]], 70, pen.lw * 4, 0.6, 0.3)
    if (r() < 0.4) moon(pen, w * (0.6 + r() * 0.3), h * 0.12, Math.min(w, h) * 0.05)
    forestRow(pen, w, hill, h * 0.08, h * 0.14, w * 0.05, 0.5)
    if (r() < 0.45) house(pen, w * (0.15 + r() * 0.5), hill + h * 0.04, Math.min(w, h) * 0.1)
    // Trilha ou rio serpenteando até o fundo.
    const river = r() < 0.45
    const pathL: Point[] = []
    const pathR: Point[] = []
    const phase = r() * 3
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const cx = w * 0.5 + Math.sin(t * 3.2 + phase) * w * 0.15 * t
      const half = w * (0.02 + 0.13 * t)
      const y = hill + (h - hill) * t
      pathL.push([cx - half, y])
      pathR.push([cx + half, y])
    }
    const strip = [...pathL, ...pathR.slice().reverse()]
    pen.cover(strip)
    pen.path(pathL, 0.9)
    pen.path(pathR, 0.9)
    if (river) pen.hatch(strip, 2, pen.lw * 4.5, 0.6, 0.45)
    // Pinheiros grandes nas laterais.
    for (const side of [0, 1]) {
      const n = 1 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) {
        const x = side ? w * (0.8 + r() * 0.18) : w * (0.02 + r() * 0.18)
        if (r() < 0.3) roundTree(pen, x, h * (0.7 + k * 0.12), h * (0.22 + r() * 0.1))
        else pen.pine(x, h * (0.7 + k * 0.12), h * (0.25 + r() * 0.15), 1)
      }
    }
    // Grama em primeiro plano.
    for (let i = 0; i < 70; i++) {
      const x = r() * w
      const y = hill + (h - hill) * (0.1 + r() * 0.9)
      if (Math.abs(x - w / 2) < w * 0.12 * ((y - hill) / (h - hill)) + w * 0.03) continue
      // Mais perto (mais embaixo) = tufos maiores.
      pen.grass(x, y, w * (0.015 + 0.03 * ((y - hill) / (h - hill))))
    }
    for (let i = 0; i < 3; i++) pen.bird(w * (0.3 + r() * 0.4), h * (0.08 + r() * 0.1), w * 0.02)
  },

  sea(pen, w, h) {
    const r = pen.r
    const horizon = h * (0.36 + r() * 0.12)
    // Faixa de terra escura ao longe, num dos lados.
    const left = r() < 0.5
    const lx = (v: number) => (left ? v : w - v)
    const land: Point[] = [[lx(-w * 0.02), horizon], [lx(w * 0.05), horizon - h * 0.05], [lx(w * 0.22), horizon - h * 0.07], [lx(w * 0.35), horizon - h * 0.02], [lx(w * 0.42), horizon]]
    pen.path(land, 1)
    pen.dark(land, 80, pen.lw * 2)
    if (r() < 0.5) lighthouse(pen, lx(w * 0.15), horizon - h * 0.06, h * 0.2)
    pen.line(0, horizon, w, horizon, 1)
    // Riscos de céu.
    for (let i = 0; i < 5; i++) {
      const y = h * (0.08 + r() * 0.25)
      const x = w * (0.5 + r() * 0.4)
      pen.line(x, y, x + w * (0.1 + r() * 0.2), y + (r() - 0.5) * pen.lw * 2, 0.9)
      pen.line(x + w * 0.02, y + pen.lw * 3, x + w * (0.08 + r() * 0.12), y + pen.lw * 3, 0.6)
    }
    water(pen, w, horizon, h)
    if (r() < 0.55) boat(pen, w * (0.45 + r() * 0.4), horizon + (h - horizon) * (0.2 + r() * 0.2), Math.min(w, h) * 0.06)
    // Pedras com a base escura.
    const rocks = 1 + Math.floor(r() * 5)
    for (let i = 0; i < rocks; i++) {
      const cx = w * (0.1 + r() * 0.8)
      const cy = horizon + (h - horizon) * (0.25 + r() * 0.65)
      const s = w * (0.04 + r() * 0.08) * (0.5 + (cy - horizon) / (h - horizon))
      const rock: Point[] = [[cx - s, cy], [cx - s * 0.6, cy - s * 0.45], [cx - s * 0.1, cy - s * 0.6], [cx + s * 0.5, cy - s * 0.35], [cx + s, cy]]
      pen.cover(rock)
      pen.path(rock, 1, true)
      pen.dark(rock.slice(1).concat([[cx - s * 0.3, cy]]), 70, pen.lw * 1.8)
    }
    for (let i = 0; i < 5; i++) pen.bird(w * (0.1 + r() * 0.8), h * (0.06 + r() * 0.22), w * 0.018)
  },

  beach(pen, w, h) {
    const r = pen.r
    const horizon = h * (0.34 + r() * 0.08)
    const shore = h * (0.6 + r() * 0.08)
    if (r() < 0.6) {
      // Sol se pondo no horizonte.
      const rad = Math.min(w, h) * 0.09
      const cx = w * (0.3 + r() * 0.4)
      const half: Point[] = []
      for (let k = 0; k <= 12; k++) half.push([cx + Math.cos(Math.PI + (Math.PI * k) / 12) * rad, horizon + Math.sin(Math.PI + (Math.PI * k) / 12) * rad])
      pen.path(half, 1)
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (Math.PI * (i + 0.5)) / 9
        pen.line(cx + Math.cos(a) * rad * 1.3, horizon + Math.sin(a) * rad * 1.3, cx + Math.cos(a) * rad * 1.8, horizon + Math.sin(a) * rad * 1.8, 0.8)
      }
    }
    pen.line(0, horizon, w, horizon, 1)
    water(pen, w, horizon, shore)
    // Espuma das ondas na beira.
    const foam: Point[] = []
    for (let i = 0; i <= 16; i++) foam.push([(w * i) / 16, shore + Math.sin(i * 1.3 + r()) * h * 0.012])
    pen.cover([...foam, [w, h], [0, h]])
    pen.path(foam, 1.1)
    pen.path(foam.map(([x, y]): Point => [x, y - h * 0.02]).filter((_, i) => i % 3 !== 0), 0.6)
    // Areia pontilhada, mais densa perto.
    for (let i = 0; i < 260; i++) {
      const x = r() * w
      const y = shore + (h - shore) * Math.sqrt(r())
      pen.line(x, y, x + pen.lw * 0.8, y + pen.lw * 0.3, 0.7)
    }
    const palms = 1 + Math.floor(r() * 3)
    for (let i = 0; i < palms; i++) {
      const side = i % 2 ? 1 : -1
      const x = side > 0 ? w * (0.75 + r() * 0.2) : w * (0.05 + r() * 0.2)
      palm(pen, x, h * (0.85 + r() * 0.12), h * (0.45 + r() * 0.2), -side * (0.15 + r() * 0.2))
    }
    if (r() < 0.5) boat(pen, w * (0.3 + r() * 0.4), horizon + (shore - horizon) * 0.35, Math.min(w, h) * 0.04)
    for (let i = 0; i < 4; i++) pen.bird(w * (0.2 + r() * 0.6), h * (0.08 + r() * 0.15), w * 0.018)
  },

  fields(pen, w, h) {
    const r = pen.r
    const horizon = h * (0.4 + r() * 0.1)
    if (r() < 0.5) sun(pen, w * (0.2 + r() * 0.6), h * 0.12, Math.min(w, h) * 0.05)
    else for (let i = 0; i < 2; i++) pen.cloud(w * (0.15 + r() * 0.7), h * (0.08 + r() * 0.12), w * 0.22)
    // Colinas em camadas, cada uma com hachura num ângulo (campos de plantação).
    for (let layer = 0; layer < 4; layer++) {
      const base = horizon + (h - horizon) * (layer / 4)
      const crest: Point[] = []
      for (let i = 0; i <= 10; i++) crest.push([(w * i) / 10, base - h * 0.06 * Math.sin(i * 0.7 + layer * 1.7 + r())])
      const field = [...crest, [w, h] as Point, [0, h] as Point]
      pen.cover(field)
      pen.path(crest, 1)
      const angle = [15, -20, 70, 5][layer] + (r() - 0.5) * 10
      pen.hatch(field.slice(0, 11).concat([[w, base + (h - horizon) / 4], [0, base + (h - horizon) / 4]]), angle, pen.lw * (5 - layer * 0.8), 0.6, 0.3)
      if (layer === 0) {
        if (r() < 0.75) house(pen, w * (0.55 + r() * 0.3), base - h * 0.02, Math.min(w, h) * 0.1)
        for (let k = 0; k < 3; k++) roundTree(pen, w * (0.05 + r() * 0.5), base, Math.min(w, h) * (0.1 + r() * 0.06))
      }
    }
    // Fardos de feno no campo da frente.
    if (r() < 0.6) {
      for (let k = 0; k < 3; k++) {
        const hx = w * (0.15 + k * 0.25 + r() * 0.1)
        const hy = horizon + (h - horizon) * (0.62 + r() * 0.08)
        const s = Math.min(w, h) * 0.05
        const bale: Point[] = []
        for (let i = 0; i <= 10; i++) bale.push([hx - s + (2 * s * i) / 10, hy - Math.sin((Math.PI * i) / 10) * s * 1.1])
        pen.cover(bale)
        pen.path(bale, 1, true)
        pen.hatch(bale, 80, pen.lw * 2, 0.6, 0.2)
      }
    }
    fence(pen, -w * 0.02, h * 0.98, w * 1.02, h * 0.9, 9, h * 0.12, h * 0.09)
    for (let i = 0; i < 3; i++) pen.bird(w * (0.2 + r() * 0.6), h * (0.05 + r() * 0.12), w * 0.016)
  },

  desert(pen, w, h) {
    const r = pen.r
    const horizon = h * (0.5 + r() * 0.12)
    if (r() < 0.6) sun(pen, w * (0.2 + r() * 0.6), h * (0.12 + r() * 0.08), Math.min(w, h) * 0.07)
    else moon(pen, w * (0.6 + r() * 0.3), h * 0.12, Math.min(w, h) * 0.05)
    // Mesas (morros de topo reto) ao longe.
    const mesas = 1 + Math.floor(r() * 3)
    for (let i = 0; i < mesas; i++) {
      const x0 = w * (r() * 0.7)
      const x1 = x0 + w * (0.15 + r() * 0.25)
      const top = horizon - h * (0.08 + r() * 0.12)
      const shape: Point[] = [[x0, horizon], ...jagged(pen, [x0 + (x1 - x0) * 0.15, top], [x1 - (x1 - x0) * 0.12, top], pen.lw * 3, 6), [x1, horizon]]
      shape.splice(1, 0, [x0 + (x1 - x0) * 0.15, top])
      pen.cover(shape)
      pen.path(shape, 1.1)
      pen.dark([[x1 - (x1 - x0) * 0.12, top], [x1, horizon], [x1 - (x1 - x0) * 0.3, horizon], [x1 - (x1 - x0) * 0.22, top]], 75, pen.lw * 2)
      for (let k = 1; k < 4; k++) {
        const y = top + ((horizon - top) * k) / 4
        pen.line(x0 + (x1 - x0) * (0.15 - 0.05 * k), y, x1 - (x1 - x0) * (0.35 - 0.05 * k), y + (r() - 0.5) * pen.lw * 2, 0.6)
      }
    }
    pen.line(0, horizon, w, horizon, 1)
    // Dunas com sombra.
    for (let d = 0; d < 3; d++) {
      const y = horizon + (h - horizon) * (0.25 + d * 0.25)
      const crest: Point[] = []
      for (let i = 0; i <= 8; i++) crest.push([(w * i) / 8, y - h * 0.04 * Math.sin(i * 0.9 + d * 2 + r())])
      pen.cover([...crest, [w, h], [0, h]])
      pen.path(crest, 1)
      for (let i = 0; i < 25; i++) {
        const x = r() * w
        const yy = y + r() * (h - horizon) * 0.12
        pen.line(x, yy, x + w * 0.02, yy + pen.lw, 0.5)
      }
    }
    const cacti = 1 + Math.floor(r() * 4)
    for (let i = 0; i < cacti; i++) {
      const near = r()
      saguaro(pen, w * (0.08 + r() * 0.84), horizon + (h - horizon) * (0.3 + near * 0.65), h * (0.2 + near * 0.35))
    }
    for (let i = 0; i < 4; i++) {
      const rx = w * r()
      const ry = horizon + (h - horizon) * (0.4 + r() * 0.6)
      const rock = blob(pen, rx, ry, w * 0.03, h * 0.015, 9, 0.4)
      pen.cover(rock)
      pen.path(rock, 0.9, true)
    }
    // Urubus circulando.
    for (let i = 0; i < 3; i++) pen.bird(w * (0.3 + r() * 0.4), h * (0.1 + r() * 0.1), w * 0.025)
  },

}

/** Todos os cenários, na ordem do menu. */
export const SCENE_KINDS = Object.keys(SCENES) as SceneKind[]

/** Cenário sorteado para a cena `index`, a partir de um seed. */
export function pickScene(seed: number, index: number): SceneKind {
  let x = Math.imul(seed | 0, 2654435761) + Math.imul(index, 40503)
  x ^= x >>> 15
  x = Math.imul(x, 2246822519)
  x ^= x >>> 13
  // ">>> 0" deixa sem sinal: o resto da divisão nunca fica negativo.
  return SCENE_KINDS[(x >>> 0) % SCENE_KINDS.length]
}

// Cache das cenas prontas, limitado por pixels (cada cena de página inteira
// tem ~4 milhões de pixels). Map mantém a ordem de uso: o mais antigo sai primeiro.
const cache = new Map<string, HTMLCanvasElement>()
const CACHE_BUDGET = 24_000_000
let cachedPixels = 0

function remember(key: string, canvas: HTMLCanvasElement): void {
  cache.set(key, canvas)
  cachedPixels += canvas.width * canvas.height
  for (const [k, old] of cache) {
    if (cachedPixels <= CACHE_BUDGET || k === key) break
    cachedPixels -= old.width * old.height
    // Só sai do cache; o navegador libera a memória quando nada mais usar.
    cache.delete(k)
  }
}

/**
 * Canvas com a cena desenhada em w×h (px do arquivo final), em cache.
 * `lw` = espessura base do traço. `scale` < 1 gera uma versão reduzida
 * (miniaturas), com o mesmo desenho.
 */
export function inkScene(
  kind: SceneKind,
  w: number,
  h: number,
  ink: string,
  paper: string,
  lw: number,
  seed: number,
  scale = 1,
): HTMLCanvasElement {
  const key = [kind, Math.round(w), Math.round(h), ink, paper, lw.toFixed(2), seed, scale].join('|')
  const hit = cache.get(key)
  if (hit) {
    // Marca como usado recentemente.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  const pen = new Pen(rng(seed), lw)
  SCENES[kind](pen, w, h)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const c = canvas.getContext('2d')!
  c.scale(scale, scale)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.strokeStyle = ink
  c.fillStyle = paper
  for (const op of pen.ops) {
    c.beginPath()
    c.moveTo(op.pts[0], op.pts[1])
    for (let i = 2; i < op.pts.length; i += 2) c.lineTo(op.pts[i], op.pts[i + 1])
    if (op.kind === 'fill') {
      c.closePath()
      c.fill()
    } else {
      c.lineWidth = op.w
      c.stroke()
    }
  }
  // Fundo transparente: só tinta e as áreas "cover" (cor do papel), que
  // escondem os traços que ficariam atrás de montanhas e árvores.
  remember(key, canvas)
  return canvas
}
