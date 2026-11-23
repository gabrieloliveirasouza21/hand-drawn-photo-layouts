import type { FilterKind } from '../render/style'
import type { Photo } from './image'

// Versões filtradas ficam em cache por foto; somem junto com a foto (WeakMap).
const cache = new WeakMap<Photo['source'], Map<FilterKind, HTMLCanvasElement>>()

/**
 * Devolve a foto com o filtro aplicado. Processa os pixels na mão em vez
 * de usar `ctx.filter`, que não existe em Safari antigo.
 */
export function filtered(photo: Photo, kind: FilterKind): CanvasImageSource {
  if (kind === 'none') return photo.source

  let byKind = cache.get(photo.source)
  if (!byKind) cache.set(photo.source, (byKind = new Map()))
  const hit = byKind.get(kind)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = photo.width
  canvas.height = photo.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(photo.source, 0, 0)
  const image = ctx.getImageData(0, 0, photo.width, photo.height)
  PIXEL_OPS[kind](image.data)
  ctx.putImageData(image, 0, 0)

  byKind.set(kind, canvas)
  return canvas
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

const PIXEL_OPS: Record<Exclude<FilterKind, 'none'>, (d: Uint8ClampedArray) => void> = {
  bw(d) {
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = clamp((l - 128) * 1.12 + 128)
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
