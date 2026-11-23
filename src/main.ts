import './style.css'
import { LayoutRenderer } from './render/stage'
import { templates } from './templates'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header>
    <h1>Hand-drawn Photo Layouts</h1>
    <label>
      Layout
      <select id="layout"></select>
    </label>
  </header>
  <div id="stage"></div>
`

const select = app.querySelector<HTMLSelectElement>('#layout')!
const stageEl = app.querySelector<HTMLDivElement>('#stage')!

for (const t of templates) select.add(new Option(t.name, t.id))

const renderer = new LayoutRenderer(stageEl)

function show(id: string): void {
  const template = templates.find((t) => t.id === id)
  if (template) renderer.render(template)
}

select.addEventListener('change', () => show(select.value))
show(templates[0].id)
