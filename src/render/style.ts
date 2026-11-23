import '@fontsource/caveat/600.css'
import '@fontsource/gloria-hallelujah/400.css'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/reenie-beanie/400.css'
import '@fontsource/rock-salt/400.css'
import '@fontsource/shadows-into-light/400.css'
import '@fontsource/special-elite/400.css'
import type { SceneKind } from '../templates'

export type FilterKind =
  | 'none'
  | 'bw'
  | 'noir'
  | 'sepia'
  | 'vintage'
  | 'faded'
  | 'warm'
  | 'cool'
  | 'cyanotype'
  | 'xerox'
  | 'duotone'

export const FILTERS: { id: FilterKind; name: string }[] = [
  { id: 'none', name: 'Colorido' },
  { id: 'bw', name: 'P&B' },
  { id: 'noir', name: 'Noir (P&B contrastado)' },
  { id: 'sepia', name: 'Sépia' },
  { id: 'vintage', name: 'Vintage' },
  { id: 'faded', name: 'Desbotado' },
  { id: 'warm', name: 'Quente' },
  { id: 'cool', name: 'Frio' },
  { id: 'cyanotype', name: 'Cianotipia (azul)' },
  { id: 'xerox', name: 'Xerox (fotocópia)' },
  { id: 'duotone', name: 'Tinta e papel' },
]

export interface Font {
  family: string
  weight: number
}

export const FONTS: Font[] = [
  { family: 'Caveat', weight: 600 },
  { family: 'Patrick Hand', weight: 400 },
  { family: 'Permanent Marker', weight: 400 },
  { family: 'Rock Salt', weight: 400 },
  { family: 'Special Elite', weight: 400 },
  { family: 'Shadows Into Light', weight: 400 },
  { family: 'Gloria Hallelujah', weight: 400 },
  { family: 'Reenie Beanie', weight: 400 },
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
  { id: 'aged', name: 'Envelhecido', paper: '#ecdcb8', ink: '#3a2a18' },
  { id: 'newsprint', name: 'Jornal', paper: '#e4e0d7', ink: '#1a1a1a' },
  { id: 'kraft', name: 'Kraft', paper: '#d8b98e', ink: '#3b2a1a' },
  { id: 'mustard', name: 'Mostarda', paper: '#e6c160', ink: '#2b2010' },
  { id: 'rose', name: 'Rosa', paper: '#f4d7d3', ink: '#3a2328' },
  { id: 'lilac', name: 'Lilás', paper: '#dfd5ea', ink: '#2c2240' },
  { id: 'sage', name: 'Sálvia', paper: '#d3dcc5', ink: '#24301f' },
  { id: 'sky', name: 'Céu', paper: '#d6e4ee', ink: '#1f2a38' },
  { id: 'red', name: 'Vermelho', paper: '#a8302a', ink: '#f6ead8' },
  { id: 'navy', name: 'Marinho', paper: '#1f2b4a', ink: '#ece5d4' },
  { id: 'night', name: 'Noite', paper: '#24211f', ink: '#f3ecdf' },
]

export const SCENE_CHOICES: { id: SceneKind | 'none' | 'random' | ''; name: string }[] = [
  { id: '', name: 'Do layout' },
  { id: 'random', name: 'Aleatória' },
  { id: 'mountains', name: 'Montanhas' },
  { id: 'forest', name: 'Floresta' },
  { id: 'sea', name: 'Mar' },
  { id: 'beach', name: 'Praia' },
  { id: 'city', name: 'Cidade' },
  { id: 'railway', name: 'Trilho de trem' },
  { id: 'fields', name: 'Campo' },
  { id: 'desert', name: 'Deserto' },
  { id: 'stage', name: 'Show' },
  { id: 'none', name: 'Nenhuma' },
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
  /** Mostra a pauta (pontilhado/linhas) nos layouts que têm. */
  showPattern: boolean
  /**
   * Arte nanquim: null = a do layout; um tipo = esse cenário;
   * 'random' = cenário sorteado por `sceneSeed`; 'none' tira a arte de fundo.
   */
  scene: SceneKind | 'none' | 'random' | null
  /** Soma-se ao seed das cenas: cada valor gera um desenho diferente. */
  sceneSeed: number
}

export const DEFAULT_STYLE: Style = {
  filter: 'none',
  grain: false,
  showCaption: true,
  caption: '',
  font: FONTS[0],
  paper: null,
  showPattern: true,
  scene: null,
  sceneSeed: 0,
}

/** Garante que a fonte já carregou antes de desenhar no canvas. */
export function loadFont(font: Font): Promise<unknown> {
  return document.fonts.load(`${font.weight} 64px "${font.family}"`)
}
