import { shouldEnableMatterDateRangeFilters } from './matters-selection-shared'

export interface MatterDateRangeIds {
  /** Wrapper with position relative for popover */
  fieldWrapId: string
  displayId: string
  openBtnId: string
  popoverId: string
  startInputId: string
  endInputId: string
  applyBtnId: string
  clearBtnId: string
  matterStatusSelectId: string
  allMattersCheckboxId: string
}

function formatUsFromYmd(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return iso
  return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function updateRangeDisplay(displayEl: HTMLElement, startVal: string, endVal: string): void {
  if (!startVal || !endVal) {
    displayEl.textContent = '—'
    return
  }
  displayEl.textContent = `${formatUsFromYmd(startVal)} to ${formatUsFromYmd(endVal)}`
}

/**
 * Wires Date Range popover + sync with Matter Status / All Matters (same rules as API).
 */
export function setupMatterDateRangePicker(ids: MatterDateRangeIds): void {
  const fieldWrap = document.getElementById(ids.fieldWrapId)
  const displayEl = document.getElementById(ids.displayId)
  const openBtn = document.getElementById(ids.openBtnId) as HTMLButtonElement | null
  const popover = document.getElementById(ids.popoverId)
  const startInput = document.getElementById(ids.startInputId) as HTMLInputElement | null
  const endInput = document.getElementById(ids.endInputId) as HTMLInputElement | null
  const applyBtn = document.getElementById(ids.applyBtnId) as HTMLButtonElement | null
  const clearBtn = document.getElementById(ids.clearBtnId) as HTMLButtonElement | null
  const matterStatusEl = document.getElementById(ids.matterStatusSelectId) as HTMLSelectElement | null
  const allMattersEl = document.getElementById(ids.allMattersCheckboxId) as HTMLInputElement | null

  if (
    !fieldWrap ||
    !displayEl ||
    !openBtn ||
    !popover ||
    !startInput ||
    !endInput ||
    !applyBtn ||
    !clearBtn ||
    !matterStatusEl ||
    !allMattersEl
  ) {
    return
  }

  const closePopover = (): void => {
    popover.hidden = true
    openBtn.setAttribute('aria-expanded', 'false')
  }

  const openPopover = (): void => {
    if (openBtn.disabled) return
    popover.hidden = false
    openBtn.setAttribute('aria-expanded', 'true')
  }

  const syncEnabled = (): void => {
    const enabled = shouldEnableMatterDateRangeFilters(matterStatusEl.value, allMattersEl.checked)
    fieldWrap.classList.toggle('rr-date-range-field--disabled', !enabled)
    openBtn.disabled = !enabled
    startInput.disabled = !enabled
    endInput.disabled = !enabled
    applyBtn.disabled = !enabled
    clearBtn.disabled = !enabled
    if (!enabled) {
      startInput.value = ''
      endInput.value = ''
      updateRangeDisplay(displayEl, '', '')
      closePopover()
    } else {
      updateRangeDisplay(displayEl, startInput.value, endInput.value)
    }
  }

  openBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (openBtn.disabled) return
    if (popover.hidden) {
      openPopover()
    } else {
      closePopover()
    }
  })

  applyBtn.addEventListener('click', (e) => {
    e.preventDefault()
    updateRangeDisplay(displayEl, startInput.value, endInput.value)
    closePopover()
  })

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault()
    startInput.value = ''
    endInput.value = ''
    updateRangeDisplay(displayEl, '', '')
    closePopover()
  })

  document.addEventListener('click', (e) => {
    if (popover.hidden) return
    if (!fieldWrap.contains(e.target as Node)) {
      closePopover()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (popover.hidden) return
    if (e.key === 'Escape') {
      closePopover()
    }
  })

  popover.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  matterStatusEl.addEventListener('change', syncEnabled)
  allMattersEl.addEventListener('change', syncEnabled)

  syncEnabled()
}
