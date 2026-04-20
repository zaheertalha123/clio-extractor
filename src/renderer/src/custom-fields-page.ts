import { resolvePicklistOptionLabel } from './custom-fields-picklist-maps'

export type MatterPickerRow = {
  id: number
  display_number: string
  description: string | null
}

export type CustomFieldsPageSelection =
  | { mode: 'all' }
  | {
      mode: 'specific'
      /** Clio `custom_fields` ids for checked rows that have a mapped id */
      fieldIds: number[]
      /** Checked rows with optional Clio id (not rendered; for IPC / logging) */
      checkedFields: Array<{ name: string; clioFieldId: number | null }>
    }

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

/**
 * Clio API `custom_fields` id by field `name` (Matter). Not shown in the UI; used for IPC / reporting.
 * Synced with firm Matter custom fields (display_order 0–41). Only `AR_Notes` has no id in the API export yet.
 */
const MATTER_CUSTOM_FIELD_CLIO_IDS: Partial<Record<string, number>> = {
  MUID: 14739007,
  Managing: 14739022,
  MatterType: 14739037,
  MatterID: 14739052,
  'Bill Cycle': 14760022,
  'Billing Notes': 14935537,
  Billing_Frequency: 14935582,
  'BIll Theme': 15012907,
  'Conflict Check Performed': 15122212,
  'Originator 1 %': 15306307,
  'Originating Attorney 2': 15306352,
  'Originator 2 %': 15306367,
  'Responsible 1 %': 15306382,
  'Responsible Attorney 2': 15306667,
  'Responsible 2 %': 15306682,
  'Payment Plan': 15328957,
  '366': 15328972,
  '60+ Day Past Due Exempt': 15328987,
  'Client First and Last Name': 15917498,
  'Case Number': 15918383,
  'Opposing Party Contact': 15918413,
  'Orig Atty 1': 16190498,
  'Orig Atty 2': 16190513,
  'Resp Atty 1': 16190528,
  'Resp Atty 2': 16190543,
  'End Date 1': 16190558,
  'Orig.Atty 1': 16190588,
  'Orig.Atty 2': 16190618,
  'Resp.Atty 1': 16190633,
  'Resp.Atty 2': 16190648,
  'End Date 2': 16190663,
  'Orig.Atty. 1': 16190708,
  'Orig.Atty. 2': 16190723,
  'Resp.Atty. 1': 16190738,
  'Resp.Atty. 2': 16190753,
  'End Date 3': 16190768,
  'Office Location': 16729658,
  Referrer: 17148323,
  'Referral Percentage': 17148338,
  '366 Start Date': 17430983,
  'Payment Plan Start Date': 17430998
}

function clioCustomFieldIdForName(name: string): number | null {
  const id = MATTER_CUSTOM_FIELD_CLIO_IDS[name]
  return id !== undefined ? id : null
}

/**
 * Full set of matter custom field display names (Clio). Order matches the firm’s field list.
 */
const MATTER_CUSTOM_FIELD_NAMES = [
  'MUID',
  'Managing',
  'MatterType',
  'MatterID',
  'AR_Notes',
  'Bill Cycle',
  'Billing Notes',
  'Billing_Frequency',
  'BIll Theme',
  'Conflict Check Performed',
  'Originator 1 %',
  'Originating Attorney 2',
  'Originator 2 %',
  'Responsible 1 %',
  'Responsible Attorney 2',
  'Responsible 2 %',
  'Payment Plan',
  '366',
  '60+ Day Past Due Exempt',
  'Client First and Last Name',
  'Case Number',
  'Opposing Party Contact',
  'Orig Atty 1',
  'Orig Atty 2',
  'Resp Atty 1',
  'Resp Atty 2',
  'End Date 1',
  'Orig.Atty 1',
  'Orig.Atty 2',
  'Resp.Atty 1',
  'Resp.Atty 2',
  'End Date 2',
  'Orig.Atty. 1',
  'Orig.Atty. 2',
  'Resp.Atty. 1',
  'Resp.Atty. 2',
  'End Date 3',
  'Office Location',
  'Referrer',
  'Referral Percentage',
  '366 Start Date',
  'Payment Plan Start Date'
] as const

/** Top block: selected by default in Specific mode */
const CUSTOM_FIELDS_BLOCK1_ORDER = [
  'Bill Cycle',
  'Orig Atty 1',
  'Orig.Atty 1',
  'Orig.Atty. 1',
  'Originator 1 %',
  'Orig Atty 2',
  'Orig.Atty 2',
  'Orig.Atty. 2',
  'Originator 2 %',
  'Resp Atty 1',
  'Resp.Atty 1',
  'Resp.Atty. 1',
  'Responsible 1 %',
  'Resp Atty 2',
  'Resp.Atty 2',
  'Resp.Atty. 2',
  'Responsible 2 %'
] as const

/** Second block: order only, unchecked by default */
const CUSTOM_FIELDS_BLOCK2_ORDER = [
  'Referrer',
  'Referral Percentage',
  'End Date 1',
  'End Date 2',
  'End Date 3',
  'Payment Plan',
  '366',
  '60+ Day Past Due Exempt',
  '366 Start Date',
  'Payment Plan Start Date'
] as const

type RevenueCfFieldRow = {
  name: string
  defaultChecked: boolean
  group: 1 | 2 | 3
  /** Clio custom_field id; null if not in MATTER_CUSTOM_FIELD_CLIO_IDS yet */
  clioFieldId: number | null
}

function buildCustomFieldsPageFieldsOrdered(): RevenueCfFieldRow[] {
  const placed = new Set<string>([...CUSTOM_FIELDS_BLOCK1_ORDER, ...CUSTOM_FIELDS_BLOCK2_ORDER])
  const block3 = MATTER_CUSTOM_FIELD_NAMES.filter((n) => !placed.has(n))
  const merged: RevenueCfFieldRow[] = [
    ...CUSTOM_FIELDS_BLOCK1_ORDER.map((name) => ({
      name,
      defaultChecked: true,
      group: 1 as const,
      clioFieldId: clioCustomFieldIdForName(name)
    })),
    ...CUSTOM_FIELDS_BLOCK2_ORDER.map((name) => ({
      name,
      defaultChecked: false,
      group: 2 as const,
      clioFieldId: clioCustomFieldIdForName(name)
    })),
    ...block3.map((name) => ({
      name,
      defaultChecked: false,
      group: 3 as const,
      clioFieldId: clioCustomFieldIdForName(name)
    }))
  ]
  return merged
}

const PLACEHOLDER_MATTER_CUSTOM_FIELDS: ReadonlyArray<RevenueCfFieldRow> = buildCustomFieldsPageFieldsOrdered()

/** Same options as Firm Revenue → Matter Status */
const MATTER_STATUS_OPTIONS_HTML = [
  '<option value="">All statuses</option>',
  '<option value="Open">Open</option>',
  '<option value="Pending">Pending</option>',
  '<option value="Closed">Closed</option>'
].join('')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getCustomFieldsPageHtml(): string {
  return `
    <div class="page-header">
      <h1 class="page-title">Custom Fields</h1>
      <p class="page-description">Select matters and Matter custom fields, then fetch records.</p>
    </div>
    <div class="custom-fields-page-form">
      <section class="rr-section rr-section--matter" aria-labelledby="rr-section-matter-title">
        <h2 class="rr-section-title" id="rr-section-matter-title">Matter</h2>
        <div class="rr-matter-block" data-rr-matter-field>
          <div class="rr-selected-matters">
            <div class="rr-chips-stack" id="rr-matter-chips" aria-live="polite" aria-label="Selected matters"></div>
          </div>
          <div class="rr-matter-columns">
            <div class="filter-group rr-matter-status-wrap">
              <label for="rr-matter-status">Matter Status</label>
              <select id="rr-matter-status">${MATTER_STATUS_OPTIONS_HTML}</select>
            </div>
            <div class="rr-matter-id-wrap">
              <label class="rr-matter-label" for="rr-matter-input">Matter ID</label>
              <div class="rr-field-wrap">
                <div class="rr-input-row">
                  <input
                    type="text"
                    class="rr-combo-input"
                    id="rr-matter-input"
                    placeholder="Type at least 4 characters to search…"
                    autocomplete="off"
                    spellcheck="false"
                    aria-autocomplete="list"
                    aria-controls="rr-matter-suggestions"
                    aria-expanded="false"
                  />
                </div>
                <ul class="rr-suggestions" id="rr-matter-suggestions" role="listbox" hidden></ul>
              </div>
            </div>
          </div>
          <div class="rr-all-matters-row">
            <label class="rr-all-matters-label" for="rr-all-matters">
              <input type="checkbox" id="rr-all-matters" />
              <span>All Matters</span>
            </label>
          </div>
          <p class="rr-hint">Search by matter display ID. Choose from the list or press Enter. Add more using the same field.</p>
          <div class="rr-status" id="rr-matter-input-status" aria-live="polite"></div>
        </div>
      </section>

      <section class="rr-section rr-section--custom-fields" aria-labelledby="rr-section-cf-title">
        <h2 class="rr-section-title" id="rr-section-cf-title">Custom Fields</h2>
        <div class="filter-group rr-cf-scope-wrap">
          <label for="rr-custom-fields-scope">Include</label>
          <select id="rr-custom-fields-scope" class="rr-custom-fields-scope">
            <option value="all">All</option>
            <option value="specific" selected>Specific fields…</option>
          </select>
        </div>
        <div id="rr-custom-fields-panel" class="rr-custom-fields-panel">
          <label class="rr-cf-select-all">
            <input type="checkbox" id="rr-cf-select-all" />
            <span>Select all</span>
          </label>
          <div
            id="rr-custom-fields-checkboxes"
            class="rr-custom-fields-checkboxes"
            role="group"
            aria-label="Matter custom fields"
          ></div>
        </div>
        <p class="rr-cf-all-hint" id="rr-cf-all-hint">
          Specific fields… is the default: the first group is preselected. All: include every field. Switching back from
          All restores the default selection.
        </p>
      </section>

      <div class="form-actions rr-compile-actions">
        <button type="button" id="rr-fetch-records-btn" class="button">Fetch records</button>
        <span class="rr-compile-fetch-status" id="rr-compile-fetch-status" aria-live="polite"></span>
        <button type="button" id="rr-compile-report-btn" class="button" hidden>
          Open table
        </button>
      </div>
    </div>
  `
}

function getElements(): Elements | null {
  const input = document.getElementById('rr-matter-input') as HTMLInputElement | null
  const suggestions = document.getElementById('rr-matter-suggestions') as HTMLUListElement | null
  const chips = document.getElementById('rr-matter-chips') as HTMLDivElement | null
  const status = document.getElementById('rr-matter-input-status')
  const block = document.querySelector('[data-rr-matter-field]') as HTMLElement | null
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

export function setupCustomFieldsPage(): void {
  const els = getElements()
  if (!els) return

  const allMattersEl = document.getElementById('rr-all-matters') as HTMLInputElement | null
  const matterStatusEl = document.getElementById('rr-matter-status') as HTMLSelectElement | null
  if (!allMattersEl || !matterStatusEl) return

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
    applyAllMattersMode(allMattersEl.checked)
  })

  setupCustomFieldsSection()

  const fetchRecordsBtn = document.getElementById('rr-fetch-records-btn') as HTMLButtonElement | null
  const compileReportBtn = document.getElementById('rr-compile-report-btn') as HTMLButtonElement | null
  const compileFetchStatusEl = document.getElementById('rr-compile-fetch-status')

  let lastFetchedMatters: unknown[] = []
  let lastFetchCustomFieldIds: number[] = []

  const syncCompileReportButtonVisibility = (): void => {
    const hasRecords =
      lastFetchedMatters.length > 0 && lastFetchCustomFieldIds.length > 0
    if (compileReportBtn) {
      compileReportBtn.hidden = !hasRecords
    }
  }

  syncCompileReportButtonVisibility()

  fetchRecordsBtn?.addEventListener('click', () => {
    void (async () => {
      const cfSel = getCustomFieldsSelection()
      const customFieldIds = resolveCustomFieldClioIdsForRequest(cfSel)
      const allMatters = allMattersEl.checked
      const matterDisplayNumbers = state.selected.map((m) => m.display_number)

      console.log('Fetch records (custom fields)', {
        matterStatus: matterStatusEl.value || null,
        matters: state.selected,
        allMatters,
        customFields: cfSel,
        customFieldIds
      })

      lastFetchedMatters = []
      lastFetchCustomFieldIds = []
      syncCompileReportButtonVisibility()

      if (compileFetchStatusEl) {
        compileFetchStatusEl.textContent = ''
        compileFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
      }

      if (customFieldIds.length === 0) {
        if (compileFetchStatusEl) {
          compileFetchStatusEl.textContent = 'Select at least one custom field with a Clio id.'
          compileFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (!allMatters && matterDisplayNumbers.length === 0) {
        if (compileFetchStatusEl) {
          compileFetchStatusEl.textContent = 'Add at least one matter or choose All Matters.'
          compileFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      const matterStatusRaw = matterStatusEl.value?.trim()
      const matterStatus = matterStatusRaw !== '' ? matterStatusRaw : undefined

      fetchRecordsBtn!.disabled = true
      if (compileFetchStatusEl) {
        compileFetchStatusEl.textContent = 'Fetching…'
      }

      try {
        const result = await window.api.clio.fetchCustomFieldsMatterData({
          allMatters,
          matterDisplayNumbers,
          customFieldIds,
          matterStatus
        })
        if (result.error) {
          if (compileFetchStatusEl) {
            compileFetchStatusEl.textContent = result.error
            compileFetchStatusEl.classList.add('rr-compile-fetch-status--error')
          }
          return
        }
        lastFetchedMatters = Array.isArray(result.data) ? result.data : []
        lastFetchCustomFieldIds = customFieldIds
        if (compileFetchStatusEl) {
          compileFetchStatusEl.textContent = `No. of records fetched: ${result.recordCount}`
          compileFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
        }
        syncCompileReportButtonVisibility()
      } catch (e) {
        if (compileFetchStatusEl) {
          compileFetchStatusEl.textContent = e instanceof Error ? e.message : 'Request failed'
          compileFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
      } finally {
        fetchRecordsBtn!.disabled = false
      }
    })()
  })

  compileReportBtn?.addEventListener('click', () => {
    if (lastFetchedMatters.length === 0 || lastFetchCustomFieldIds.length === 0) {
      return
    }
    const { columns, records } = buildCustomFieldsPageTablePayload(lastFetchedMatters, lastFetchCustomFieldIds)
    void window.api.openTableResults({
      title: 'Custom Fields',
      columns,
      records,
      csvBaseName: 'custom-fields'
    })
  })
}

function setupCustomFieldsSection(): void {
  const scopeEl = document.getElementById('rr-custom-fields-scope') as HTMLSelectElement | null
  const containerEl = document.getElementById('rr-custom-fields-checkboxes')
  const selectAllEl = document.getElementById('rr-cf-select-all') as HTMLInputElement | null
  if (!scopeEl || !containerEl || !selectAllEl) return

  const fields = [...PLACEHOLDER_MATTER_CUSTOM_FIELDS]
  let prevGroup: 0 | 1 | 2 | 3 = 0
  for (const f of fields) {
    if (prevGroup !== 0 && f.group !== prevGroup) {
      const divider = document.createElement('div')
      divider.className = 'rr-cf-group-divider'
      divider.setAttribute('role', 'presentation')
      containerEl.appendChild(divider)
    }
    prevGroup = f.group

    const row = document.createElement('label')
    row.className = 'rr-cf-field-row'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'rr-cf-field-cb'
    cb.dataset.cfName = f.name
    if (f.clioFieldId != null) {
      cb.dataset.clioFieldId = String(f.clioFieldId)
    }
    cb.dataset.defaultChecked = f.defaultChecked ? '1' : '0'
    cb.checked = f.defaultChecked
    const span = document.createElement('span')
    span.className = 'rr-cf-field-name'
    span.textContent = f.name
    row.appendChild(cb)
    row.appendChild(span)
    containerEl.appendChild(row)
  }

  const getFieldCheckboxes = (): HTMLInputElement[] =>
    Array.from(containerEl.querySelectorAll<HTMLInputElement>('.rr-cf-field-cb'))

  const syncSelectAll = (): void => {
    const boxes = getFieldCheckboxes()
    const n = boxes.length
    const checked = boxes.filter((b) => b.checked).length
    selectAllEl.checked = n > 0 && checked === n
    selectAllEl.indeterminate = checked > 0 && checked < n
  }

  const applySpecificDefaults = (): void => {
    for (const cb of getFieldCheckboxes()) {
      cb.checked = cb.dataset.defaultChecked === '1'
    }
    syncSelectAll()
  }

  const applyScope = (): void => {
    const all = scopeEl.value === 'all'
    for (const cb of getFieldCheckboxes()) {
      cb.disabled = all
      if (all) cb.checked = true
    }
    selectAllEl.disabled = all
    if (all) {
      selectAllEl.checked = true
      selectAllEl.indeterminate = false
    } else {
      applySpecificDefaults()
    }
  }

  scopeEl.addEventListener('change', applyScope)

  selectAllEl.addEventListener('change', () => {
    if (selectAllEl.disabled) return
    const on = selectAllEl.checked
    for (const cb of getFieldCheckboxes()) cb.checked = on
    selectAllEl.indeterminate = false
  })

  containerEl.addEventListener('change', (e) => {
    const t = e.target as HTMLElement
    if (t instanceof HTMLInputElement && t.classList.contains('rr-cf-field-cb') && !t.disabled)
      syncSelectAll()
  })

  applyScope()
}

function getCustomFieldsSelection(): CustomFieldsPageSelection {
  const scopeEl = document.getElementById('rr-custom-fields-scope') as HTMLSelectElement | null
  const containerEl = document.getElementById('rr-custom-fields-checkboxes')
  if (!scopeEl || !containerEl) {
    return { mode: 'specific', fieldIds: [], checkedFields: [] }
  }
  if (scopeEl.value === 'all') return { mode: 'all' }
  const checkedFields: Array<{ name: string; clioFieldId: number | null }> = []
  for (const cb of containerEl.querySelectorAll<HTMLInputElement>('.rr-cf-field-cb:checked')) {
    const name = cb.dataset.cfName ?? ''
    const raw = cb.dataset.clioFieldId
    let clioFieldId: number | null = null
    if (raw != null && raw !== '') {
      const n = Number(raw)
      clioFieldId = Number.isNaN(n) ? null : n
    }
    checkedFields.push({ name, clioFieldId })
  }
  const fieldIds = checkedFields
    .map((c) => c.clioFieldId)
    .filter((id): id is number => id != null)
  return { mode: 'specific', fieldIds, checkedFields }
}

/** Resolves which Clio custom_field ids to request (all mapped ids vs checked subset). */
function resolveCustomFieldClioIdsForRequest(sel: CustomFieldsPageSelection): number[] {
  if (sel.mode === 'all') {
    const ids = Object.values(MATTER_CUSTOM_FIELD_CLIO_IDS).filter(
      (id): id is number => typeof id === 'number' && Number.isFinite(id)
    )
    return [...new Set(ids)]
  }
  return [...new Set(sel.fieldIds)]
}

type MatterCfValueRow = {
  value?: unknown
  field_name?: string
  custom_field?: { id?: number }
  /** Present for picklist fields from Clio */
  picklist_option?: { id?: number; option?: string }
}

function clioFieldLabelForId(id: number): string {
  for (const [name, val] of Object.entries(MATTER_CUSTOM_FIELD_CLIO_IDS)) {
    if (val === id) {
      return name
    }
  }
  return `Field ${id}`
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

function formatCustomFieldCellDisplay(cfv: MatterCfValueRow): string {
  const po = cfv.picklist_option
  if (po != null && typeof po === 'object') {
    const label = po.option != null ? String(po.option).trim() : ''
    if (label !== '') {
      return label
    }
    const fromId = resolvePicklistOptionLabel(po.id)
    if (fromId != null) {
      return fromId.trim()
    }
  }
  const v = cfv.value
  if (typeof v === 'number' && Number.isFinite(v)) {
    const mapped = resolvePicklistOptionLabel(v)
    if (mapped != null) {
      return mapped.trim()
    }
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const mapped = resolvePicklistOptionLabel(Number(v))
    if (mapped != null) {
      return mapped.trim()
    }
  }
  return formatTableCellValue(v)
}

function findCustomFieldCellValue(cfvs: MatterCfValueRow[], fieldId: number): string {
  if (!Array.isArray(cfvs)) {
    return ''
  }
  for (const cfv of cfvs) {
    const cid = cfv.custom_field?.id
    if (cid != null && Number(cid) === fieldId) {
      return formatCustomFieldCellDisplay(cfv)
    }
  }
  const want = clioFieldLabelForId(fieldId)
  for (const cfv of cfvs) {
    if (String(cfv.field_name ?? '') === want) {
      return formatCustomFieldCellDisplay(cfv)
    }
  }
  return ''
}

function buildCustomFieldsPageTablePayload(
  matters: unknown[],
  customFieldIds: number[]
): { columns: Array<{ key: string; label: string }>; records: Record<string, unknown>[] } {
  /** User-facing "Matter ID" is Clio display #; `clio_matter_id` is the API id for backend use (not shown). */
  const baseCols = [
    { key: 'display_number', label: 'Matter ID' },
    { key: 'status', label: 'Status' }
  ]
  const cfCols = customFieldIds.map((id) => ({
    key: `cf_${id}`,
    label: clioFieldLabelForId(id)
  }))
  const columns = [...baseCols, ...cfCols]

  const records = matters.map((raw) => {
    const m = raw as Record<string, unknown>
    const cfvs = (m.custom_field_values as MatterCfValueRow[] | undefined) ?? []
    const row: Record<string, unknown> = {
      clio_matter_id: m.id ?? '',
      display_number: m.display_number ?? '',
      status: m.status ?? ''
    }
    for (const id of customFieldIds) {
      row[`cf_${id}`] = findCustomFieldCellValue(cfvs, id)
    }
    return row
  })

  return { columns, records }
}
