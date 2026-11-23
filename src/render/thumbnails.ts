import type { Template } from '../templates'
import { LayoutRenderer, type PlacedPhoto } from './stage'
import type { Style } from './style'

/**
 * Desenha miniaturas dos layouts num stage escondido fora da tela,
 * reaproveitando o mesmo renderer da tela principal.
 */
export class ThumbnailRenderer {
  private renderer: LayoutRenderer

  constructor() {
    const box = document.createElement('div')
    box.setAttribute('aria-hidden', 'true')
    Object.assign(box.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '240px',
      height: '240px',
      pointerEvents: 'none',
    })
    document.body.append(box)
    // Arte nanquim em ~15% da resolução: suficiente para uma miniatura.
    this.renderer = new LayoutRenderer(box, 0.15)
  }

  /** Data URL PNG com o layout, as fotos e o estilo atuais. */
  render(template: Template, photos: readonly (PlacedPhoto | null)[], style: Style, maxSide = 160): string {
    this.renderer.render(template, photos, null, style)
    return this.renderer.snapshot(maxSide)
  }
}
