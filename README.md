# Hand-drawn Photo Layouts

Monte suas fotos em layouts com estética de desenho à mão e baixe o resultado
pronto para o feed do Instagram, Stories ou impressão.

**Acesse:** https://gabrieloliveirasouza21.github.io/hand-drawn-photo-layouts/

Tudo roda no navegador. As fotos não são enviadas para nenhum servidor.

## O que dá para fazer

- **6 layouts:** sketchbook (página de caderno com espiral, pontilhado e fita
  adesiva, já em 4:5), sketchbook rabiscado (desenhos de caneta azul e
  aquarela no fundo), tira clássica (4 fotos), grade 2×2, polaroid e tira
  horizontal (3 fotos)
- **Traço à mão:** bordas tortas com dupla passada de caneta (Rough.js), foto
  recortada seguindo a borda e legenda com sublinhado ondulado
- **Fotos:** botão, arrastar arquivos para a página ou tocar num espaço vazio.
  Aceita HEIC de iPhone.
- **Enquadramento:** arraste a foto dentro do espaço, dê zoom (roda do mouse ou
  slider), troque de lugar, substitua ou remova
- **Estilo:** filtros (colorido, P&B, sépia, vintage), grão de filme, legenda
  opcional em 3 fontes manuscritas e 6 cores de papel
- **Exportar:**

  | Formato | Tamanho | Arquivo |
  |---|---|---|
  | Instagram feed 4:5 | 1080×1350 | JPEG |
  | Instagram quadrado 1:1 | 1080×1080 | JPEG |
  | Stories 9:16 | 1080×1920 | JPEG |
  | Impressão | tamanho do layout (300 dpi) | PNG |

## Desenvolvimento

Requer Node 24.

```sh
npm install
npm run dev      # http://localhost:5173/hand-drawn-photo-layouts/
npm run build    # gera dist/
```

O deploy no GitHub Pages roda sozinho a cada push na `main`
(`.github/workflows/deploy.yml`).

### Depois de instalar ou atualizar pacotes

O npm 11 às vezes remove do `package-lock.json` as dependências opcionais
`@emnapi/*` (usadas pelo binário wasm do Rolldown, dentro do Vite 8), e o
`npm ci` do deploy falha com `Missing: @emnapi/core ... from lock file`.
Depois de qualquer `npm install <pacote>`, rode:

```sh
npm run fix-lock
```

## Como criar um layout

Crie um JSON em `src/templates/` e registre em `src/templates/index.ts`.
As medidas são em pixels do arquivo de impressão (300 dpi: 1200×1800 = 10×15 cm).

```json
{
  "id": "meu-layout",
  "name": "Meu layout",
  "size": [1200, 1800],
  "paper": "#f5efe1",
  "ink": "#2b2420",
  "pattern": "dots",
  "binding": "top",
  "frame": false,
  "drawingInk": "#2a4da0",
  "slots": [{ "x": 100, "y": 200, "w": 1000, "h": 1000, "rotate": -3, "tape": "top" }],
  "drawings": [{ "kind": "flower", "x": 200, "y": 1500, "size": 300, "rotate": -8, "wash": "#f08a8a" }],
  "caption": { "x": 600, "y": 1400, "w": 1000, "size": 120, "font": "Caveat" }
}
```

- `slots`: onde as fotos entram; `rotate` em graus, em torno do centro;
  `tape` (opcional): `top` ou `corners`
- `caption`: `x` é o centro horizontal, `y` o topo do texto
- `paper` e `ink`: cores padrão, que o usuário pode trocar pelos papéis prontos
- `pattern` (opcional): pauta do papel, `dots`, `lines` ou `grid`
- `binding` (opcional): espiral de caderno no `top` ou na lateral (`left`)
- `drawings` (opcional): rabiscos de fundo, atrás das fotos, posicionados pelo
  centro. Tipos: `branch`, `flower`, `swirl`, `cloud`, `sun`, `moon`, `notes`,
  `bolt`, `arrow`, `eye`, `stain` (mancha de café), `hatch` (hachura), `waves`.
  `wash` pinta uma mancha de aquarela por baixo
- `drawingInk` (opcional): cor da caneta dos rabiscos; padrão é `ink`
- `frame` (opcional): `false` tira a moldura desenhada em volta do papel

## Como funciona

| Pasta | O que faz |
|---|---|
| `src/templates/` | layouts em JSON |
| `src/render/stage.ts` | desenha o layout com Konva; camada `art` (vai para o arquivo) e `ui` (seleção, nunca exportada) |
| `src/render/rough-konva.ts` | converte os traços do Rough.js em `Konva.Path` |
| `src/render/sketch.ts` | formas tortas, sublinhado, pauta, espiral e fita adesiva |
| `src/render/drawings.ts` | rabiscos de fundo do sketchbook (flor, galho, olho etc.) |
| `src/lib/image.ts` | lê, converte HEIC e reduz as fotos para 2000px |
| `src/lib/crop.ts` | enquadramento como "centro + zoom", que sobrevive à troca de layout |
| `src/lib/filters.ts` | filtros por pixel e textura de grão |
| `src/lib/export.ts` | formatos e download |

## Créditos

- [Konva](https://konvajs.org/) (canvas) e [Rough.js](https://roughjs.com/) (traço desenhado à mão)
- [heic2any](https://github.com/alexcorvi/heic2any) (fotos HEIC)
- Fontes [Caveat](https://fonts.google.com/specimen/Caveat),
  [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) e
  [Permanent Marker](https://fonts.google.com/specimen/Permanent+Marker) (legendas) e
  [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (interface),
  via [Fontsource](https://fontsource.org/)
