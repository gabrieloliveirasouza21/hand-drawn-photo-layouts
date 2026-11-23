import Konva from 'konva'
import type { Options } from 'roughjs/bin/core'
import { clampPosition, clampZoom, cropFromPlacement, placement, type Crop } from '../lib/crop'
import { filtered, grainPattern } from '../lib/filters'
import type { Photo } from '../lib/image'
import type { Caption, Doodle, Slot, Template } from '../templates'
import { heartPoints, starPoints } from './doodles'
import { gen, toKonva, withAlpha } from './rough-konva'
import { DEFAULT_STYLE, type Style } from './style'

/** Foto colocada num slot, com seu enquadramento. */
export interface PlacedPhoto {
  photo: Photo
  crop: Crop
}

const SELECTION_COLOR = '#e4572e'

/**
 * Desenha um template num Konva.Stage.
 * Tudo é desenhado nas coordenadas do arquivo final; o stage só é
 * escalado para caber na tela. O export (M5) desfaz essa escala.
 *
 * Camadas: "art" (o que vai para o arquivo final) e "ui" (seleção,
 * nunca exportada).
 */
export class LayoutRenderer {
  private stage: Konva.Stage
  private template: Template | null = null

  /** Clique/toque num slot (com ou sem foto). */
  onSlotClick: ((index: number) => void) | null = null
  /** Clique/toque fora dos slots. */
  onBackgroundClick: (() => void) | null = null
  /** Usuário arrastou ou deu zoom numa foto. */
  onCropChange: ((index: number, crop: Crop) => void) | null = null

  constructor(private container: HTMLDivElement) {
    this.stage = new Konva.Stage({ container, width: 1, height: 1 })
    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) this.onBackgroundClick?.()
    })
    new ResizeObserver(() => this.fit()).observe(container)
  }

  /** `photos[i]` vai no slot i; `selected` destaca um slot. */
  render(
    template: Template,
    photos: readonly (PlacedPhoto | null | undefined)[] = [],
    selected: number | null = null,
    style: Style = DEFAULT_STYLE,
  ): void {
    // O papel escolhido pelo usuário substitui as cores do layout.
    const t: Template = { ...template, paper: style.paper?.paper ?? template.paper, ink: style.paper?.ink ?? template.ink }
    this.template = t
    this.stage.destroyChildren()
    this.container.style.cursor = ''

    const [w, h] = t.size
    const stroke = Math.min(w, h) / 220
    const art = new Konva.Layer({ name: 'art' })

    art.add(new Konva.Rect({ width: w, height: h, fill: t.paper, listening: false }))

    // Moldura do papel
    const inset = stroke * 4
    art.add(
      ...toKonva(
        gen.rectangle(inset, inset, w - inset * 2, h - inset * 2, {
          stroke: t.ink,
          strokeWidth: stroke * 0.6,
          roughness: 1.2,
          bowing: 0.8,
          seed: 1,
        }),
      ),
    )

    t.slots.forEach((s, i) => art.add(this.slot(s, i, t, stroke, photos[i] ?? null, style)))
    t.doodles?.forEach((d, i) => art.add(this.doodle(d, i, t, stroke)))

    const ui = new Konva.Layer({ name: 'ui', listening: false })
    const sel = selected !== null ? t.slots[selected] : undefined
    if (sel) ui.add(this.selection(sel, stroke))

    // Legenda vazia mostra um texto de exemplo só na tela, fora da arte.
    if (t.caption) {
      const text = style.caption.trim()
      if (text) art.add(this.caption(t.caption, t, text, style, 1))
      else ui.add(this.caption(t.caption, t, 'sua legenda aqui', style, 0.4))
    }

    this.stage.add(art, ui)
    this.fit()
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

    const border: Options = {
      stroke: t.ink,
      strokeWidth: stroke,
      roughness: 1.4,
      bowing: 1.2,
      seed: 10 + i,
    }

    if (placed) {
      group.add(this.photo(placed, s, i, style))
      group.add(...toKonva(gen.rectangle(-s.w / 2, -s.h / 2, s.w, s.h, border)))
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
      hachureGap: stroke * 5,
      fillWeight: stroke * 0.4,
    }
    group.add(...toKonva(gen.rectangle(-s.w / 2, -s.h / 2, s.w, s.h, placeholder)))

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
  private photo(placed: PlacedPhoto, s: Slot, i: number, style: Style): Konva.Group {
    const clip = new Konva.Group({ clipX: -s.w / 2, clipY: -s.h / 2, clipWidth: s.w, clipHeight: s.h })
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
          // Grão de ~2px no arquivo final.
          fillPatternScale: { x: 2, y: 2 },
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

  private doodle(d: Doodle, i: number, t: Template, stroke: number): Konva.Group {
    const group = new Konva.Group({ x: d.x, y: d.y, rotation: d.rotate ?? 0, listening: false })
    const opts: Options = { stroke: t.ink, strokeWidth: stroke * 0.8, roughness: 1.6, seed: 100 + i }
    const drawable =
      d.kind === 'star' ? gen.polygon(starPoints(d.size), opts) : gen.curve(heartPoints(d.size), opts)
    group.add(...toKonva(drawable))
    return group
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
    if (!this.template) return
    const [w, h] = this.template.size
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
