import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts',
          splash: 'src/preload/splash.ts'
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html',
          splash: 'src/renderer/splash.html',
          about: 'src/renderer/about.html',
          results: 'src/renderer/results.html',
          'results-unpaid-bills': 'src/renderer/results-unpaid-bills.html',
          'results-table': 'src/renderer/results-table.html'
        }
      }
    }
  }
})
