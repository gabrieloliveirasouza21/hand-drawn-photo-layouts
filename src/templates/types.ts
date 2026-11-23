// Coordenadas em pixels do arquivo final (resolução de exportação).

export interface Slot {
  x: number
  y: number
  w: number
  h: number
  /** Rotação em graus, em torno do centro do slot. */
  rotate?: number
}

export type DoodleKind = 'star' | 'heart'

export interface Doodle {
  kind: DoodleKind
  /** Centro do doodle. */
  x: number
  y: number
  size: number
  rotate?: number
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
  doodles?: Doodle[]
  caption?: Caption
}
