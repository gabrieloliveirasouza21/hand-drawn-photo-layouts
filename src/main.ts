import './style.css'
import { DEFAULT_CROP, MAX_ZOOM } from './lib/crop'
import { loadPhoto, releasePhoto, type Photo } from './lib/image'
import { LayoutRenderer, type PlacedPhoto } from './render/stage'
import { templates, type Template } from './templates'

const ACCEPT = 'image/*,.heic,.heif'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header>
    <h1>Hand-drawn Photo Layouts</h1>
    <div class="controls">
      <label>
        Layout
        <select id="layout"></select>
      </label>
      <button id="add" type="button">Adicionar fotos</button>
      <input id="files" type="file" accept="${ACCEPT}" multiple hidden />
      <input id="file-one" type="file" accept="${ACCEPT}" hidden />
    </div>
    <p id="status" role="status"></p>
  </header>
  <div id="toolbar" role="toolbar" aria-label="Foto selecionada" hidden>
    <strong id="sel-label"></strong>
    <label class="zoom">
      Zoom
      <input id="zoom" type="range" min="1" max="${MAX_ZOOM}" step="0.01" />
    </label>
    <button id="prev" type="button" title="Mover para o slot anterior" aria-label="Mover para o slot anterior">◀</button>
    <button id="next" type="button" title="Mover para o próximo slot" aria-label="Mover para o próximo slot">▶</button>
    <button id="replace" type="button">Trocar foto</button>
    <button id="remove" type="button">Remover</button>
    <button id="deselect" type="button" title="Fechar" aria-label="Fechar">✕</button>
  </div>
  <div id="stage"></div>
`

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!

const select = $<HTMLSelectElement>('#layout')
const addButton = $<HTMLButtonElement>('#add')
const filesInput = $<HTMLInputElement>('#files')
const fileOneInput = $<HTMLInputElement>('#file-one')
const statusEl = $<HTMLParagraphElement>('#status')
const toolbar = $<HTMLDivElement>('#toolbar')
const selLabel = $<HTMLElement>('#sel-label')
const zoomInput = $<HTMLInputElement>('#zoom')
const prevButton = $<HTMLButtonElement>('#prev')
const nextButton = $<HTMLButtonElement>('#next')
const replaceButton = $<HTMLButtonElement>('#replace')
const removeButton = $<HTMLButtonElement>('#remove')
const deselectButton = $<HTMLButtonElement>('#deselect')
const stageEl = $<HTMLDivElement>('#stage')

// As fotos ficam guardadas independentemente do layout: trocar de layout
// mantém a ordem e o enquadramento, e o layout mostra só as primeiras N.
const placed: (PlacedPhoto | null)[] = []
let template: Template = templates[0]
let selected: number | null = null
let replaceIndex: number | null = null

const renderer = new LayoutRenderer(stageEl)

function redraw(): void {
  if (selected !== null && !placed[selected]) selected = null
  renderer.render(template, placed, selected)
  updateToolbar()
}

function updateToolbar(): void {
  const item = selected !== null ? placed[selected] : null
  toolbar.hidden = !item
  if (!item || selected === null) return
  selLabel.textContent = `Foto ${selected + 1}`
  zoomInput.value = String(item.crop.zoom)
  prevButton.disabled = selected === 0
  nextButton.disabled = selected >= template.slots.length - 1
}

function setPhoto(index: number, photo: Photo): void {
  const old = placed[index]
  if (old) releasePhoto(old.photo)
  placed[index] = { photo, crop: { ...DEFAULT_CROP } }
}

/** Próximo índice livre: primeiro slot vazio do layout atual, senão o fim da lista. */
function nextFreeIndex(): number {
  for (let i = 0; i < template.slots.length; i++) if (!placed[i]) return i
  return Math.max(placed.length, template.slots.length)
}

/** Carrega arquivos um a um, redesenhando a cada foto. `at` substitui um slot específico. */
async function addFiles(files: File[], at?: number): Promise<void> {
  const images = files.filter((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name))
  if (!images.length) return

  addButton.disabled = true
  const failed: string[] = []
  for (const [n, file] of images.entries()) {
    statusEl.textContent = `Carregando foto ${n + 1} de ${images.length}…`
    try {
      const photo = await loadPhoto(file)
      setPhoto(at ?? nextFreeIndex(), photo)
      redraw()
    } catch (err) {
      console.error(file.name, err)
      failed.push(file.name)
    }
  }
  addButton.disabled = false
  statusEl.textContent = failed.length ? `Não consegui abrir: ${failed.join(', ')}` : ''
}

function pickFileFor(index: number): void {
  replaceIndex = index
  fileOneInput.click()
}

function deselect(): void {
  if (selected === null) return
  selected = null
  redraw()
}

/** Troca a foto selecionada com a do slot vizinho; a seleção acompanha a foto. */
function move(direction: -1 | 1): void {
  if (selected === null) return
  const target = selected + direction
  if (target < 0 || target >= template.slots.length) return
  ;[placed[selected], placed[target]] = [placed[target] ?? null, placed[selected] ?? null]
  selected = target
  redraw()
}

// --- Layout ---

for (const t of templates) select.add(new Option(t.name, t.id))

select.addEventListener('change', () => {
  template = templates.find((t) => t.id === select.value) ?? templates[0]
  selected = null
  redraw()
})

// --- Upload ---

addButton.addEventListener('click', () => filesInput.click())

filesInput.addEventListener('change', () => {
  void addFiles([...(filesInput.files ?? [])])
  filesInput.value = ''
})

fileOneInput.addEventListener('change', () => {
  const file = fileOneInput.files?.[0]
  if (file && replaceIndex !== null) void addFiles([file], replaceIndex)
  fileOneInput.value = ''
})

stageEl.addEventListener('dragover', (e) => {
  e.preventDefault()
  stageEl.classList.add('dragging')
})
stageEl.addEventListener('dragleave', () => stageEl.classList.remove('dragging'))
stageEl.addEventListener('drop', (e) => {
  e.preventDefault()
  stageEl.classList.remove('dragging')
  void addFiles([...(e.dataTransfer?.files ?? [])])
})

// --- Canvas ---

// Slot vazio: abre o seletor de arquivo. Slot com foto: seleciona.
renderer.onSlotClick = (index) => {
  if (!placed[index]) return pickFileFor(index)
  selected = index
  redraw()
}

renderer.onBackgroundClick = deselect

renderer.onCropChange = (index, crop) => {
  const item = placed[index]
  if (!item) return
  item.crop = crop
  redraw()
}

// --- Barra da foto selecionada ---

zoomInput.addEventListener('input', () => {
  const item = selected !== null ? placed[selected] : null
  if (!item) return
  item.crop = { ...item.crop, zoom: Number(zoomInput.value) }
  redraw()
})

prevButton.addEventListener('click', () => move(-1))
nextButton.addEventListener('click', () => move(1))
replaceButton.addEventListener('click', () => selected !== null && pickFileFor(selected))
removeButton.addEventListener('click', () => {
  const item = selected !== null ? placed[selected] : null
  if (!item || selected === null) return
  releasePhoto(item.photo)
  placed[selected] = null
  selected = null
  redraw()
})
deselectButton.addEventListener('click', deselect)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselect()
})

redraw()
