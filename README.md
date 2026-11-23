# hand-drawn-photo-layouts

Monte fotos em layouts com estética de desenho à mão. Roda inteiro no navegador
(as fotos não saem do aparelho) e é publicado no GitHub Pages.

## Desenvolvimento

```sh
npm install
npm run dev
```

### Depois de instalar ou atualizar pacotes

O npm 11 às vezes remove do `package-lock.json` as dependências opcionais
`@emnapi/*` (usadas pelo binário wasm do Rolldown, dentro do Vite 8), e o
`npm ci` do deploy falha com `Missing: @emnapi/core ... from lock file`.
Depois de qualquer `npm install <pacote>`, rode:

```sh
npm run fix-lock
```
