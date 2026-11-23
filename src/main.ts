import './style.css'
import { loadPhoto, releasePhoto, type Photo } from './lib/image'
import { LayoutRenderer } from './render/stage'
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
  <div id="stage"></div>
`

const select = app.querySelector<HTMLSelectElement>('#layout')!
const addButton = app.querySelector<HTMLButtonElement>('#add')!
const filesInput = app.querySelector<HTMLInputElement>('#files')!
const fileOneInput = app.querySelector<HTMLInputElement>('#file-one')!
const statusEl = app.querySelector<HTMLParagraphElement>('#status')!
const stageEl = app.querySelector<HTMLDivElement>('#stage')!

// As fotos ficam guardadas independentemente do layout: trocar de layout
// mantém a ordem, e o layout mostra só as primeiras N.
const photos: (Photo | null)[] = []
let template: Template = templates[0]
let replaceIndex: number | null = null

const renderer = new LayoutRenderer(stageEl)
const redraw = () => renderer.render(template, photos)

function setPhoto(index: number, photo: Photo): void {
  const old = photos[index]
  if (old) releasePhoto(old)
  photos[index] = photo
}

/** Próximo índice livre: primeiro slot vazio do layout atual, senão o fim da lista. */
function nextFreeIndex(): number {
  for (let i = 0; i < template.slots.length; i++) if (!photos[i]) return i
  return Math.max(photos.length, template.slots.length)
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

for (const t of templates) select.add(new Option(t.name, t.id))

select.addEventListener('change', () => {
  template = templates.find((t) => t.id === select.value) ?? templates[0]
  redraw()
})

addButton.addEventListener('click', () => filesInput.click())

filesInput.addEventListener('change', () => {
  void addFiles([...(filesInput.files ?? [])])
  filesInput.value = ''
})

renderer.onSlotClick = (index) => {
  replaceIndex = index
  fileOneInput.click()
}

fileOneInput.addEventListener('change', () => {
  const file = fileOneInput.files?.[0]
  if (file && replaceIndex !== null) void addFiles([file], replaceIndex)
  fileOneInput.value = ''
})

// Arrastar e soltar arquivos em cima do layout.
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

redraw()
