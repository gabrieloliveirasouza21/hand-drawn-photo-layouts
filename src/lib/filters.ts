import type { FilterKind } from '../render/style'
import type { Photo } from './image'

/** Cores usadas pelo filtro "Tinta e papel". */
export interface Tone {
  ink: string
  paper: string
}

// Guarda só a última versão filtrada de cada foto: cada versão ocupa a
// foto inteira em memória (~10 MB), e trocar de filtro de novo é raro.
// Some junto com a foto (WeakMap).
const cache = new WeakMap<Photo['source'], { key: string; canvas: HTMLCanvasElement }>()

/**
 * Devolve a foto com o filtro aplicado. Processa os pixels na mão em vez
 * de usar `ctx.filter`, que não existe em Safari antigo.
 */
export function filtered(photo: Photo, kind: FilterKind, tone: Tone): CanvasImageSource {
  if (kind === 'none') return photo.source

  const key = kind === 'duotone' ? `${kind}|${tone.ink}|${tone.paper}` : kind
  const hit = cache.get(photo.source)
  if (hit?.key === key) return hit.canvas

  const canvas = document.createElement('canvas')
  canvas.width = photo.width
  canvas.height = photo.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(photo.source, 0, 0)
  const image = ctx.getImageData(0, 0, photo.width, photo.height)
  PIXEL_OPS[kind](image.data, photo.width, tone)
  ctx.putImageData(image, 0, 0)

  cache.set(photo.source, { key, canvas })
  return canvas
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
const luma = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Ruído determinístico por pixel (o xerox não "pisca" a cada redesenho). */
const noise = (i: number) => {
  let x = (i * 2654435761) >>> 0
  x ^= x >>> 13
  return ((Math.imul(x, 1274126177) >>> 0) % 1000) / 1000
}

type PixelOp = (d: Uint8ClampedArray, width: number, tone: Tone) => void

const PIXEL_OPS: Record<Exclude<FilterKind, 'none'>, PixelOp> = {
  bw(d) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = clamp((luma(d, i) - 128) * 1.12 + 128)
    }
  },
  // P&B com contraste forte e pretos fundos.
  noir(d) {
    for (let i = 0; i < d.length; i += 4) {
      const t = luma(d, i) / 255
      const s = t * t * (3 - 2 * t) // curva em S
      d[i] = d[i + 1] = d[i + 2] = clamp(((s - 0.5) * 1.5 + 0.5) * 255)
    }
  },
  sepia(d) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      d[i] = clamp(0.393 * r + 0.769 * g + 0.189 * b)
      d[i + 1] = clamp(0.349 * r + 0.686 * g + 0.168 * b)
      d[i + 2] = clamp(0.272 * r + 0.534 * g + 0.131 * b)
    }
  },
  // Meio sépia, pretos "lavados" e um toque quente, como foto antiga desbotada.
  vintage(d) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const sr = 0.393 * r + 0.769 * g + 0.189 * b
      const sg = 0.349 * r + 0.686 * g + 0.168 * b
      const sb = 0.272 * r + 0.534 * g + 0.131 * b
      d[i] = clamp((r * 0.4 + sr * 0.6) * 0.85 + 30)
      d[i + 1] = clamp((g * 0.4 + sg * 0.6) * 0.85 + 22)
      d[i + 2] = clamp((b * 0.4 + sb * 0.6) * 0.85 + 12)
    }
  },
  // Pouco contraste e pouca cor, como impressão velha.
  faded(d) {
    for (let i = 0; i < d.length; i += 4) {
      const l = luma(d, i)
      for (let k = 0; k < 3; k++) d[i + k] = clamp((d[i + k] * 0.55 + l * 0.45) * 0.78 + 48)
    }
  },
  warm(d) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] * 1.08 + 12)
      d[i + 1] = clamp(d[i + 1] * 1.02 + 4)
      d[i + 2] = clamp(d[i + 2] * 0.85)
    }
  },
  cool(d) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] * 0.88)
      d[i + 1] = clamp(d[i + 1] * 1.0 + 4)
      d[i + 2] = clamp(d[i + 2] * 1.1 + 14)
    }
  },
  // Monocromático azul-da-prússia, como fotografia de cianótipo.
  cyanotype(d) {
    const dark: [number, number, number] = [16, 40, 92]
    const light: [number, number, number] = [222, 234, 242]
    for (let i = 0; i < d.length; i += 4) {
      const t = luma(d, i) / 255
      for (let k = 0; k < 3; k++) d[i + k] = dark[k] + (light[k] - dark[k]) * t
    }
  },
  // Fotocópia de zine: alto contraste, poucos tons e sujeira de toner.
  xerox(d) {
    for (let i = 0; i < d.length; i += 4) {
      const n = noise(i >> 2)
      let l = (luma(d, i) - 128) * 2.2 + 128 + (n - 0.5) * 60
      l = l < 85 ? 18 : l < 170 ? (n < 0.5 ? 18 : 235) : 240
      d[i] = d[i + 1] = d[i + 2] = l
    }
  },
  // Duotom com as cores do papel: sombras na tinta, luzes no papel.
  duotone(d, _w, tone) {
    const ink = rgb(tone.ink)
    const paper = rgb(tone.paper)
    // Em papel escuro a tinta é clara: inverte para a foto não sair em negativo.
    const dark = luma(Uint8ClampedArray.from(paper), 0) < luma(Uint8ClampedArray.from(ink), 0)
    const [lo, hi] = dark ? [paper, ink] : [ink, paper]
    for (let i = 0; i < d.length; i += 4) {
      const t = Math.min(1, Math.max(0, (luma(d, i) / 255 - 0.5) * 1.2 + 0.5))
      for (let k = 0; k < 3; k++) d[i + k] = lo[k] + (hi[k] - lo[k]) * t
    }
  },
}

let grainTile: HTMLCanvasElement | null = null

/** Textura de ruído cinza para o efeito de grão (gerada uma vez). */
export function grainPattern(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 160
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return (grainTile = canvas)
}
