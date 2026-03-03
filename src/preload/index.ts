import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  clio: {
    login: (keepMeLoggedIn: boolean) => ipcRenderer.invoke('clio:login', keepMeLoggedIn),
    logout: () => ipcRenderer.invoke('clio:logout'),
    getToken: () => ipcRenderer.invoke('clio:get-token'),
    isAuthenticated: () => ipcRenderer.invoke('clio:is-authenticated'),
    getCurrentUser: () => ipcRenderer.invoke('clio:get-current-user'),
    getUsers: () => ipcRenderer.invoke('clio:get-users'),
    getPracticeAreas: () => ipcRenderer.invoke('clio:get-practice-areas'),
    getBillableClients: () => ipcRenderer.invoke('clio:get-billable-clients'),
    fetchFirmRevenue: (filters: Record<string, unknown>) => ipcRenderer.invoke('clio:fetch-firm-revenue', filters),
    fetchUnpaidBills: (filters: Record<string, unknown>) => ipcRenderer.invoke('clio:fetch-unpaid-bills', filters)
  },
  results: {
    onResultsData: (callback: (data: unknown[]) => void) => {
      ipcRenderer.on('results-data', (_event, data) => callback(data))
    },
    saveCsv: (content: string, defaultName?: string) => ipcRenderer.invoke('dialog:save-csv', content, defaultName)
  },
  openResultsWindow: (data: unknown[]) => ipcRenderer.invoke('window:open-results', data),
  openUnpaidBillsResults: (data: unknown[]) => ipcRenderer.invoke('window:open-unpaid-bills-results', data)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
