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
  /** Margem de papel em volta da foto, como foto impressa colada. */
  mat?: boolean
}

export type SceneKind =
  | 'mountains'
  | 'forest'
  | 'sea'
  | 'beach'
  | 'city'
  | 'railway'
  | 'fields'
  | 'desert'
  | 'stage'

/** Ilustração a nanquim gerada por código, atrás das fotos. */
export interface Scene {
  kind: SceneKind
  x: number
  y: number
  w: number
  h: number
  /** Desenha um quadro à mão em volta (estilo quadrinho). */
  frame?: boolean
  /** Muda a variação do desenho. */
  seed?: number
  /** 0–1. Abaixo de 1 a arte fica mais clara, como fundo. Padrão: 1. */
  opacity?: number
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
  /** Ilustrações a nanquim, atrás das fotos. */
  scenes?: Scene[]
}
