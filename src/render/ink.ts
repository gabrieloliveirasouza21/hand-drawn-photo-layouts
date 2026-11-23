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

const SCENES: Record<SceneKind, (pen: Pen, w: number, h: number) => void> = {
  mountains(pen, w, h) {
    const r = pen.r
    const horizon = h * 0.64
    for (let i = 0; i < 2; i++) pen.cloud(w * (0.15 + i * 0.5 + r() * 0.2), h * (0.1 + r() * 0.12), w * (0.2 + r() * 0.15))
    range(pen, w, horizon, h * 0.12, h * 0.3, 3, 0.4)
    range(pen, w, horizon, h * 0.22, h * 0.42, 2 + Math.round(r()), 1)
    const trees = forestRow(pen, w, horizon, h * 0.06, h * 0.16, w * 0.04, 1)
    // Lago com reflexo dos pinheiros.
    pen.cover([[0, horizon], [w, horizon], [w, h], [0, h]])
    pen.path([[0, horizon], [w * 0.3, horizon + pen.lw], [w * 0.7, horizon - pen.lw], [w, horizon]], 1.1)
    for (const [x, th] of trees) {
      if (r() < 0.5) continue
      const len = th * (0.3 + r() * 0.4)
      pen.hatch([[x - th * 0.12, horizon + pen.lw * 2], [x + th * 0.12, horizon + pen.lw * 2], [x, horizon + len]], 90, pen.lw * 2.5, 0.6, 0.3)
    }
    water(pen, w, horizon, h)
    for (let i = 0; i < 4; i++) pen.bird(w * (0.55 + r() * 0.35), h * (0.05 + r() * 0.12), w * 0.015 + r() * w * 0.01)
  },

  forest(pen, w, h) {
    const r = pen.r
    const hill = h * 0.5
    // Morros ao fundo.
    const ridge: Point[] = []
    for (let i = 0; i <= 8; i++) ridge.push([(w * i) / 8, hill - h * (0.08 + 0.1 * Math.sin(i * 0.9 + r()))])
    pen.path(ridge, 1)
    pen.hatch([...ridge, [w, hill], [0, hill]], 70, pen.lw * 4, 0.6, 0.3)
    forestRow(pen, w, hill, h * 0.08, h * 0.14, w * 0.05, 0.5)
    // Trilha serpenteando até o fundo.
    const pathL: Point[] = []
    const pathR: Point[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const cx = w * 0.5 + Math.sin(t * 3.2 + 0.5) * w * 0.15 * t
      const half = w * (0.02 + 0.13 * t)
      const y = hill + (h - hill) * t
      pathL.push([cx - half, y])
      pathR.push([cx + half, y])
    }
    pen.cover([...pathL, ...pathR.slice().reverse()])
    pen.path(pathL, 0.9)
    pen.path(pathR, 0.9)
    // Pinheiros grandes nas laterais.
    for (const side of [0, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = side ? w * (0.8 + r() * 0.18) : w * (0.02 + r() * 0.18)
        pen.pine(x, h * (0.7 + k * 0.12), h * (0.25 + r() * 0.15), 1)
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
    const horizon = h * 0.42
    // Faixa de terra escura ao longe.
    const land: Point[] = [[-w * 0.02, horizon], [w * 0.05, horizon - h * 0.05], [w * 0.22, horizon - h * 0.07], [w * 0.35, horizon - h * 0.02], [w * 0.42, horizon]]
    pen.path(land, 1)
    pen.dark(land, 80, pen.lw * 2)
    pen.line(0, horizon, w, horizon, 1)
    // Riscos de céu.
    for (let i = 0; i < 5; i++) {
      const y = h * (0.08 + r() * 0.25)
      const x = w * (0.5 + r() * 0.4)
      pen.line(x, y, x + w * (0.1 + r() * 0.2), y + (r() - 0.5) * pen.lw * 2, 0.9)
      pen.line(x + w * 0.02, y + pen.lw * 3, x + w * (0.08 + r() * 0.12), y + pen.lw * 3, 0.6)
    }
    water(pen, w, horizon, h)
    // Pedras com a base escura.
    for (let i = 0; i < 4; i++) {
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

  city(pen, w, h) {
    const r = pen.r
    const ground = h * 0.88
    // Fios cortando o céu.
    for (let i = 0; i < 3; i++) {
      const y0 = h * (0.05 + i * 0.06)
      pen.path([[0, y0], [w * 0.5, y0 + h * 0.06], [w, y0 + h * 0.02]], 0.6)
    }
    // Prédios de alturas diferentes.
    let x = w * 0.04
    while (x < w * 0.95) {
      const bw = w * (0.14 + r() * 0.12)
      const top = h * (0.2 + r() * 0.35)
      const depth = bw * 0.18
      const front: Point[] = [[x, ground], [x, top], [x + bw, top], [x + bw, ground]]
      const side: Point[] = [[x + bw, top], [x + bw + depth, top + depth * 0.5], [x + bw + depth, ground], [x + bw, ground]]
      pen.cover([...front, ...side])
      pen.path(front, 1.1)
      pen.path(side, 1)
      pen.hatch(side, 92, pen.lw * 2.4, 0.7, 0.1)
      // Janelas.
      const cols = Math.max(2, Math.round(bw / (w * 0.035)))
      const rows = Math.max(3, Math.round((ground - top) / (h * 0.06)))
      const ww = (bw / cols) * 0.5
      const wh = ((ground - top) / rows) * 0.45
      for (let c = 0; c < cols; c++) {
        for (let k = 0; k < rows - 1; k++) {
          const wx = x + (bw / cols) * (c + 0.25)
          const wy = top + ((ground - top) / rows) * (k + 0.35)
          const win: Point[] = [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]]
          pen.path(win, 0.7, true)
          if (r() < 0.45) pen.hatch(win, 80, pen.lw * 1.6, 0.6, 0.05)
        }
      }
      x += bw + depth + w * (0.01 + r() * 0.03)
    }
    // Árvore em tufo à esquerda.
    const tree: Point[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      tree.push([w * 0.05 + Math.cos(a) * w * 0.1 * (0.8 + r() * 0.4), h * 0.45 + Math.sin(a) * h * 0.14 * (0.8 + r() * 0.4)])
    }
    pen.cover(tree)
    pen.dark(tree, 45, pen.lw * 2)
    pen.line(w * 0.05, h * 0.55, w * 0.05, ground, 1.2)
    // Calçada.
    pen.line(0, ground, w, ground, 1.2)
    for (let i = 0; i < 3; i++) pen.line(0, ground + (h - ground) * (0.3 + i * 0.25), w * (0.4 + r() * 0.6), ground + (h - ground) * (0.3 + i * 0.25), 0.6)
  },
}

const cache = new Map<string, HTMLCanvasElement>()

/**
 * Canvas com a cena desenhada em w×h (px do arquivo final), em cache.
 * `lw` = espessura base do traço.
 */
export function inkScene(kind: SceneKind, w: number, h: number, ink: string, paper: string, lw: number, seed: number): HTMLCanvasElement {
  const key = [kind, Math.round(w), Math.round(h), ink, paper, lw.toFixed(2), seed].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const pen = new Pen(rng(seed), lw)
  SCENES[kind](pen, w, h)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w)
  canvas.height = Math.round(h)
  const c = canvas.getContext('2d')!
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
  cache.set(key, canvas)
  return canvas
}
