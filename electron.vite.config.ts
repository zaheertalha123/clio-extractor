import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html',
          results: 'src/renderer/results.html',
          'results-unpaid-bills': 'src/renderer/results-unpaid-bills.html',
          'results-table': 'src/renderer/results-table.html'
        }
      }
    }
  }
})
