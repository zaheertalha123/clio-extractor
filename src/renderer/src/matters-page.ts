import { setupMatterDateRangePicker } from './matter-date-range-ui'
import { MATTER_STATUS_OPTIONS_HTML, shouldEnableMatterDateRangeFilters, type MatterPickerRow } from './matters-selection-shared'

interface Elements {
  input: HTMLInputElement
  suggestions: HTMLUListElement
  chips: HTMLDivElement
  status: HTMLElement
  block: HTMLElement
}

interface UiState {
  suggestions: MatterPickerRow[]
  activeIndex: number
  debounce: ReturnType<typeof setTimeout> | null
  loading: boolean
  selected: MatterPickerRow[]
}

const DEBOUNCE_MS = 300

/** Set in setupMattersPage; used when syncing selection from chip removes */
let matterStatusEl: HTMLSelectElement | null = null
let allMattersEl: HTMLInputElement | null = null

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * JSON property on each Clio matter row for a given UI detail key.
 * Must stay aligned with `MATTER_GENERAL_DETAIL_FIELD_MAP` in main/api/matters/matter-general-details-fetch.ts.
 */
const MATTER_DETAIL_RESPONSE_PROP: Readonly<Record<string, string>> = {
  description: 'description',
  responsible_attorney: 'responsible_attorney',
  responsible_staff: 'responsible_staff',
  blocked_users: 'blocked_groups',
  originating_attorney: 'originating_attorney',
  practice_area: 'practice_area',
  matter_stage: 'matter_stage',
  client_reference: 'client_reference',
  location: 'location',
  status: 'status',
  open_date: 'open_date',
  pending_date: 'pending_date',
  close_date: 'close_date',
  limitations_date: 'statute_of_limitations',
  billable: 'billable',
  /** API property on matter row */
  custom_rates: 'custom_rate',
  maildrop_address: 'maildrop_address'
}

/** General-detail checkboxes: keys must match `MATTER_GENERAL_DETAIL_FIELD_MAP` in main/api/matters/matter-general-details-fetch.ts */
const MATTER_GENERAL_DETAIL_OPTIONS: ReadonlyArray<{ key: string; label: string; defaultChecked: boolean }> = [
  { key: 'description', label: 'Matter description', defaultChecked: true },
  { key: 'responsible_attorney', label: 'Responsible attorney', defaultChecked: true },
  { key: 'responsible_staff', label: 'Responsible staff', defaultChecked: false },
  { key: 'blocked_users', label: 'Blocked users', defaultChecked: false },
  { key: 'originating_attorney', label: 'Originating attorney', defaultChecked: true },
  { key: 'practice_area', label: 'Practice area', defaultChecked: true },
  { key: 'matter_stage', label: 'Matter stage', defaultChecked: false },
  { key: 'client_reference', label: 'Client reference number', defaultChecked: false },
  { key: 'location', label: 'Location', defaultChecked: true },
  { key: 'status', label: 'Status', defaultChecked: true },
  { key: 'open_date', label: 'Open date', defaultChecked: true },
  { key: 'pending_date', label: 'Pending date', defaultChecked: false },
  { key: 'close_date', label: 'Closed date', defaultChecked: false },
  { key: 'limitations_date', label: 'Limitations date', defaultChecked: false },
  { key: 'billable', label: 'Billable', defaultChecked: true },
  { key: 'custom_rates', label: 'Custom Rates', defaultChecked: false },
  { key: 'maildrop_address', label: 'Maildrop address', defaultChecked: true }
]

function generalDetailsCheckboxesHtml(): string {
  return MATTER_GENERAL_DETAIL_OPTIONS.map(
    (o) =>
      `<label class="rr-cf-field-row mat-gd-row"><input type="checkbox" class="mat-gd-cb" data-gd-key="${o.key}" ${
        o.defaultChecked ? 'checked' : ''
      } /><span class="rr-cf-field-name">${escapeHtml(o.label)}</span></label>`
  ).join('')
}

function getSelectedGeneralDetailKeys(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('.mat-gd-cb:checked'))
    .map((cb) => cb.dataset.gdKey ?? '')
    .filter((k) => k.length > 0)
}

function formatTableCellValue(v: unknown): string {
  if (v == null) {
    return ''
  }
  if (typeof v === 'object') {
    return JSON.stringify(v)
  }
  return String(v)
}

function nameFromUserLike(v: unknown): string {
  if (v == null || typeof v !== 'object') {
    return ''
  }
  const n = (v as { name?: unknown }).name
  return n != null ? String(n).trim() : ''
}

function formatResponsibleStaffForTable(v: unknown): string {
  if (v == null) {
    return ''
  }
  if (Array.isArray(v)) {
    return v.map(nameFromUserLike).filter((s) => s.length > 0).join(', ')
  }
  return nameFromUserLike(v)
}

/** `name - category`; if category is null/empty, show name only. */
function formatPracticeAreaForTable(v: unknown): string {
  if (v == null || typeof v !== 'object') {
    return formatTableCellValue(v)
  }
  const o = v as { name?: unknown; category?: unknown }
  const name = o.name != null ? String(o.name).trim() : ''
  const cat = o.category
  const catStr = cat != null && String(cat).trim() !== '' ? String(cat).trim() : ''
  if (catStr.length > 0) {
    return `${name} - ${catStr}`
  }
  return name
}

/** Rates in one cell, separated by `'; '` — `{type} - {user name} - {rate}` each (from matter.custom_rate). */
function formatCustomRatesForTable(v: unknown): string {
  if (v == null || typeof v !== 'object') {
    return ''
  }
  const o = v as { type?: unknown; rates?: unknown }
  const typeStr = o.type != null ? String(o.type).trim() : ''
  const rates = o.rates
  if (!Array.isArray(rates) || rates.length === 0) {
    return typeStr
  }
  const lines: string[] = []
  for (const r of rates) {
    if (r == null || typeof r !== 'object') continue
    const row = r as { rate?: unknown; user?: unknown }
    const rateVal = row.rate
    let userName = ''
    const u = row.user
    if (u != null && typeof u === 'object' && 'name' in u) {
      userName = String((u as { name: unknown }).name).trim()
    }
    const rateNum = rateVal != null ? String(rateVal).trim() : ''
    lines.push(`${typeStr} - ${userName} - ${rateNum}`)
  }
  return lines.filter((line) => line.trim().length > 0).join('; ')
}

function formatGeneralDetailCellForTable(detailKey: string, raw: unknown): string {
  switch (detailKey) {
    case 'responsible_attorney':
    case 'originating_attorney':
      return nameFromUserLike(raw)
    case 'responsible_staff':
      return formatResponsibleStaffForTable(raw)
    case 'practice_area':
      return formatPracticeAreaForTable(raw)
    case 'custom_rates':
      return formatCustomRatesForTable(raw)
    default:
      return formatTableCellValue(raw)
  }
}

function buildMattersGeneralDetailsTablePayload(
  matters: unknown[],
  detailKeys: string[]
): { columns: Array<{ key: string; label: string }>; records: Record<string, unknown>[] } {
  const labelByKey = new Map(MATTER_GENERAL_DETAIL_OPTIONS.map((o) => [o.key, o.label]))
  const columns = [
    { key: 'display_number', label: 'Matter ID' },
    ...detailKeys.map((k) => ({
      key: `gd_${k}`,
      label: labelByKey.get(k) ?? k
    }))
  ]
  const records = matters.map((raw) => {
    const m = raw as Record<string, unknown>
    const row: Record<string, unknown> = {
      clio_matter_id: m.id ?? '',
      display_number: m.display_number ?? ''
    }
    for (const dk of detailKeys) {
      const prop = MATTER_DETAIL_RESPONSE_PROP[dk] ?? dk
      row[`gd_${dk}`] = formatGeneralDetailCellForTable(dk, m[prop])
    }
    return row
  })
  return { columns, records }
}

export function getMattersPageHtml(): string {
  return `
    <div class="page-header">
      <h1 class="page-title">Matters</h1>
      <p class="page-description">Filter by matter status, search by Matter ID (display number), or include all matters.</p>
    </div>
    <div class="matters-page-form custom-fields-page-form">
      <section class="rr-section rr-section--matter" aria-labelledby="mat-section-matter-title">
        <h2 class="rr-section-title" id="mat-section-matter-title">Matter</h2>
        <div class="rr-matter-block" data-mat-matter-field>
          <div class="rr-selected-matters">
            <div class="rr-chips-stack" id="mat-matter-chips" aria-live="polite" aria-label="Selected matters"></div>
          </div>
          <div class="rr-matter-columns rr-matter-columns--split">
            <div class="rr-matter-col rr-matter-col--left">
              <div class="filter-group rr-matter-id-wrap">
                <label class="rr-matter-label" for="mat-matter-input">Matter ID</label>
                <div class="rr-field-wrap">
                  <div class="rr-input-row">
                    <input
                      type="text"
                      class="rr-combo-input"
                      id="mat-matter-input"
                      placeholder="Type at least 4 characters to search…"
                      autocomplete="off"
                      spellcheck="false"
                      aria-autocomplete="list"
                      aria-controls="mat-matter-suggestions"
                      aria-expanded="false"
                    />
                  </div>
                  <ul class="rr-suggestions" id="mat-matter-suggestions" role="listbox" hidden></ul>
                </div>
              </div>
              <div class="rr-all-matters-row">
                <label class="rr-all-matters-label" for="mat-all-matters">
                  <input type="checkbox" id="mat-all-matters" />
                  <span>All Matters</span>
                </label>
              </div>
            </div>
            <div class="rr-matter-col rr-matter-col--right">
              <div class="filter-group rr-matter-status-wrap">
                <label for="mat-matter-status">Matter Status</label>
                <select id="mat-matter-status">${MATTER_STATUS_OPTIONS_HTML}</select>
              </div>
              <div class="filter-group rr-date-range-group">
                <span class="rr-date-range-group-label">Date Range</span>
                <div class="rr-date-range-field" id="mat-date-range-field">
                  <span class="rr-date-range-display" id="mat-date-range-display" aria-live="polite">—</span>
                  <button
                    type="button"
                    class="rr-date-range-picker-btn"
                    id="mat-date-range-btn"
                    aria-expanded="false"
                    aria-controls="mat-date-range-popover"
                    title="Choose date range"
                    disabled
                  >
                    <span class="rr-date-range-picker-icon" aria-hidden="true">&#128197;</span>
                    <span class="visually-hidden">Open date range picker</span>
                  </button>
                  <div
                    class="rr-date-range-popover"
                    id="mat-date-range-popover"
                    hidden
                    role="dialog"
                    aria-label="Choose date range"
                  >
                    <div class="rr-date-range-popover-inner">
                      <div class="rr-date-range-popover-dates">
                        <label class="rr-date-range-popover-label">
                          <span>Start</span>
                          <input type="date" id="mat-date-start" class="rr-date-input rr-date-input--popover" disabled />
                        </label>
                        <label class="rr-date-range-popover-label">
                          <span>End</span>
                          <input type="date" id="mat-date-end" class="rr-date-input rr-date-input--popover" disabled />
                        </label>
                      </div>
                      <div class="rr-date-range-popover-actions">
                        <button type="button" class="button rr-date-range-action-btn" id="mat-date-range-apply" disabled>
                          Apply
                        </button>
                        <button type="button" class="button secondary rr-date-range-action-btn" id="mat-date-range-clear" disabled>
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="rr-hint">Search by matter display ID. Choose from the list or press Enter. Add more using the same field.</p>
          <div class="rr-status" id="mat-matter-input-status" aria-live="polite"></div>
        </div>
      </section>

      <section class="rr-section rr-section--general-details" aria-labelledby="mat-section-gd-title">
        <h2 class="rr-section-title" id="mat-section-gd-title">General Details</h2>
        <p class="rr-cf-all-hint" style="margin-top:0;margin-bottom:12px">
          Choose which matter fields to load. Only selected fields are requested from Clio.
        </p>
        <div id="mat-general-details-panel" class="rr-custom-fields-panel" role="group" aria-label="General matter fields">
          ${generalDetailsCheckboxesHtml()}
        </div>
      </section>

      <div class="form-actions rr-compile-actions">
        <button type="button" id="mat-fetch-records-btn" class="button">Fetch records</button>
        <span class="rr-compile-fetch-status" id="mat-fetch-status" aria-live="polite"></span>
        <button type="button" id="mat-open-table-btn" class="button" hidden>
          Open table
        </button>
      </div>
    </div>
  `
}

function getElements(): Elements | null {
  const input = document.getElementById('mat-matter-input') as HTMLInputElement | null
  const suggestions = document.getElementById('mat-matter-suggestions') as HTMLUListElement | null
  const chips = document.getElementById('mat-matter-chips') as HTMLDivElement | null
  const status = document.getElementById('mat-matter-input-status')
  const block = document.querySelector('[data-mat-matter-field]') as HTMLElement | null
  if (!input || !suggestions || !chips || !status || !block) return null
  return { input, suggestions, chips, status, block }
}

function setStatus(el: HTMLElement, message: string, kind: 'idle' | 'loading' | 'error'): void {
  el.textContent = message
  el.className =
    'rr-status' +
    (kind === 'error' ? ' rr-status--error' : kind === 'loading' ? ' rr-status--loading' : '')
}

function hideSuggestions(els: Elements, state: UiState): void {
  els.suggestions.hidden = true
  els.suggestions.innerHTML = ''
  els.input.setAttribute('aria-expanded', 'false')
  state.suggestions = []
  state.activeIndex = -1
}

function renderSuggestions(
  els: Elements,
  state: UiState,
  rows: MatterPickerRow[],
  onPick: (row: MatterPickerRow) => void
): void {
  state.suggestions = rows
  state.activeIndex = rows.length > 0 ? 0 : -1
  els.suggestions.innerHTML = ''
  if (rows.length === 0) {
    els.suggestions.hidden = true
    els.input.setAttribute('aria-expanded', 'false')
    return
  }
  rows.forEach((row, i) => {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rr-suggestion' + (i === 0 ? ' rr-suggestion--active' : '')
    btn.setAttribute('role', 'option')
    const name = row.description?.trim() || '(No name)'
    btn.innerHTML = `<span class="rr-suggestion-id">${escapeHtml(row.display_number)}</span><span class="rr-suggestion-name">${escapeHtml(name)}</span>`
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      onPick(row)
    })
    li.appendChild(btn)
    els.suggestions.appendChild(li)
  })
  els.suggestions.hidden = false
  els.input.setAttribute('aria-expanded', 'true')
}

function highlightActive(els: Elements, state: UiState): void {
  const buttons = els.suggestions.querySelectorAll('.rr-suggestion')
  buttons.forEach((b, i) => {
    b.classList.toggle('rr-suggestion--active', i === state.activeIndex)
  })
}

function renderChipRow(els: Elements, state: UiState): void {
  els.chips.innerHTML = ''
  for (const row of state.selected) {
    const wrap = document.createElement('span')
    wrap.className = 'rr-chip'
    wrap.setAttribute('data-matter-id', String(row.id))

    const idSpan = document.createElement('span')
    idSpan.className = 'rr-chip-id'
    idSpan.textContent = row.display_number

    const name = row.description?.trim() || '(No name)'
    const nameSpan = document.createElement('span')
    nameSpan.className = 'rr-chip-name'
    nameSpan.title = name
    nameSpan.textContent = name

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'rr-chip-remove'
    removeBtn.setAttribute('aria-label', `Remove matter ${row.display_number}`)
    removeBtn.innerHTML = '&times;'
    const matterId = row.id
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      state.selected = state.selected.filter((m) => m.id !== matterId)
      renderChipRow(els, state)
      setStatus(els.status, '', 'idle')
    })

    wrap.appendChild(idSpan)
    wrap.appendChild(nameSpan)
    wrap.appendChild(removeBtn)
    els.chips.appendChild(wrap)
  }
}

export function setupMattersPage(): void {
  const els = getElements()
  if (!els) return

  matterStatusEl = document.getElementById('mat-matter-status') as HTMLSelectElement | null
  allMattersEl = document.getElementById('mat-all-matters') as HTMLInputElement | null
  if (!matterStatusEl || !allMattersEl) return

  const state: UiState = {
    suggestions: [],
    activeIndex: -1,
    debounce: null,
    loading: false,
    selected: []
  }

  const pickMatter = (row: MatterPickerRow): void => {
    if (state.selected.some((m) => m.id === row.id)) {
      setStatus(els.status, 'This matter is already added.', 'error')
      return
    }
    setStatus(els.status, '', 'idle')
    state.selected.push(row)
    renderChipRow(els, state)
    els.input.value = ''
    hideSuggestions(els, state)
  }

  const runSearch = async (raw: string): Promise<void> => {
    const q = raw.trim()
    if (q.length < 4) {
      hideSuggestions(els, state)
      setStatus(els.status, '', 'idle')
      return
    }
    state.loading = true
    setStatus(els.status, 'Searching…', 'loading')
    try {
      const { data, error } = await window.api.clio.getMattersByDisplayId(q)
      if (error) {
        setStatus(els.status, error, 'error')
        hideSuggestions(els, state)
        return
      }
      setStatus(els.status, data.length === 0 ? 'No matters found.' : '', 'idle')
      renderSuggestions(els, state, data, pickMatter)
    } catch (e) {
      setStatus(els.status, e instanceof Error ? e.message : 'Search failed', 'error')
      hideSuggestions(els, state)
    } finally {
      state.loading = false
    }
  }

  const scheduleSearch = (): void => {
    if (state.debounce) clearTimeout(state.debounce)
    const v = els.input.value
    if (v.trim().length < 4) {
      hideSuggestions(els, state)
      setStatus(els.status, '', 'idle')
      return
    }
    state.debounce = setTimeout(() => {
      void runSearch(v)
    }, DEBOUNCE_MS)
  }

  const selectFromKeyboard = (): void => {
    const rows = state.suggestions
    if (rows.length === 0) return
    let idx = state.activeIndex >= 0 ? state.activeIndex : 0
    if (idx < 0 || idx >= rows.length) idx = 0
    const exact = els.input.value.trim()
    const byExact = rows.find((r) => String(r.display_number) === exact)
    pickMatter(byExact ?? rows[idx]!)
  }

  els.input.addEventListener('input', () => {
    scheduleSearch()
  })

  els.input.addEventListener('keydown', (e) => {
    if (!els.suggestions.hidden && state.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        state.activeIndex = Math.min(state.activeIndex + 1, state.suggestions.length - 1)
        highlightActive(els, state)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        state.activeIndex = Math.max(state.activeIndex - 1, 0)
        highlightActive(els, state)
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (els.input.value.trim().length < 4) return
      if (state.suggestions.length > 0) {
        selectFromKeyboard()
      } else {
        void runSearch(els.input.value).then(() => {
          if (state.suggestions.length > 0) selectFromKeyboard()
        })
      }
      return
    }
    if (e.key === 'Escape') {
      hideSuggestions(els, state)
    }
  })

  els.input.addEventListener('blur', () => {
    setTimeout(() => {
      if (els.block.contains(document.activeElement)) return
      hideSuggestions(els, state)
    }, 150)
  })

  const applyAllMattersMode = (allMatters: boolean): void => {
    els.input.disabled = allMatters
    if (allMatters) {
      if (state.debounce) {
        clearTimeout(state.debounce)
        state.debounce = null
      }
      els.input.value = ''
      hideSuggestions(els, state)
      setStatus(els.status, '', 'idle')
      state.selected = []
      renderChipRow(els, state)
    }
  }

  allMattersEl.addEventListener('change', () => {
    applyAllMattersMode(allMattersEl!.checked)
  })

  setupMatterDateRangePicker({
    fieldWrapId: 'mat-date-range-field',
    displayId: 'mat-date-range-display',
    openBtnId: 'mat-date-range-btn',
    popoverId: 'mat-date-range-popover',
    startInputId: 'mat-date-start',
    endInputId: 'mat-date-end',
    applyBtnId: 'mat-date-range-apply',
    clearBtnId: 'mat-date-range-clear',
    matterStatusSelectId: 'mat-matter-status',
    allMattersCheckboxId: 'mat-all-matters'
  })

  const matFetchBtn = document.getElementById('mat-fetch-records-btn') as HTMLButtonElement | null
  const matFetchStatusEl = document.getElementById('mat-fetch-status')
  const matOpenTableBtn = document.getElementById('mat-open-table-btn') as HTMLButtonElement | null

  let lastFetchedMatters: unknown[] = []
  let lastFetchedDetailKeys: string[] = []

  const syncOpenTableButtonVisibility = (): void => {
    if (matOpenTableBtn) {
      matOpenTableBtn.hidden = lastFetchedMatters.length === 0
    }
  }

  syncOpenTableButtonVisibility()

  matFetchBtn?.addEventListener('click', () => {
    void (async () => {
      const allMatters = allMattersEl!.checked
      const detailKeys = getSelectedGeneralDetailKeys()

      if (detailKeys.length === 0) {
        if (matFetchStatusEl) {
          matFetchStatusEl.textContent = 'Select at least one general detail field.'
          matFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (!allMatters && state.selected.length === 0) {
        if (matFetchStatusEl) {
          matFetchStatusEl.textContent = 'Add at least one matter or choose All Matters.'
          matFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      lastFetchedMatters = []
      lastFetchedDetailKeys = []
      syncOpenTableButtonVisibility()

      if (matFetchStatusEl) {
        matFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
        matFetchStatusEl.textContent = 'Fetching…'
      }
      if (matFetchBtn) matFetchBtn.disabled = true

      const matterStatusTrimmed = matterStatusEl!.value.trim()
      const matterStatus = matterStatusTrimmed !== '' ? matterStatusTrimmed : undefined

      const dateRangeActive = shouldEnableMatterDateRangeFilters(matterStatusTrimmed, allMatters)
      const matDateStart = document.getElementById('mat-date-start') as HTMLInputElement | null
      const matDateEnd = document.getElementById('mat-date-end') as HTMLInputElement | null
      const openDateAfter = dateRangeActive && matDateStart?.value ? matDateStart.value : undefined
      const openDateBefore = dateRangeActive && matDateEnd?.value ? matDateEnd.value : undefined

      try {
        const result = await window.api.clio.fetchMatterGeneralDetails({
          allMatters,
          matterDisplayNumbers: state.selected.map((m) => m.display_number),
          matterStatus,
          detailKeys,
          openDateAfter,
          openDateBefore
        })

        console.log('Matters — general details', {
          matterStatus: matterStatus ?? null,
          allMatters,
          matters: state.selected,
          detailKeys,
          recordCount: result.recordCount,
          error: result.error,
          data: result.data
        })

        if (result.error) {
          if (matFetchStatusEl) {
            matFetchStatusEl.textContent = result.error
            matFetchStatusEl.classList.add('rr-compile-fetch-status--error')
          }
          return
        }

        lastFetchedMatters = Array.isArray(result.data) ? result.data : []
        lastFetchedDetailKeys = detailKeys

        if (matFetchStatusEl) {
          matFetchStatusEl.textContent = `No. of records fetched: ${result.recordCount}`
          matFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
        }
        syncOpenTableButtonVisibility()
      } catch (e) {
        if (matFetchStatusEl) {
          matFetchStatusEl.textContent = e instanceof Error ? e.message : 'Request failed'
          matFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
      } finally {
        if (matFetchBtn) matFetchBtn.disabled = false
      }
    })()
  })

  matOpenTableBtn?.addEventListener('click', () => {
    if (lastFetchedMatters.length === 0 || lastFetchedDetailKeys.length === 0) {
      return
    }
    const { columns, records } = buildMattersGeneralDetailsTablePayload(
      lastFetchedMatters,
      lastFetchedDetailKeys
    )
    void window.api.openTableResults({
      title: 'Matters — General details',
      columns,
      records,
      csvBaseName: 'matters-general-details'
    })
  })
}
