import {
  getFirmRevenueFormHtml,
  populateFirmRevenueDropdowns,
  getFirmRevenueFilters,
  setFirmRevenueStatus
} from './firm-revenue'
import {
  getUnpaidBillsFormHtml,
  populateUnpaidBillsDropdowns,
  getUnpaidBillsFilters,
  setUnpaidBillsStatus
} from './unpaid-bills'

type PageId = 'firm-revenue' | 'unpaid-bills'

interface CachedOptions {
  users: Array<{ id: number; name: string }>
  practiceAreas: Array<{ id: number; name: string }>
  clients: Array<{ id: number; name?: string }>
}

let cachedOptions: CachedOptions | null = null

const PAGES: Record<PageId, { title: string; description: string }> = {
  'firm-revenue': {
    title: 'Firm Revenue',
    description: 'Extract and analyze firm revenue data from Clio.'
  },
  'unpaid-bills': {
    title: 'Unpaid Bills',
    description: 'Extract unpaid bills (draft, awaiting approval, awaiting payment) from Clio.'
  }
}

function renderPageContent(pageId: PageId): string {
  if (pageId === 'firm-revenue') return getFirmRevenueFormHtml()
  if (pageId === 'unpaid-bills') return getUnpaidBillsFormHtml()
  return '<div class="page-body"><p class="text">Page not found.</p></div>'
}

async function init(): Promise<void> {
  window.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus()
    setupEventListeners()
    setupUpdateToasts()
  })
}

function setupUpdateToasts(): void {
  if (!window.api?.updater) return

  let toastEl: HTMLDivElement | null = null
  let progressBarEl: HTMLDivElement | null = null

  function ensureContainer(): HTMLDivElement {
    let container = document.getElementById('update-toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'update-toast-container'
      document.body.appendChild(container)
    }
    return container as HTMLDivElement
  }

  function showToast(
    title: string,
    message: string,
    options?: { showProgress?: boolean; progressPercent?: number; showRestart?: boolean; version?: string; isError?: boolean }
  ): HTMLDivElement {
    const container = ensureContainer()
    if (toastEl) toastEl.remove()

    toastEl = document.createElement('div')
    toastEl.className = 'update-toast' + (options?.isError ? ' error' : '')

    toastEl.innerHTML = `
      <div class="update-toast-title">${title}</div>
      <div class="update-toast-message">${message}</div>
      ${options?.showProgress !== false && options?.showProgress ? '<div class="update-toast-progress"><div class="update-toast-progress-bar" style="width: 0%"></div></div>' : ''}
      ${options?.showRestart ? '<div class="update-toast-actions"><button type="button" class="btn-secondary" data-dismiss>Later</button><button type="button" class="btn-primary" data-restart>Restart now</button></div>' : ''}
    `

    if (options?.showProgress) {
      progressBarEl = toastEl.querySelector('.update-toast-progress-bar')
      if (progressBarEl && options?.progressPercent != null) {
        progressBarEl.style.width = `${options.progressPercent}%`
      }
    }

    if (options?.showRestart) {
      toastEl.querySelector('[data-restart]')?.addEventListener('click', () => {
        window.api.updater.quitAndInstall()
      })
      toastEl.querySelector('[data-dismiss]')?.addEventListener('click', () => {
        toastEl?.remove()
        toastEl = null
      })
    }

    container.appendChild(toastEl)
    return toastEl
  }

  window.api.updater.onUpdateChecking(() => {
    showToast('Checking for updates', 'Looking for the latest version...')
  })

  window.api.updater.onUpToDate(() => {
    const upToDateToast = showToast('You\'re up to date', 'Clio Extractor is running the latest version.')
    setTimeout(() => {
      upToDateToast.remove()
      if (toastEl === upToDateToast) toastEl = null
    }, 2500)
  })

  window.api.updater.onUpdateAvailable((info) => {
    showToast('Update available', `Downloading version ${info.version}...`, { showProgress: true })
  })

  window.api.updater.onDownloadProgress((progress) => {
    if (progressBarEl) progressBarEl.style.width = `${progress.percent}%`
  })

  window.api.updater.onUpdateDownloaded((info) => {
    progressBarEl = null
    showToast('Update ready', `Version ${info.version} has been downloaded. Restart the app to install.`, {
      showProgress: false,
      showRestart: true,
      version: info.version
    })
  })

  window.api.updater.onUpdateError((info) => {
    progressBarEl = null
    showToast('Update failed', info.message || 'Could not check for updates.', { isError: true })
  })
}

async function checkAuthStatus(): Promise<void> {
  const loginView = document.getElementById('login-view')
  const appView = document.getElementById('app-view')
  const loadingContainer = document.getElementById('loading-container')
  const loginContainer = document.getElementById('login-container')

  try {
    const isAuthenticated = await window.api.clio.isAuthenticated()

    if (loadingContainer) loadingContainer.style.display = isAuthenticated ? 'none' : 'block'

    if (isAuthenticated) {
      if (loginView) loginView.style.display = 'none'
      if (appView) appView.style.display = 'flex'
      await loadCurrentUser()
      await loadAppVersion()
      await loadPage('firm-revenue')
    } else {
      if (loginView) loginView.style.display = 'flex'
      if (appView) appView.style.display = 'none'
      if (loginContainer) loginContainer.style.display = 'block'
    }
  } catch (error) {
    console.error('Failed to check auth status:', error)
    showStatus('Error checking authentication status', 'error')
    if (loadingContainer) loadingContainer.style.display = 'none'
    if (loginContainer) loginContainer.style.display = 'block'
  }
}

async function loadAppVersion(): Promise<void> {
  const versionEl = document.getElementById('sidebar-version')
  if (!versionEl || !window.api?.getAppVersion) return
  try {
    const version = await window.api.getAppVersion()
    versionEl.textContent = `Version ${version}`
  } catch {
    versionEl.textContent = ''
  }
}

async function loadCurrentUser(): Promise<void> {
  const userNameEl = document.getElementById('user-name')
  if (!userNameEl) return

  try {
    const { data, error } = await window.api.clio.getCurrentUser()

    if (error || !data) {
      userNameEl.textContent = 'User'
      return
    }

    const apiResponse = data as { data?: { name?: string; id?: number } }
    const user = apiResponse?.data
    userNameEl.textContent = user?.name ?? 'User'
  } catch {
    userNameEl.textContent = 'User'
  }
}

async function loadPage(pageId: PageId): Promise<void> {
  const contentArea = document.getElementById('page-content')
  if (!contentArea) return

  contentArea.innerHTML = renderPageContent(pageId)

  document.querySelectorAll('.nav-item:not(.logout-btn)').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.page === pageId)
  })

  if (pageId === 'firm-revenue') {
    await loadFirmRevenueOptions()
    setupFirmRevenueListeners()
  }
  if (pageId === 'unpaid-bills') {
    await loadUnpaidBillsOptions()
    setupUnpaidBillsListeners()
  }
}

async function loadSharedOptions(forceRefresh = false): Promise<CachedOptions> {
  if (cachedOptions && !forceRefresh) return cachedOptions

  const [usersRes, practiceAreasRes, clientsRes] = await Promise.all([
    window.api.clio.getUsers(),
    window.api.clio.getPracticeAreas(),
    window.api.clio.getBillableClients()
  ])

  const users = ((usersRes.data as { data?: Array<{ id: number; name: string }> })?.data || []).filter(
    (u) => u?.id && u?.name
  )
  const practiceAreas = (
    (practiceAreasRes.data as { data?: Array<{ id: number; name: string }> })?.data || []
  ).filter((p) => p?.id)
  const clientsRaw = (clientsRes.data as { data?: Array<Record<string, unknown>> })?.data || []
  const clients = clientsRaw
    .map((c) => {
      const client = c?.client as { id: number; name: string } | undefined
      if (client) return { id: client.id, name: client.name }
      return { id: (c?.id as number) || 0, name: (c?.name as string) || '' }
    })
    .filter((c) => c.id)

  cachedOptions = { users, practiceAreas, clients }
  return cachedOptions
}

async function loadFirmRevenueOptions(forceRefresh = false): Promise<void> {
  try {
    setFirmRevenueStatus('Loading options...', 'info')
    const opts = await loadSharedOptions(forceRefresh)
    populateFirmRevenueDropdowns(opts.users, opts.practiceAreas, opts.clients)
    if (forceRefresh) {
      setFirmRevenueStatus('Options refreshed successfully.', 'success')
    } else {
      setFirmRevenueStatus('', 'info')
    }
  } catch (error) {
    console.error('Failed to load firm revenue options:', error)
    setFirmRevenueStatus('Failed to load options. Click Refresh to retry.', 'error')
  }
}

async function loadUnpaidBillsOptions(forceRefresh = false): Promise<void> {
  try {
    setUnpaidBillsStatus('Loading options...', 'info')
    const opts = await loadSharedOptions(forceRefresh)
    populateUnpaidBillsDropdowns(opts.users, opts.practiceAreas, opts.clients)
    if (forceRefresh) {
      setUnpaidBillsStatus('Options refreshed successfully.', 'success')
    } else {
      setUnpaidBillsStatus('', 'info')
    }
  } catch (error) {
    console.error('Failed to load unpaid bills options:', error)
    setUnpaidBillsStatus('Failed to load options. Click Refresh to retry.', 'error')
  }
}

function setupFirmRevenueListeners(): void {
  const fetchBtn = document.getElementById('fetchRevenueBtn')
  const refreshBtn = document.getElementById('refreshOptionsBtn')
  fetchBtn?.addEventListener('click', handleFetchRevenue)
  refreshBtn?.addEventListener('click', handleRefreshOptions)
}

function setupUnpaidBillsListeners(): void {
  const fetchBtn = document.getElementById('ub-fetchBtn')
  const refreshBtn = document.getElementById('ub-refreshOptionsBtn')
  fetchBtn?.addEventListener('click', handleFetchUnpaidBills)
  refreshBtn?.addEventListener('click', handleRefreshUnpaidBillsOptions)
}

async function handleRefreshUnpaidBillsOptions(): Promise<void> {
  const btn = document.getElementById('ub-refreshOptionsBtn') as HTMLButtonElement
  if (btn) btn.disabled = true
  cachedOptions = null
  await loadUnpaidBillsOptions(true)
  if (btn) btn.disabled = false
}

async function handleFetchUnpaidBills(): Promise<void> {
  const btn = document.getElementById('ub-fetchBtn') as HTMLButtonElement
  if (btn) btn.disabled = true

  setUnpaidBillsStatus('Fetching data...', 'info')

  try {
    const filters = getUnpaidBillsFilters()
    const { data, error } = await window.api.clio.fetchUnpaidBills(filters)

    if (error) {
      setUnpaidBillsStatus(`Error: ${error}`, 'error')
      return
    }

    if (!data || data.length === 0) {
      setUnpaidBillsStatus('No unpaid bills found matching your filters.', 'info')
      return
    }

    await window.api.openUnpaidBillsResults(data)
    setUnpaidBillsStatus(`Found ${data.length} records. Results opened in new window.`, 'success')
  } catch (error) {
    setUnpaidBillsStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  } finally {
    if (btn) btn.disabled = false
  }
}

async function handleRefreshOptions(): Promise<void> {
  const btn = document.getElementById('refreshOptionsBtn') as HTMLButtonElement
  if (btn) btn.disabled = true
  cachedOptions = null
  await loadFirmRevenueOptions(true)
  if (btn) btn.disabled = false
}

async function handleFetchRevenue(): Promise<void> {
  const btn = document.getElementById('fetchRevenueBtn') as HTMLButtonElement
  if (btn) btn.disabled = true

  setFirmRevenueStatus('Fetching data...', 'info')

  try {
    const filters = getFirmRevenueFilters()
    const { data, error } = await window.api.clio.fetchFirmRevenue(filters)

    if (error) {
      setFirmRevenueStatus(`Error: ${error}`, 'error')
      return
    }

    if (!data || data.length === 0) {
      setFirmRevenueStatus('No records found matching your filters.', 'info')
      return
    }

    await window.api.openResultsWindow(data)
    setFirmRevenueStatus(`Found ${data.length} records. Results opened in new window.`, 'success')
  } catch (error) {
    setFirmRevenueStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  } finally {
    if (btn) btn.disabled = false
  }
}

function setupEventListeners(): void {
  const loginBtn = document.getElementById('loginBtn')
  const logoutBtn = document.getElementById('logoutBtn')
  const sidebarLogoutBtn = document.getElementById('sidebar-logout')
  const sidebarCheckUpdatesBtn = document.getElementById('sidebar-check-updates')

  loginBtn?.addEventListener('click', handleLogin)
  logoutBtn?.addEventListener('click', handleLogout)
  sidebarLogoutBtn?.addEventListener('click', handleLogout)
  sidebarCheckUpdatesBtn?.addEventListener('click', handleCheckForUpdates)

  document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
    el.addEventListener('click', async () => {
      const pageId = (el as HTMLElement).dataset.page as PageId
      if (pageId && PAGES[pageId]) {
        await loadPage(pageId)
      }
    })
  })
}

async function handleLogin(): Promise<void> {
  const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement
  const keepLoggedInCheckbox = document.getElementById('keepLoggedIn') as HTMLInputElement
  if (loginBtn) loginBtn.disabled = true

  showStatus('Opening login window...', 'info')

  try {
    const keepMeLoggedIn = keepLoggedInCheckbox?.checked ?? false
    const result = await window.api.clio.login(keepMeLoggedIn)

    if (result.success) {
      showStatus('Successfully logged in!', 'success')
      await checkAuthStatus()
    } else {
      showStatus(`Login failed: ${result.error || 'Unknown error'}`, 'error')
      if (loginBtn) loginBtn.disabled = false
    }
  } catch (error) {
    showStatus(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    if (loginBtn) loginBtn.disabled = false
  }
}

async function handleCheckForUpdates(): Promise<void> {
  const btn = document.getElementById('sidebar-check-updates') as HTMLButtonElement
  if (!window.api?.updater) return
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Checking...'
  }
  await window.api.updater.checkForUpdates()
  // Re-enable after a short delay; toasts show "You're up to date" or update result
  setTimeout(() => {
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Check for updates'
    }
  }, 3000)
}

async function handleLogout(): Promise<void> {
  const sidebarLogoutBtn = document.getElementById('sidebar-logout') as HTMLButtonElement
  if (sidebarLogoutBtn) sidebarLogoutBtn.disabled = true

  showStatus('Logging out...', 'info')

  try {
    const result = await window.api.clio.logout()

    if (result.success) {
      showStatus('Successfully logged out', 'success')
      await checkAuthStatus()
    } else {
      showStatus(`Logout failed: ${result.error || 'Unknown error'}`, 'error')
    }
  } catch (error) {
    showStatus(`Logout error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  } finally {
    if (sidebarLogoutBtn) sidebarLogoutBtn.disabled = false
  }
}

function showStatus(message: string, type: 'info' | 'success' | 'error'): void {
  const statusElement = document.getElementById('status-message')
  if (statusElement) {
    statusElement.textContent = message

    const colors = {
      info: '#0055aa',
      success: '#28a745',
      error: '#dc3545'
    }

    statusElement.style.color = colors[type]

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        statusElement.textContent = ''
      }, 5000)
    }
  }
}

init()
