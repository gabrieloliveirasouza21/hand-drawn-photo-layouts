/**
 * Recorte de uma foto dentro de um slot, independente do tamanho do slot:
 * - (cx, cy): ponto da foto (0..1) que fica no centro do slot;
 * - zoom: 1 = foto cobre o slot exatamente ("cover"), 2 = o dobro etc.
 * Assim o enquadramento sobrevive à troca de layout.
 */
export interface Crop {
  cx: number
  cy: number
  zoom: number
}

export const DEFAULT_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 }
export const MAX_ZOOM = 4

interface Size {
  width: number
  height: number
}

interface SlotSize {
  w: number
  h: number
}

/** Posição e tamanho da imagem, em coordenadas do slot (origem no centro). */
export interface Placement {
  x: number
  y: number
  width: number
  height: number
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom))
}

/** Mantém a imagem cobrindo o slot inteiro (sem mostrar fundo). */
export function clampPosition(x: number, y: number, width: number, height: number, slot: SlotSize) {
  return {
    x: Math.min(-slot.w / 2, Math.max(slot.w / 2 - width, x)),
    y: Math.min(-slot.h / 2, Math.max(slot.h / 2 - height, y)),
  }
}

export function placement(photo: Size, slot: SlotSize, crop: Crop): Placement {
  const scale = Math.max(slot.w / photo.width, slot.h / photo.height) * clampZoom(crop.zoom)
  const width = photo.width * scale
  const height = photo.height * scale
  const { x, y } = clampPosition(-crop.cx * width, -crop.cy * height, width, height, slot)
  return { x, y, width, height }
}

/** Inverso de `placement`: posição da imagem no slot para recorte. */
export function cropFromPlacement(p: Placement, zoom: number): Crop {
  return { cx: -p.x / p.width, cy: -p.y / p.height, zoom }
}
