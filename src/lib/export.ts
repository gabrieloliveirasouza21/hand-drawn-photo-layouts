/**
 * Formatos de saída. `size: null` = tamanho original do layout (impressão).
 * Nos formatos de Instagram o layout fica centralizado sobre um fundo,
 * porque as tiras (1:3, 3:1) seriam cortadas pelo app.
 */
export interface OutputFormat {
  id: string
  name: string
  size: [width: number, height: number] | null
  mime: 'image/png' | 'image/jpeg'
}

export const FORMATS: OutputFormat[] = [
  { id: 'ig-portrait', name: 'Instagram feed 4:5', size: [1080, 1350], mime: 'image/jpeg' },
  { id: 'ig-square', name: 'Instagram quadrado 1:1', size: [1080, 1080], mime: 'image/jpeg' },
  { id: 'ig-story', name: 'Stories 9:16', size: [1080, 1920], mime: 'image/jpeg' },
  { id: 'print', name: 'Impressão (original)', size: null, mime: 'image/png' },
]

export function fileName(layoutId: string, format: OutputFormat): string {
  const ext = format.mime === 'image/png' ? 'png' : 'jpg'
  return `photo-layout-${layoutId}-${format.id}.${ext}`
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Dá tempo do navegador iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** O navegador consegue compartilhar arquivos (celular: abre a folha de compartilhar)? */
export function canShareFiles(): boolean {
  try {
    const probe = new File([''], 'probe.jpg', { type: 'image/jpeg' })
    return !!navigator.canShare?.({ files: [probe] })
  } catch {
    return false
  }
}

/** Abre a folha de compartilhar do sistema. Retorna false se o usuário cancelar. */
export async function share(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type })
  try {
    await navigator.share({ files: [file] })
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    throw err
  }
}
