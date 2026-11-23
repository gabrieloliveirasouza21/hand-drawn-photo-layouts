# Hand-drawn Photo Layouts

Monte suas fotos em layouts com estética de desenho à mão e baixe o resultado
pronto para o feed do Instagram, Stories ou impressão.

**Acesse:** https://gabrieloliveirasouza21.github.io/hand-drawn-photo-layouts/

Tudo roda no navegador. As fotos não são enviadas para nenhum servidor.

## O que dá para fazer

- **9 layouts:** sketchbook (página de caderno com espiral, pontilhado e fita
  adesiva), sketchbook nanquim (paisagem a nanquim de página inteira com as
  fotos coladas por cima), sketchbook quadrinhos (página em quadros, com fotos
  e cenas desenhadas), colagem (5 fotos inclinadas sobre uma praia a
  nanquim), quadrinhos vertical (4 fotos e uma cena), tira clássica (4 fotos),
  grade 2×2, polaroid e tira horizontal (3 fotos). Os cinco primeiros já saem
  em 4:5 e preenchem o feed do Instagram inteiro.
- **Ilustração a nanquim gerada por código:** 6 cenários naturais
  (montanhas, floresta, mar, praia, campo e deserto), só com traço de caneta e
  hachura. Cada cenário tem elementos opcionais (lago ou campina, farol, barco,
  casa, rio, sol ou lua...). Todo
  layout tem uma arte de fundo; em **Arte nanquim** dá para escolher o
  cenário, tirar a arte, ou clicar em **Gerar outra arte**: sorteia um
  cenário diferente (ou, com um cenário escolhido, outra versão dele)
- **Traço à mão:** bordas tortas com dupla passada de caneta (Rough.js), foto
  recortada seguindo a borda e legenda com sublinhado ondulado
- **Fotos:** botão, arrastar arquivos para a página ou tocar num espaço vazio.
  Aceita HEIC de iPhone.
- **Enquadramento:** arraste a foto dentro do espaço, dê zoom (roda do mouse ou
  slider), troque de lugar, substitua ou remova
- **Estilo:**
  - 11 filtros: colorido, P&B, noir, sépia, vintage, desbotado, quente, frio,
    cianotipia, xerox (fotocópia de zine) e "tinta e papel" (duotom nas cores
    do papel escolhido)
  - grão de filme
  - legenda opcional em 8 fontes manuscritas (Caveat, Patrick Hand, Permanent
    Marker, Rock Salt, Special Elite, Shadows Into Light, Gloria Hallelujah,
    Reenie Beanie)
  - 13 cores de papel, cada uma com a cor de tinta que combina
  - pauta do caderno opcional
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
  "scenes": [{ "kind": "mountains", "x": 0, "y": 1300, "w": 1200, "h": 500, "frame": true, "seed": 3 }],
  "slots": [{ "x": 100, "y": 200, "w": 1000, "h": 1000, "rotate": -3, "tape": "top", "mat": true }],
  "caption": { "x": 600, "y": 1220, "w": 1000, "size": 70, "font": "Caveat" }
}
```

- `slots`: onde as fotos entram; `rotate` em graus, em torno do centro;
  `tape` (opcional): `top` ou `corners`; `mat` (opcional): margem de papel em
  volta, como foto impressa colada
- `caption`: `x` é o centro horizontal, `y` o topo do texto
- `paper` e `ink`: cores padrão, que o usuário pode trocar pelos papéis prontos
- `pattern` (opcional): pauta do papel, `dots`, `lines` ou `grid`
- `binding` (opcional): espiral de caderno no `top` ou na lateral (`left`)
- `scenes` (opcional): ilustrações a nanquim atrás das fotos, num retângulo
  (`x`, `y`, `w`, `h`). Tipos: `mountains`, `forest`, `sea`, `beach`,
  `fields`, `desert`.
  `frame: true` desenha um quadro em volta (estilo quadrinho); `seed` muda o
  desenho; `opacity` (0–1) clareia a arte. Cenas sem quadro são arte de fundo:
  o usuário pode trocar o tipo ou tirá-las. Cenas com quadro sempre aparecem
- `frame` (opcional): `false` tira a moldura desenhada em volta do papel

## Como funciona

| Pasta | O que faz |
|---|---|
| `src/templates/` | layouts em JSON |
| `src/render/stage.ts` | desenha o layout com Konva; camada `art` (vai para o arquivo) e `ui` (seleção, nunca exportada) |
| `src/render/rough-konva.ts` | converte os traços do Rough.js em `Konva.Path` |
| `src/render/sketch.ts` | formas tortas, sublinhado, pauta, espiral e fita adesiva |
| `src/render/ink.ts` | motor de nanquim: traço tremido, hachura e as cenas (em cache) |
| `src/lib/image.ts` | lê, converte HEIC e reduz as fotos para 2000px |
| `src/lib/crop.ts` | enquadramento como "centro + zoom", que sobrevive à troca de layout |
| `src/lib/filters.ts` | filtros por pixel e textura de grão |
| `src/lib/export.ts` | formatos e download |

## Créditos

- [Konva](https://konvajs.org/) (canvas) e [Rough.js](https://roughjs.com/) (traço desenhado à mão)
- [heic2any](https://github.com/alexcorvi/heic2any) (fotos HEIC)
- Fontes (licença OFL, via [Fontsource](https://fontsource.org/)):
  Caveat, Patrick Hand, Permanent Marker, Rock Salt, Special Elite, Shadows
  Into Light, Gloria Hallelujah e Reenie Beanie (legendas) e Pixelify Sans
  (interface)
