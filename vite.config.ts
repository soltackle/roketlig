import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/roketlig/',
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
})
