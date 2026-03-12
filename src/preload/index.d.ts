import { ElectronAPI } from '@electron-toolkit/preload'

interface ClioUserResponse {
  data: { id?: number; name?: string; [key: string]: unknown } | null
  error?: string
}

interface ClioAPI {
  login: (keepMeLoggedIn: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<{ success: boolean; error?: string }>
  getToken: () => Promise<string | null>
  isAuthenticated: () => Promise<boolean>
  getCurrentUser: () => Promise<ClioUserResponse>
  getUsers: () => Promise<{ data: unknown; error?: string }>
  getPracticeAreas: () => Promise<{ data: unknown; error?: string }>
  getBillableClients: () => Promise<{ data: unknown; error?: string }>
  fetchFirmRevenue: (filters: Record<string, unknown>) => Promise<{ data: unknown[]; error?: string }>
  fetchUnpaidBills: (filters: Record<string, unknown>) => Promise<{ data: unknown[]; error?: string }>
  fetchCustomFields: (parentType: 'Contact' | 'Matter') => Promise<{ data: Array<Record<string, unknown>>; error?: string }>
  fetchMatterByDisplayNumber: (displayNumber: string) => Promise<{ data: Record<string, unknown> | null; error?: string }>
  fetchActivityIdsByMatterDisplayNumber: (displayNumber: string) => Promise<{ data: Array<{ id: number; note?: string }>; error?: string }>
  fetchActivityById: (id: number) => Promise<{ data: Record<string, unknown> | null; error?: string }>
}

interface ResultsAPI {
  onResultsData: (callback: (data: unknown[]) => void) => void
  saveCsv: (content: string) => Promise<{ success: boolean; path?: string }>
}

interface UpdaterAPI {
  onUpdateChecking: (callback: () => void) => void
  onUpToDate: (callback: () => void) => void
  onUpdateAvailable: (callback: (info: { version: string }) => void) => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void
  onUpdateError: (callback: (info: { message: string }) => void) => void
  checkForUpdates: () => Promise<void>
  quitAndInstall: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      clio: ClioAPI
      results: ResultsAPI
      openResultsWindow: (data: unknown[]) => Promise<void>
      openUnpaidBillsResults: (data: unknown[]) => Promise<void>
      updater: UpdaterAPI
      getAppVersion: () => Promise<string>
    }
  }
}
