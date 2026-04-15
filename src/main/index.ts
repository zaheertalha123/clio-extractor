import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/clio-extractor-logo.png?asset'
import ClioAuthManager from './auth'
import ClioAPIClient, { FirmRevenueFilters, FirmRevenueRow, UnpaidBillsFilters, UnpaidBillsRow } from './api-client'
import { loadEnv } from './env-loader'

loadEnv()

// Initialize auth manager and API client globally
let authManager: ClioAuthManager | null = null
let apiClient: ClioAPIClient | null = null
let mainWindow: BrowserWindow | null = null

export function getAuthManager(): ClioAuthManager | null {
  return authManager
}

function openResultsWindow(data: FirmRevenueRow[]): void {
  const resultsWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    title: 'Firm Revenue Results',
    icon: process.platform !== 'darwin' ? icon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] || ''
  if (is.dev && rendererUrl) {
    resultsWindow.loadURL(rendererUrl.replace(/\/?$/, '/') + 'results.html')
  } else {
    resultsWindow.loadFile(join(__dirname, '../renderer/results.html'))
  }

  resultsWindow.webContents.once('did-finish-load', () => {
    resultsWindow.webContents.send('results-data', data)
  })
}

function openUnpaidBillsResultsWindow(data: UnpaidBillsRow[]): void {
  const resultsWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    title: 'Unpaid Bills Results',
    icon: process.platform !== 'darwin' ? icon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const ubRendererUrl = process.env['ELECTRON_RENDERER_URL'] || ''
  if (is.dev && ubRendererUrl) {
    resultsWindow.loadURL(ubRendererUrl.replace(/\/?$/, '/') + 'results-unpaid-bills.html')
  } else {
    resultsWindow.loadFile(join(__dirname, '../renderer/results-unpaid-bills.html'))
  }

  resultsWindow.webContents.once('did-finish-load', () => {
    // Delay send to ensure renderer has registered IPC listener (new window loads async)
    setTimeout(() => {
      resultsWindow.webContents.send('results-data', data)
    }, 500)
  })
}

export type TableResultsPayload = {
  title?: string
  columns: Array<{ key: string; label: string }>
  records: Array<Record<string, unknown>>
  /** Default filename for CSV export (without extension) */
  csvBaseName?: string
}

/** Single results-table window: focus if same data; replace content if data changed. */
let tableResultsWindow: BrowserWindow | null = null
let tableResultsPayloadFingerprint: string | null = null

function fingerprintTableResultsPayload(payload: TableResultsPayload): string {
  try {
    return JSON.stringify({
      title: payload.title ?? '',
      csvBaseName: payload.csvBaseName ?? '',
      columns: payload.columns,
      records: payload.records
    })
  } catch {
    return `err-${Date.now()}`
  }
}

function focusTableResultsWindow(win: BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  win.focus()
}

function sendTableResultsPayload(win: BrowserWindow, payload: TableResultsPayload, delayMs: number): void {
  const send = (): void => {
    win.webContents.send('table-results-data', payload)
  }
  if (delayMs > 0) {
    setTimeout(send, delayMs)
  } else {
    send()
  }
}

function openOrUpdateTableResultsWindow(payload: TableResultsPayload): void {
  const fp = fingerprintTableResultsPayload(payload)

  if (tableResultsWindow && !tableResultsWindow.isDestroyed()) {
    if (fp === tableResultsPayloadFingerprint) {
      focusTableResultsWindow(tableResultsWindow)
      return
    }
    tableResultsPayloadFingerprint = fp
    tableResultsWindow.setTitle(payload.title || 'Report')
    sendTableResultsPayload(tableResultsWindow, payload, 0)
    focusTableResultsWindow(tableResultsWindow)
    return
  }

  const resultsWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    title: payload.title || 'Report',
    icon: process.platform !== 'darwin' ? icon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  tableResultsWindow = resultsWindow
  tableResultsPayloadFingerprint = fp

  resultsWindow.on('closed', () => {
    if (tableResultsWindow === resultsWindow) {
      tableResultsWindow = null
      tableResultsPayloadFingerprint = null
    }
  })

  const tblRendererUrl = process.env['ELECTRON_RENDERER_URL'] || ''
  if (is.dev && tblRendererUrl) {
    resultsWindow.loadURL(tblRendererUrl.replace(/\/?$/, '/') + 'results-table.html')
  } else {
    resultsWindow.loadFile(join(__dirname, '../renderer/results-table.html'))
  }

  resultsWindow.webContents.once('did-finish-load', () => {
    sendTableResultsPayload(resultsWindow, payload, 400)
  })
}

function createWindow(): void {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    icon: process.platform !== 'darwin' ? icon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.on('close', (e) => {
    e.preventDefault()
    dialog
      .showMessageBox(win, {
        type: 'question',
        buttons: ['Quit', 'Cancel'],
        defaultId: 1,
        title: 'Quit Clio Extractor',
        message: 'Are you sure you want to quit?'
      })
      .then(({ response }) => {
        if (response === 0) {
          mainWindow = null
          win.destroy()
        }
      })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:error', { message: err.message })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:up-to-date')
  })

  // Check for updates after a short delay so the window is ready
  setTimeout(() => {
    mainWindow?.webContents.send('updater:checking')
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err)
    })
  }, 3000)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Initialize Clio Auth Manager and API Client
  authManager = new ClioAuthManager()
  apiClient = new ClioAPIClient(authManager)

  ipcMain.handle('clio:get-current-user', async () => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getCurrentUser()
  })

  ipcMain.handle('clio:get-users', async () => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getUsers()
  })

  ipcMain.handle('clio:get-practice-areas', async () => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getPracticeAreas()
  })

  ipcMain.handle('clio:get-billable-clients', async () => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getBillableClients()
  })

  ipcMain.handle('clio:fetch-firm-revenue', async (_event, filters: FirmRevenueFilters) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getFirmRevenueData(filters)
  })

  ipcMain.handle('clio:fetch-unpaid-bills', async (_event, filters: UnpaidBillsFilters) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getUnpaidBillsData(filters)
  })

  ipcMain.handle('clio:get-matters-by-display-id', async (_event, query: string) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getMattersByDisplayId(typeof query === 'string' ? query : '')
  })

  ipcMain.handle('clio:fetch-custom-fields', async (_event, parentType: string) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    if (parentType !== 'Contact' && parentType !== 'Matter') {
      return { data: [], error: 'parentType must be Contact or Matter' }
    }
    return await apiClient.getCustomFields(parentType as 'Contact' | 'Matter')
  })

  ipcMain.handle('clio:fetch-matter-by-display-number', async (_event, displayNumber: string) => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getMatterByDisplayNumber(displayNumber)
  })

  ipcMain.handle('clio:fetch-activity-ids-by-matter-display-number', async (_event, displayNumber: string) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getActivityIdsByMatterDisplayNumber(displayNumber)
  })

  ipcMain.handle('clio:fetch-activity-by-id', async (_event, id: number) => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getActivityById(id)
  })

  ipcMain.handle('clio:fetch-bills-by-matter-display-number', async (_event, displayNumber: string) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getBillsByMatterDisplayNumber(displayNumber)
  })

  ipcMain.handle('clio:fetch-bill-by-id', async (_event, id: number) => {
    if (!apiClient) return { data: null, error: 'API not initialized' }
    return await apiClient.getBillById(id)
  })

  ipcMain.handle('clio:fetch-matter-custom-field-values', async (_event, matterIdentifier: string, customFieldIds: number[]) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getMatterCustomFieldValues(matterIdentifier, customFieldIds)
  })

  ipcMain.handle('clio:fetch-contact-custom-field-values', async (_event, contactIdentifier: string, customFieldIds: number[]) => {
    if (!apiClient) return { data: [], error: 'API not initialized' }
    return await apiClient.getContactCustomFieldValues(contactIdentifier, customFieldIds)
  })

  ipcMain.handle(
    'clio:fetch-revenue-report-custom-fields',
    async (
      _event,
      payload: {
        allMatters: boolean
        matterDisplayNumbers: string[]
        customFieldIds: number[]
        matterStatus?: string
      }
    ) => {
      if (!apiClient) {
        return { data: [], recordCount: 0, error: 'API not initialized' }
      }
      return await apiClient.fetchRevenueReportCustomFieldData({
        allMatters: Boolean(payload?.allMatters),
        matterDisplayNumbers: Array.isArray(payload?.matterDisplayNumbers) ? payload.matterDisplayNumbers : [],
        customFieldIds: Array.isArray(payload?.customFieldIds) ? payload.customFieldIds : [],
        matterStatus: typeof payload?.matterStatus === 'string' && payload.matterStatus.trim() !== ''
          ? payload.matterStatus.trim()
          : undefined
      })
    }
  )

  ipcMain.handle('dialog:save-csv', async (_event, csvContent: string, defaultName?: string) => {
    const baseName = defaultName || 'firm-revenue'
    const result = await dialog.showSaveDialog({
      title: 'Export CSV',
      defaultPath: `${baseName}-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, csvContent, 'utf-8')
      return { success: true, path: result.filePath }
    }
    return { success: false }
  })

  ipcMain.handle('window:open-results', (_event, data: FirmRevenueRow[]) => {
    openResultsWindow(data)
  })

  ipcMain.handle('window:open-unpaid-bills-results', (_event, data: UnpaidBillsRow[]) => {
    openUnpaidBillsResultsWindow(data)
  })

  ipcMain.handle('window:open-table-results', (_event, payload: TableResultsPayload) => {
    if (!payload?.columns || !Array.isArray(payload.records)) {
      return
    }
    openOrUpdateTableResultsWindow({
      title: payload.title,
      columns: payload.columns,
      records: payload.records,
      csvBaseName: payload.csvBaseName
    })
  })

  ipcMain.handle('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('updater:check-now', () => {
    if (is.dev) {
      mainWindow?.webContents.send('updater:up-to-date')
      return
    }
    mainWindow?.webContents.send('updater:checking')
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err)
    })
  })

  ipcMain.handle('app:get-version', () => app.getVersion())

  createWindow()
  setupAutoUpdater()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
