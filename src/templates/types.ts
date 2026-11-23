// Coordenadas em pixels do arquivo final (resolução de impressão).

export type TapeKind = 'top' | 'corners'
export type PagePattern = 'dots' | 'lines' | 'grid'

export interface Slot {
  x: number
  y: number
  w: number
  h: number
  /** Rotação em graus, em torno do centro do slot. */
  rotate?: number
  /** Fita adesiva prendendo a foto. */
  tape?: TapeKind
}

export type DrawingKind =
  | 'branch'
  | 'flower'
  | 'swirl'
  | 'cloud'
  | 'sun'
  | 'moon'
  | 'notes'
  | 'bolt'
  | 'arrow'
  | 'eye'
  | 'stain'
  | 'hatch'
  | 'waves'

/** Rabisco de fundo de sketchbook, desenhado atrás das fotos. */
export interface Drawing {
  kind: DrawingKind
  /** Centro do desenho. */
  x: number
  y: number
  size: number
  rotate?: number
  /** Cor de aquarela por baixo do traço, em #rrggbb. */
  wash?: string
}

export interface Caption {
  /** Centro horizontal e topo do texto. */
  x: number
  y: number
  w: number
  size: number
  font: string
}

export interface Template {
  id: string
  name: string
  size: [width: number, height: number]
  /** Cor do papel. */
  paper: string
  /** Cor do traço, em #rrggbb. */
  ink: string
  slots: Slot[]
  caption?: Caption
  /** Moldura desenhada em volta do papel (padrão: true). */
  frame?: boolean
  /** Pauta do papel. */
  pattern?: PagePattern
  /** Espiral de caderno no topo ou na lateral esquerda. */
  binding?: 'top' | 'left'
  /** Desenhos de fundo, atrás das fotos. */
  drawings?: Drawing[]
  /** Cor da caneta dos desenhos (ex.: azul de esferográfica). Padrão: `ink`. */
  drawingInk?: string
}
