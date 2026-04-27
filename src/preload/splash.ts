import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('splashApi', {
  onLog: (callback: (line: string) => void): void => {
    ipcRenderer.on('splash:log', (_event, line: string) => {
      callback(line)
    })
  },
  onStatus: (callback: (text: string) => void): void => {
    ipcRenderer.on('splash:status', (_event, text: string) => {
      callback(text)
    })
  }
})
