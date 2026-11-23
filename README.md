# Hand-drawn Photo Layouts

Monte suas fotos em layouts com estética de desenho à mão e baixe o resultado
pronto para o feed do Instagram, Stories ou impressão.

**Acesse:** https://gabrieloliveirasouza21.github.io/hand-drawn-photo-layouts/

Tudo roda no navegador. As fotos não são enviadas para nenhum servidor.

## O que dá para fazer

- **4 layouts:** tira clássica (4 fotos), grade 2×2, polaroid e tira horizontal (3 fotos)
- **Fotos:** botão, arrastar arquivos para a página ou tocar num espaço vazio.
  Aceita HEIC de iPhone.
- **Enquadramento:** arraste a foto dentro do espaço, dê zoom (roda do mouse ou
  slider), troque de lugar, substitua ou remova
- **Estilo:** filtros (colorido, P&B, sépia, vintage), grão de filme, legenda em
  3 fontes manuscritas e 6 cores de papel
- **Exportar:**

  | Formato | Tamanho | Arquivo |
  |---|---|---|
  | Instagram feed 4:5 | 1080×1350 | JPEG |
  | Instagram quadrado 1:1 | 1080×1080 | JPEG |
  | Stories 9:16 | 1080×1920 | JPEG |
  | Impressão | tamanho do layout (300 dpi) | PNG |

  No celular, o botão **Compartilhar** manda a imagem direto para outros apps.

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
  "slots": [{ "x": 100, "y": 100, "w": 1000, "h": 1000, "rotate": -1 }],
  "doodles": [{ "kind": "star", "x": 150, "y": 1650, "size": 120 }],
  "caption": { "x": 600, "y": 1300, "w": 800, "size": 120, "font": "Caveat" }
}
```

- `slots`: onde as fotos entram; `rotate` em graus, em torno do centro
- `doodles`: `star` ou `heart`, posicionados pelo centro
- `caption`: `x` é o centro horizontal, `y` o topo do texto
- `paper` e `ink`: cores padrão, que o usuário pode trocar pelos papéis prontos

## Como funciona

| Pasta | O que faz |
|---|---|
| `src/templates/` | layouts em JSON |
| `src/render/stage.ts` | desenha o layout com Konva; camada `art` (vai para o arquivo) e `ui` (seleção, nunca exportada) |
| `src/render/rough-konva.ts` | converte os traços do Rough.js em `Konva.Path` |
| `src/lib/image.ts` | lê, converte HEIC e reduz as fotos para 2000px |
| `src/lib/crop.ts` | enquadramento como "centro + zoom", que sobrevive à troca de layout |
| `src/lib/filters.ts` | filtros por pixel e textura de grão |
| `src/lib/export.ts` | formatos, download e compartilhamento |

## Créditos

- [Konva](https://konvajs.org/) (canvas) e [Rough.js](https://roughjs.com/) (traço desenhado à mão)
- [heic2any](https://github.com/alexcorvi/heic2any) (fotos HEIC)
- Fontes [Caveat](https://fonts.google.com/specimen/Caveat),
  [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) e
  [Permanent Marker](https://fonts.google.com/specimen/Permanent+Marker),
  via [Fontsource](https://fontsource.org/)
