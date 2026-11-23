import { defineConfig } from 'vite'

// GitHub Pages serve o site em /<nome-do-repo>/
export default defineConfig({
  base: '/hand-drawn-photo-layouts/',
  build: {
    // O heic2any (~1,3 MB) fica num chunk próprio, carregado só quando
    // o usuário envia um HEIC fora do Safari.
    chunkSizeWarningLimit: 1500,
  },
})
