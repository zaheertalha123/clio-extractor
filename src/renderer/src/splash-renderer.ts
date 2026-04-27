import companyLogoUrl from '../../../resources/epggb_logo.jpg?url'

const companyLogoEl = document.getElementById('splash-company-logo') as HTMLImageElement | null
if (companyLogoEl) {
  companyLogoEl.src = companyLogoUrl
}

const messageEl = document.getElementById('splash-message')

function setMessage(text: string): void {
  if (messageEl) messageEl.textContent = text
}

window.splashApi.onStatus(setMessage)
window.splashApi.onLog(setMessage)
