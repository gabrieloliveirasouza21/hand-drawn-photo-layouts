import '@fontsource/caveat/600.css'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/permanent-marker/400.css'

export type FilterKind = 'none' | 'bw' | 'sepia' | 'vintage'

export const FILTERS: { id: FilterKind; name: string }[] = [
  { id: 'none', name: 'Colorido' },
  { id: 'bw', name: 'P&B' },
  { id: 'sepia', name: 'Sépia' },
  { id: 'vintage', name: 'Vintage' },
]

export interface Font {
  family: string
  weight: number
}

export const FONTS: Font[] = [
  { family: 'Caveat', weight: 600 },
  { family: 'Patrick Hand', weight: 400 },
  { family: 'Permanent Marker', weight: 400 },
]

export interface PaperPreset {
  id: string
  name: string
  paper: string
  /** Cor do traço, em #rrggbb. */
  ink: string
}

export const PAPERS: PaperPreset[] = [
  { id: 'cream', name: 'Creme', paper: '#f5efe1', ink: '#2b2420' },
  { id: 'white', name: 'Branco', paper: '#fdfaf3', ink: '#2b2420' },
  { id: 'kraft', name: 'Kraft', paper: '#d8b98e', ink: '#3b2a1a' },
  { id: 'rose', name: 'Rosa', paper: '#f4d7d3', ink: '#3a2328' },
  { id: 'sky', name: 'Céu', paper: '#d6e4ee', ink: '#1f2a38' },
  { id: 'night', name: 'Noite', paper: '#24211f', ink: '#f3ecdf' },
]

/** Escolhas visuais do usuário, aplicadas a qualquer layout. */
export interface Style {
  filter: FilterKind
  grain: boolean
  /** Desligado: o layout sai sem legenda. */
  showCaption: boolean
  caption: string
  font: Font
  /** null = cores do próprio layout. */
  paper: PaperPreset | null
}

export const DEFAULT_STYLE: Style = {
  filter: 'none',
  grain: false,
  showCaption: true,
  caption: '',
  font: FONTS[0],
  paper: null,
}

/** Garante que a fonte já carregou antes de desenhar no canvas. */
export function loadFont(font: Font): Promise<unknown> {
  return document.fonts.load(`${font.weight} 64px "${font.family}"`)
}
