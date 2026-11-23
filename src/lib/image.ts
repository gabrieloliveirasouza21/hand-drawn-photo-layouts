export interface Photo {
  source: HTMLCanvasElement | ImageBitmap
  width: number
  height: number
}

/**
 * Maior lado da foto em memória. Os slots têm até ~1000px no arquivo
 * final; 2000px deixa folga para o zoom (M3) sem estourar a memória
 * do celular.
 */
const MAX_SIDE = 2000

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  // 'from-image' aplica a orientação EXIF (fotos de celular "deitadas").
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

/** Lê um arquivo de imagem, converte HEIC se preciso e reduz para MAX_SIDE. */
export async function loadPhoto(file: File): Promise<Photo> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file)
  } catch (err) {
    // Só o Safari decodifica HEIC nativamente; nos outros, converte para JPEG.
    if (!isHeic(file)) throw err
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    bitmap = await decode(Array.isArray(out) ? out[0] : out)
  }
  return shrink(bitmap)
}

function shrink(bitmap: ImageBitmap): Photo {
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1) return { source: bitmap, width: bitmap.width, height: bitmap.height }

  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return { source: canvas, width, height }
}

/** Libera a memória de uma foto que saiu de uso. */
export function releasePhoto(photo: Photo): void {
  if (photo.source instanceof ImageBitmap) photo.source.close()
  else photo.source.width = 0
}
