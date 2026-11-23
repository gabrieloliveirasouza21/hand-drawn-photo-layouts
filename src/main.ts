import './style.css'
import { DEFAULT_CROP, MAX_ZOOM } from './lib/crop'
import { FORMATS, canShareFiles, download, fileName, share } from './lib/export'
import { loadPhoto, releasePhoto, type Photo } from './lib/image'
import { LayoutRenderer, type PlacedPhoto } from './render/stage'
import { DEFAULT_STYLE, FILTERS, FONTS, PAPERS, loadFont, type FilterKind, type Style } from './render/style'
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
      <label>
        Formato
        <select id="format">
          ${FORMATS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
        </select>
      </label>
      <button id="download" type="button" class="primary">Baixar</button>
      <button id="share" type="button" class="primary" hidden>Compartilhar</button>
    </div>
    <div class="style-bar">
      <label>
        Filtro
        <select id="filter">
          ${FILTERS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
        </select>
      </label>
      <label class="check"><input id="grain" type="checkbox" /> Grão</label>
      <label>
        Legenda
        <input id="caption" type="text" maxlength="60" placeholder="sua legenda aqui" />
      </label>
      <label>
        Fonte
        <select id="font">
          ${FONTS.map((f, i) => `<option value="${i}" style="font-family: '${f.family}'">${f.family}</option>`).join('')}
        </select>
      </label>
      <fieldset class="papers">
        <legend>Papel</legend>
        ${PAPERS.map(
          (p) => `<label class="swatch" title="${p.name}">
            <input type="radio" name="paper" value="${p.id}" aria-label="${p.name}" />
            <span style="background: ${p.paper}; border-color: ${p.ink}"></span>
          </label>`,
        ).join('')}
      </fieldset>
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
const filterSelect = $<HTMLSelectElement>('#filter')
const grainInput = $<HTMLInputElement>('#grain')
const captionInput = $<HTMLInputElement>('#caption')
const fontSelect = $<HTMLSelectElement>('#font')
const papersEl = $<HTMLFieldSetElement>('.papers')
const formatSelect = $<HTMLSelectElement>('#format')
const downloadButton = $<HTMLButtonElement>('#download')
const shareButton = $<HTMLButtonElement>('#share')

// As fotos ficam guardadas independentemente do layout: trocar de layout
// mantém a ordem e o enquadramento, e o layout mostra só as primeiras N.
const placed: (PlacedPhoto | null)[] = []
let template: Template = templates[0]
let selected: number | null = null
let replaceIndex: number | null = null
const style: Style = { ...DEFAULT_STYLE }
let format = FORMATS[0]

const renderer = new LayoutRenderer(stageEl)

function redraw(): void {
  if (selected !== null && !placed[selected]) selected = null
  renderer.render(template, placed, selected, style, format.size)
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

// --- Estilo ---

filterSelect.addEventListener('change', () => {
  style.filter = filterSelect.value as FilterKind
  redraw()
})

grainInput.addEventListener('change', () => {
  style.grain = grainInput.checked
  redraw()
})

captionInput.addEventListener('input', () => {
  style.caption = captionInput.value
  redraw()
})

fontSelect.addEventListener('change', async () => {
  style.font = FONTS[Number(fontSelect.value)] ?? FONTS[0]
  await loadFont(style.font)
  redraw()
})

papersEl.addEventListener('change', (e) => {
  const id = (e.target as HTMLInputElement).value
  style.paper = PAPERS.find((p) => p.id === id) ?? null
  redraw()
})

// --- Exportar ---

formatSelect.addEventListener('change', () => {
  format = FORMATS.find((f) => f.id === formatSelect.value) ?? FORMATS[0]
  redraw()
})

async function exportImage(action: 'download' | 'share'): Promise<void> {
  downloadButton.disabled = shareButton.disabled = true
  statusEl.textContent = 'Gerando imagem…'
  try {
    const blob = await renderer.exportImage(format.mime)
    const name = fileName(template.id, format)
    if (action === 'share') {
      try {
        await share(blob, name)
      } catch (err) {
        // Safari recusa compartilhar se a imagem demorou a ficar pronta: baixa no lugar.
        if (err instanceof DOMException && err.name === 'NotAllowedError') download(blob, name)
        else throw err
      }
    } else {
      download(blob, name)
    }
    statusEl.textContent = ''
  } catch (err) {
    console.error(err)
    statusEl.textContent = 'Não consegui gerar a imagem.'
  } finally {
    downloadButton.disabled = shareButton.disabled = false
  }
}

downloadButton.addEventListener('click', () => void exportImage('download'))
shareButton.addEventListener('click', () => void exportImage('share'))
shareButton.hidden = !canShareFiles()

redraw()
// O canvas não redesenha sozinho quando a fonte chega: espera e redesenha.
void Promise.all(FONTS.map(loadFont)).then(redraw)
