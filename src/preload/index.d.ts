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
}

interface ResultsAPI {
  onResultsData: (callback: (data: unknown[]) => void) => void
  saveCsv: (content: string) => Promise<{ success: boolean; path?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      clio: ClioAPI
      results: ResultsAPI
      openResultsWindow: (data: unknown[]) => Promise<void>
      openUnpaidBillsResults: (data: unknown[]) => Promise<void>
    }
  }
}
