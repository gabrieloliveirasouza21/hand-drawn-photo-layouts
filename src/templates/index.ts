import type { Template } from './types'
import strip4 from './strip-4.json'
import grid2x2 from './grid-2x2.json'
import polaroid from './polaroid.json'
import strip3h from './strip-3h.json'
import sketchbook from './sketchbook.json'
import sketchbookInk from './sketchbook-ink.json'
import sketchbookComic from './sketchbook-comic.json'

// Para adicionar um layout: crie o JSON nesta pasta e inclua aqui.
export const templates = [sketchbook, sketchbookInk, sketchbookComic, strip4, grid2x2, polaroid, strip3h] as Template[]

export type * from './types'
