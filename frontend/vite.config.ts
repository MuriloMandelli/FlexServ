import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Libera o acesso pela rede local, pra testar no celular pelo Wi-Fi
    host: true,
    // O front chama /api/... e o Vite repassa para a API na porta 3333.
    // Assim nao precisa configurar CORS no back-end.
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
})
