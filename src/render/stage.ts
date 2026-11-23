import Konva from 'konva'
import type { Options } from 'roughjs/bin/core'
import type { Photo } from '../lib/image'
import type { Caption, Doodle, Slot, Template } from '../templates'
import { heartPoints, starPoints } from './doodles'
import { gen, toKonva, withAlpha } from './rough-konva'

/**
 * Desenha um template num Konva.Stage.
 * Tudo é desenhado nas coordenadas do arquivo final; o stage só é
 * escalado para caber na tela. O export (M5) desfaz essa escala.
 */
export class LayoutRenderer {
  private stage: Konva.Stage
  private template: Template | null = null

  /** Chamado quando o usuário clica/toca num slot. */
  onSlotClick: ((index: number) => void) | null = null

  constructor(private container: HTMLDivElement) {
    this.stage = new Konva.Stage({ container, width: 1, height: 1 })
    new ResizeObserver(() => this.fit()).observe(container)
  }

  /** `photos[i]` vai no slot i; slots sem foto mostram o placeholder. */
  render(t: Template, photos: readonly (Photo | null | undefined)[] = []): void {
    this.template = t
    this.stage.destroyChildren()
    this.container.style.cursor = ''

    const [w, h] = t.size
    const stroke = Math.min(w, h) / 220
    const layer = new Konva.Layer()

    layer.add(new Konva.Rect({ width: w, height: h, fill: t.paper, listening: false }))

    // Moldura do papel
    const inset = stroke * 4
    layer.add(
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

    t.slots.forEach((s, i) => layer.add(this.slot(s, i, t, stroke, photos[i] ?? null)))
    t.doodles?.forEach((d, i) => layer.add(this.doodle(d, i, t, stroke)))
    if (t.caption) layer.add(this.caption(t.caption, t))

    this.stage.add(layer)
    this.fit()
  }

  private slot(s: Slot, i: number, t: Template, stroke: number, photo: Photo | null): Konva.Group {
    const group = new Konva.Group({
      name: 'slot',
      x: s.x + s.w / 2,
      y: s.y + s.h / 2,
      rotation: s.rotate ?? 0,
    })

    // Área clicável: os traços do Rough.js não recebem eventos.
    group.add(new Konva.Rect({ x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'transparent' }))
    group.on('click tap', () => this.onSlotClick?.(i))
    group.on('mouseenter', () => (this.container.style.cursor = 'pointer'))
    group.on('mouseleave', () => (this.container.style.cursor = ''))

    const border: Options = {
      stroke: t.ink,
      strokeWidth: stroke,
      roughness: 1.4,
      bowing: 1.2,
      seed: 10 + i,
    }

    if (photo) {
      group.add(this.photo(photo, s))
      group.add(...toKonva(gen.rectangle(-s.w / 2, -s.h / 2, s.w, s.h, border)))
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

  /** Foto em modo "cover": preenche o slot inteiro, centralizada, recortada nas bordas. */
  private photo(photo: Photo, s: Slot): Konva.Group {
    const clip = new Konva.Group({ clipX: -s.w / 2, clipY: -s.h / 2, clipWidth: s.w, clipHeight: s.h })
    const scale = Math.max(s.w / photo.width, s.h / photo.height)
    const width = photo.width * scale
    const height = photo.height * scale
    clip.add(new Konva.Image({ image: photo.source, x: -width / 2, y: -height / 2, width, height }))
    return clip
  }

  private doodle(d: Doodle, i: number, t: Template, stroke: number): Konva.Group {
    const group = new Konva.Group({ x: d.x, y: d.y, rotation: d.rotate ?? 0 })
    const opts: Options = { stroke: t.ink, strokeWidth: stroke * 0.8, roughness: 1.6, seed: 100 + i }
    const drawable =
      d.kind === 'star' ? gen.polygon(starPoints(d.size), opts) : gen.curve(heartPoints(d.size), opts)
    group.add(...toKonva(drawable))
    return group
  }

  private caption(c: Caption, t: Template): Konva.Text {
    // Fonte manuscrita de verdade entra no M4; por ora usa o fallback "cursive".
    const text = new Konva.Text({
      name: 'caption',
      x: c.x - c.w / 2,
      y: c.y,
      width: c.w,
      align: 'center',
      wrap: 'none',
      text: 'sua legenda aqui',
      fontSize: c.size,
      fontFamily: `${c.font}, cursive`,
      fill: t.ink,
      opacity: 0.45,
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
