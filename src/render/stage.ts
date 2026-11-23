import Konva from 'konva'
import type { Options } from 'roughjs/bin/core'
import { clampPosition, clampZoom, cropFromPlacement, placement, type Crop } from '../lib/crop'
import { filtered, grainPattern } from '../lib/filters'
import type { Photo } from '../lib/image'
import type { Caption, Slot, Template } from '../templates'
import { gen, toKonva, withAlpha } from './rough-konva'
import { inkScene } from './ink'
import { clipToPolygon, pagePattern, pen, spiralBinding, squiggle, tape, wobblyQuad, type Point } from './sketch'
import { DEFAULT_STYLE, type Style } from './style'

/** Foto colocada num slot, com seu enquadramento. */
export interface PlacedPhoto {
  photo: Photo
  crop: Crop
}

const SELECTION_COLOR = '#e4572e'

/**
 * Desenha um template num Konva.Stage.
 *
 * O stage trabalha nas coordenadas do arquivo final (o "quadro"): no
 * formato de impressão o quadro é o próprio layout; nos de Instagram é
 * 1080×N, com o layout centralizado e reduzido sobre um fundo. Na tela o
 * stage só é escalado para caber; o export desfaz essa escala.
 *
 * Camadas: "art" (o que vai para o arquivo final) e "ui" (seleção e
 * textos de exemplo, nunca exportada).
 */
export class LayoutRenderer {
  private stage: Konva.Stage
  /** Tamanho do arquivo final, em px. */
  private frame: [number, number] | null = null
  /** Escala do layout dentro do quadro (1 no formato de impressão). */
  private contentScale = 1

  /** Clique/toque num slot (com ou sem foto). */
  onSlotClick: ((index: number) => void) | null = null
  /** Clique/toque fora dos slots. */
  onBackgroundClick: (() => void) | null = null
  /** Usuário arrastou ou deu zoom numa foto. */
  onCropChange: ((index: number, crop: Crop) => void) | null = null

  /**
   * `sceneScale` < 1 desenha a arte nanquim em resolução menor (miniaturas).
   * Na tela principal fica 1, pois o export usa os mesmos desenhos.
   */
  constructor(
    private container: HTMLDivElement,
    private sceneScale = 1,
  ) {
    this.stage = new Konva.Stage({ container, width: 1, height: 1 })
    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) this.onBackgroundClick?.()
    })
    new ResizeObserver(() => this.fit()).observe(container)
  }

  /**
   * `photos[i]` vai no slot i; `selected` destaca um slot.
   * `outputSize` = tamanho do arquivo final; null = tamanho do layout.
   */
  render(
    template: Template,
    photos: readonly (PlacedPhoto | null | undefined)[] = [],
    selected: number | null = null,
    style: Style = DEFAULT_STYLE,
    outputSize: [number, number] | null = null,
  ): void {
    // O papel escolhido pelo usuário substitui as cores do layout.
    const t: Template = { ...template, paper: style.paper?.paper ?? template.paper, ink: style.paper?.ink ?? template.ink }
    this.stage.destroyChildren()
    this.container.style.cursor = ''

    const [w, h] = t.size
    const stroke = Math.min(w, h) / 220
    const art = new Konva.Layer({ name: 'art' })
    const ui = new Konva.Layer({ name: 'ui', listening: false })

    // Posição do layout dentro do quadro final: o maior possível, centralizado.
    // O papel preenche o quadro inteiro, sem faixa de outra cor em volta.
    const [fw, fh] = outputSize ?? t.size
    const scale = outputSize ? Math.min(fw / w, fh / h) : 1
    const transform = { x: (fw - w * scale) / 2, y: (fh - h * scale) / 2, scaleX: scale, scaleY: scale }
    this.frame = [fw, fh]
    this.contentScale = scale

    if (outputSize) {
      art.add(new Konva.Rect({ width: fw, height: fh, fill: t.paper, listening: false }))
    }
    const content = new Konva.Group(transform)
    const uiContent = new Konva.Group(transform)
    art.add(content)
    ui.add(uiContent)

    content.add(new Konva.Rect({ width: w, height: h, fill: t.paper, listening: false }))

    // Pauta e espiral (sketchbook)
    const unit = Math.min(w, h) / 27
    if (t.pattern) {
      const top = t.binding === 'top' ? unit * 2.6 : unit
      const left = t.binding === 'left' ? unit * 2.6 : unit
      content.add(pagePattern(t.pattern, w, h, t.ink, unit, top, left))
    }

    // Ilustrações a nanquim atrás das fotos (geradas uma vez e guardadas).
    // Cenas com quadro fazem parte do layout (quadrinhos); as sem quadro são
    // arte de fundo, que o usuário pode trocar ou tirar.
    t.scenes?.forEach((sc, i) => {
      if (!sc.frame && style.scene === 'none') return
      const kind = style.scene && style.scene !== 'none' ? style.scene : sc.kind
      const seed = (sc.seed ?? 100 + i) + style.sceneSeed * 7919
      const art = inkScene(kind, sc.w, sc.h, t.ink, t.paper, stroke * 0.5, seed, this.sceneScale)
      content.add(
        new Konva.Image({ image: art, x: sc.x, y: sc.y, width: sc.w, height: sc.h, opacity: sc.opacity ?? 1, listening: false }),
      )
      if (sc.frame) {
        const quad = wobblyQuad(sc.w, sc.h, 200 + i, 0.008).map(([x, y]): Point => [x + sc.x + sc.w / 2, y + sc.y + sc.h / 2])
        content.add(...toKonva(gen.polygon(quad, pen(t.ink, stroke * 1.1, 200 + i))))
      }
    })

    // Espiral por cima da arte, como no caderno de verdade.
    if (t.binding) content.add(...spiralBinding(t.binding, w, h, t.ink, unit))

    // Moldura do papel, torta como feita à mão
    if (t.frame !== false) {
      const inset = stroke * 5
      const frame = wobblyQuad(w - inset * 2, h - inset * 2, 1, 0.006).map(([x, y]): Point => [x + w / 2, y + h / 2])
      content.add(...toKonva(gen.polygon(frame, pen(t.ink, stroke * 0.7, 1))))
    }

    t.slots.forEach((s, i) => content.add(this.slot(s, i, t, stroke, photos[i] ?? null, style)))

    const sel = selected !== null ? t.slots[selected] : undefined
    if (sel) uiContent.add(this.selection(sel, stroke))

    // Legenda vazia mostra um texto de exemplo só na tela, fora da arte.
    if (t.caption && style.showCaption) {
      const text = style.caption.trim()
      if (text) {
        const caption = this.caption(t.caption, t, text, style, 1)
        content.add(caption)
        // Sublinhado ondulado, do tamanho do texto.
        const width = Math.min(t.caption.w, caption.measureSize(text).width)
        const y = t.caption.y + caption.fontSize() * 1.05
        content.add(
          ...squiggle(t.caption.x - width / 2, t.caption.x + width / 2, y, caption.fontSize() * 0.06, pen(t.ink, stroke * 0.6, 7)),
        )
      } else {
        uiContent.add(this.caption(t.caption, t, 'sua legenda aqui', style, 0.4))
      }
    }

    this.stage.add(art, ui)
    this.fit()
  }

  /** Imagem pequena (PNG em data URL) do quadro atual, sem a camada de UI. */
  snapshot(maxSide: number): string {
    const ui = this.stage.findOne('.ui')
    ui?.hide()
    try {
      const ratio = maxSide / Math.max(this.stage.width(), this.stage.height())
      return this.stage.toDataURL({ pixelRatio: ratio })
    } finally {
      ui?.show()
    }
  }

  /** Gera o arquivo final no tamanho do quadro, sem a camada de UI. */
  async exportImage(mimeType: string, quality = 0.92): Promise<Blob> {
    if (!this.frame) throw new Error('Nada para exportar')
    const [fw, fh] = this.frame
    const ui = this.stage.findOne('.ui')
    ui?.hide()
    let raw: HTMLCanvasElement
    try {
      // Redesenha a cena na resolução final sem redimensionar o stage
      // (o que estouraria o limite de canvas do iOS em telas 3×).
      raw = this.stage.toCanvas({ pixelRatio: fw / this.stage.width() })
    } finally {
      ui?.show()
    }

    // O arredondamento pode errar por 1px: garante o tamanho exato.
    let out = raw
    if (raw.width !== fw || raw.height !== fh) {
      out = document.createElement('canvas')
      out.width = fw
      out.height = fh
      out.getContext('2d')!.drawImage(raw, 0, 0, fw, fh)
    }
    return new Promise((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao codificar a imagem'))), mimeType, quality),
    )
  }

  private slot(
    s: Slot,
    i: number,
    t: Template,
    stroke: number,
    placed: PlacedPhoto | null,
    style: Style,
  ): Konva.Group {
    const group = new Konva.Group({
      name: 'slot',
      x: s.x + s.w / 2,
      y: s.y + s.h / 2,
      rotation: s.rotate ?? 0,
    })

    // Área clicável: os traços do Rough.js não recebem eventos.
    group.add(new Konva.Rect({ x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'transparent' }))
    group.on('click tap', () => this.onSlotClick?.(i))
    group.on('mouseenter', () => (this.container.style.cursor = placed ? 'move' : 'pointer'))
    group.on('mouseleave', () => (this.container.style.cursor = ''))

    // Cantos levemente tortos: o espaço não é um retângulo perfeito.
    const quad = wobblyQuad(s.w, s.h, 10 + i)
    const border = pen(t.ink, stroke * 1.1, 10 + i)
    const tapeNodes = s.tape ? tape(s.tape, s.w, s.h, i, 40 + i) : []

    // Margem de papel em volta: a foto parece impressa e colada sobre o desenho.
    if (s.mat) {
      const m = Math.min(s.w, s.h) * 0.045
      const mat = wobblyQuad(s.w + m * 2, s.h + m * 2, 60 + i, 0.012)
      group.add(
        new Konva.Line({ points: mat.flat(), closed: true, fill: t.paper, shadowColor: '#000', shadowOpacity: 0.18, shadowBlur: m * 0.8, shadowOffset: { x: m * 0.15, y: m * 0.25 }, listening: false }),
      )
      group.add(...toKonva(gen.polygon(mat, pen(t.ink, stroke * 0.5, 60 + i))))
    }

    if (placed) {
      group.add(this.photo(placed, s, i, style, quad))
      group.add(...toKonva(gen.polygon(quad, border)))
      group.add(...tapeNodes)
      group.on('wheel', (e) => {
        e.evt.preventDefault()
        // Proporcional ao giro: suave no trackpad, rápido na roda do mouse.
        const factor = Math.exp(-e.evt.deltaY * 0.002)
        this.onCropChange?.(i, { ...placed.crop, zoom: clampZoom(placed.crop.zoom * factor) })
      })
      return group
    }

    const placeholder: Options = {
      ...border,
      fill: withAlpha(t.ink, 0.15),
      fillStyle: 'hachure',
      hachureAngle: -41 + i * 7,
      hachureGap: stroke * 5,
      fillWeight: stroke * 0.4,
    }
    group.add(...toKonva(gen.polygon(quad, placeholder)))
    group.add(...tapeNodes)

    const fontSize = Math.min(s.w, s.h) / 8
    group.add(
      new Konva.Text({
        x: -s.w / 2,
        y: -fontSize / 2,
        width: s.w,
        align: 'center',
        text: `+ foto ${i + 1}`,
        fontSize,
        fontFamily: 'cursive',
        fill: t.ink,
        opacity: 0.6,
        listening: false,
      }),
    )
    return group
  }

  /** Foto recortada no slot; arrastável para reenquadrar. */
  private photo(placed: PlacedPhoto, s: Slot, i: number, style: Style, quad: Point[]): Konva.Group {
    const clip = new Konva.Group()
    clipToPolygon(clip, quad)
    const p = placement(placed.photo, s, placed.crop)
    const image = new Konva.Image({
      image: filtered(placed.photo, style.filter),
      ...p,
      draggable: true,
      // Evita que um toque com o dedo tremendo vire arraste.
      dragDistance: 6,
    })
    image.on('dragmove', () => image.position(clampPosition(image.x(), image.y(), p.width, p.height, s)))
    image.on('dragend', () => {
      const crop = cropFromPlacement({ ...p, x: image.x(), y: image.y() }, placed.crop.zoom)
      this.onCropChange?.(i, crop)
    })
    clip.add(image)

    if (style.grain) {
      clip.add(
        new Konva.Rect({
          x: -s.w / 2,
          y: -s.h / 2,
          width: s.w,
          height: s.h,
          // Os tipos do Konva pedem <img>, mas createPattern aceita canvas.
          fillPatternImage: grainPattern() as unknown as HTMLImageElement,
          fillPatternRepeat: 'repeat',
          // Grão de ~2px no arquivo final, em qualquer formato.
          fillPatternScale: { x: 2 / this.contentScale, y: 2 / this.contentScale },
          globalCompositeOperation: 'overlay',
          opacity: 0.35,
          listening: false,
        }),
      )
    }
    return clip
  }

  private selection(s: Slot, stroke: number): Konva.Rect {
    const pad = stroke * 3
    return new Konva.Rect({
      x: s.x + s.w / 2,
      y: s.y + s.h / 2,
      offsetX: s.w / 2 + pad,
      offsetY: s.h / 2 + pad,
      width: s.w + pad * 2,
      height: s.h + pad * 2,
      rotation: s.rotate ?? 0,
      stroke: SELECTION_COLOR,
      strokeWidth: stroke * 1.5,
      dash: [stroke * 5, stroke * 3],
      cornerRadius: stroke * 2,
    })
  }

  private caption(c: Caption, t: Template, content: string, style: Style, opacity: number): Konva.Text {
    const text = new Konva.Text({
      name: 'caption',
      x: c.x - c.w / 2,
      y: c.y,
      width: c.w,
      align: 'center',
      wrap: 'none',
      text: content,
      fontSize: c.size,
      fontFamily: `"${style.font.family}", cursive`,
      fontStyle: String(style.font.weight),
      fill: t.ink,
      // Contorno da cor do papel por baixo da letra: apaga os traços da arte
      // logo atrás do texto, que continua legível sobre o desenho.
      stroke: t.paper,
      strokeWidth: c.size * 0.22,
      fillAfterStrokeEnabled: true,
      lineJoin: 'round',
      opacity,
      listening: false,
    })
    // Encolhe a fonte até caber em uma linha.
    const measured = text.measureSize(text.text()).width
    if (measured > c.w) text.fontSize(c.size * (c.w / measured))
    return text
  }

  /** Escala o stage para caber no container, mantendo a proporção. */
  private fit(): void {
    if (!this.frame) return
    const [w, h] = this.frame
    const { clientWidth, clientHeight } = this.container
    if (!clientWidth || !clientHeight) return
    const scale = Math.min(clientWidth / w, clientHeight / h)
    this.stage.size({ width: w * scale, height: h * scale })
    this.stage.scale({ x: scale, y: scale })

    // Prévia nítida em telas de alta densidade (celular, zoom do navegador).
    const ratio = window.devicePixelRatio || 1
    for (const layer of this.stage.getLayers()) {
      const canvas = layer.getCanvas()
      if (canvas.getPixelRatio() !== ratio) canvas.setPixelRatio(ratio)
    }
    this.stage.batchDraw()
  }
}
