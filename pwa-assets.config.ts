import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo-icon.svg', 'public-dev/logo-icon.svg', 'public-staging/logo-icon.svg'],
})
