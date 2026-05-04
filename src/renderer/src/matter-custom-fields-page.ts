import { setupMatterDateRangePicker } from './matter-date-range-ui'
import { MATTER_STATUS_OPTIONS_HTML, shouldEnableMatterDateRangeFilters, type MatterPickerRow } from './matters-selection-shared'
import { buildMatterGeneralDetailsCheckboxesHtml } from './matter-general-details-shared'
import {
  getCustomFieldsPicklistSectionHtml,
  getCustomFieldsPicklistSelection,
  resolveCustomFieldClioIdsForRequest,
  setupCustomFieldsPicklistSection,
  type CustomFieldsPageSelection,
  type CustomFieldsPicklistDomIds
} from './custom-fields-page'
import { buildMatterCombinedTablePayload } from './matter-combined-table'

const MCF_CF_PICKLIST_IDS: CustomFieldsPicklistDomIds = {
  scopeSelectId: 'mcf-custom-fields-scope',
  checkboxesContainerId: 'mcf-custom-fields-checkboxes',
  selectAllCheckboxId: 'mcf-cf-select-all'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getElements(): Elements | null {
  const input = document.getElementById('mcf-matter-input') as HTMLInputElement | null
  const suggestions = document.getElementById('mcf-matter-suggestions') as HTMLUListElement | null
  const chips = document.getElementById('mcf-matter-chips') as HTMLDivElement | null
  const status = document.getElementById('mcf-matter-input-status')
  const block = document.querySelector('[data-mcf-matter-field]') as HTMLElement | null
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

function mcfGeneralDetailsCheckboxesHtml(): string {
  return buildMatterGeneralDetailsCheckboxesHtml(escapeHtml, {
    checkboxClass: 'mcf-gd-cb',
    rowClass: 'mcf-gd-row'
  })
}

/** Selected general-detail API keys (matches Matters page semantics). */
export function getSelectedMcfGeneralDetailKeys(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('#mcf-general-details-panel .mcf-gd-cb:checked'))
    .map((cb) => cb.dataset.gdKey ?? '')
    .filter((k) => k.length > 0)
}

/** Custom Fields picklist selection on this page (Include / specific checkboxes). */
export function getSelectedMcfCustomFieldsPicklist(): CustomFieldsPageSelection {
  return getCustomFieldsPicklistSelection(MCF_CF_PICKLIST_IDS)
}

export function getMatterCustomFieldsPageHtml(): string {
  return `
    <div class="page-header">
      <h1 class="page-title">Matter+Custom Fields</h1>
      <p class="page-description">Choose matters, general detail fields, and custom fields — same controls as the Matters and Custom Fields pages. Fetch actions will be wired next.</p>
    </div>
    <div class="custom-fields-page-form">
      <section class="rr-section rr-section--matter" aria-labelledby="mcf-section-matter-title">
        <h2 class="rr-section-title" id="mcf-section-matter-title">Matter</h2>
        <div class="rr-matter-block" data-mcf-matter-field>
          <div class="rr-selected-matters">
            <div class="rr-chips-stack" id="mcf-matter-chips" aria-live="polite" aria-label="Selected matters"></div>
          </div>
          <div class="rr-matter-columns rr-matter-columns--split">
            <div class="rr-matter-col rr-matter-col--left">
              <div class="filter-group rr-matter-id-wrap">
                <label class="rr-matter-label" for="mcf-matter-input">Matter ID</label>
                <div class="rr-field-wrap">
                  <div class="rr-input-row">
                    <input
                      type="text"
                      class="rr-combo-input"
                      id="mcf-matter-input"
                      placeholder="Type at least 4 characters to search…"
                      autocomplete="off"
                      spellcheck="false"
                      aria-autocomplete="list"
                      aria-controls="mcf-matter-suggestions"
                      aria-expanded="false"
                    />
                  </div>
                  <ul class="rr-suggestions" id="mcf-matter-suggestions" role="listbox" hidden></ul>
                </div>
              </div>
              <div class="rr-all-matters-row">
                <label class="rr-all-matters-label" for="mcf-all-matters">
                  <input type="checkbox" id="mcf-all-matters" />
                  <span>All Matters</span>
                </label>
              </div>
            </div>
            <div class="rr-matter-col rr-matter-col--right">
              <div class="filter-group rr-matter-status-wrap">
                <label for="mcf-matter-status">Matter Status</label>
                <select id="mcf-matter-status">${MATTER_STATUS_OPTIONS_HTML}</select>
              </div>
              <div class="filter-group rr-date-range-group">
                <span class="rr-date-range-group-label">Date Range</span>
                <div class="rr-date-range-field" id="mcf-date-range-field">
                  <span class="rr-date-range-display" id="mcf-date-range-display" aria-live="polite">—</span>
                  <button
                    type="button"
                    class="rr-date-range-picker-btn"
                    id="mcf-date-range-btn"
                    aria-expanded="false"
                    aria-controls="mcf-date-range-popover"
                    title="Choose date range"
                    disabled
                  >
                    <span class="rr-date-range-picker-icon" aria-hidden="true">&#128197;</span>
                    <span class="visually-hidden">Open date range picker</span>
                  </button>
                  <div
                    class="rr-date-range-popover"
                    id="mcf-date-range-popover"
                    hidden
                    role="dialog"
                    aria-label="Choose date range"
                  >
                    <div class="rr-date-range-popover-inner">
                      <div class="rr-date-range-popover-dates">
                        <label class="rr-date-range-popover-label">
                          <span>Start</span>
                          <input type="date" id="mcf-date-start" class="rr-date-input rr-date-input--popover" disabled />
                        </label>
                        <label class="rr-date-range-popover-label">
                          <span>End</span>
                          <input type="date" id="mcf-date-end" class="rr-date-input rr-date-input--popover" disabled />
                        </label>
                      </div>
                      <div class="rr-date-range-popover-actions">
                        <button type="button" class="button rr-date-range-action-btn" id="mcf-date-range-apply" disabled>
                          Apply
                        </button>
                        <button type="button" class="button secondary rr-date-range-action-btn" id="mcf-date-range-clear" disabled>
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
          <div class="rr-status" id="mcf-matter-input-status" aria-live="polite"></div>
        </div>
      </section>

      <section class="rr-section rr-section--general-details" aria-labelledby="mcf-section-gd-title">
        <h2 class="rr-section-title" id="mcf-section-gd-title">General Details</h2>
        <p class="rr-cf-all-hint" style="margin-top:0;margin-bottom:12px">
          Choose which matter fields to load. Only selected fields are requested from Clio.
        </p>
        <div id="mcf-general-details-panel" class="rr-custom-fields-panel" role="group" aria-label="General matter fields">
          ${mcfGeneralDetailsCheckboxesHtml()}
        </div>
      </section>

      ${getCustomFieldsPicklistSectionHtml({
        sectionAriaLabelledBy: 'mcf-section-cf-title',
        sectionTitleId: 'mcf-section-cf-title',
        scopeSelectId: 'mcf-custom-fields-scope',
        panelId: 'mcf-custom-fields-panel',
        selectAllId: 'mcf-cf-select-all',
        checkboxesId: 'mcf-custom-fields-checkboxes',
        hintId: 'mcf-cf-all-hint'
      })}

      <div class="form-actions rr-compile-actions">
        <button type="button" id="mcf-fetch-records-btn" class="button">Fetch records</button>
        <span class="rr-compile-fetch-status" id="mcf-fetch-status" aria-live="polite"></span>
        <button type="button" id="mcf-open-table-btn" class="button" hidden>
          Open table
        </button>
      </div>
    </div>
  `
}

export function setupMatterCustomFieldsPage(): void {
  const els = getElements()
  const matterStatusEl = document.getElementById('mcf-matter-status') as HTMLSelectElement | null
  const allMattersEl = document.getElementById('mcf-all-matters') as HTMLInputElement | null
  if (!els || !matterStatusEl || !allMattersEl) return

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

  setupMatterDateRangePicker({
    fieldWrapId: 'mcf-date-range-field',
    displayId: 'mcf-date-range-display',
    openBtnId: 'mcf-date-range-btn',
    popoverId: 'mcf-date-range-popover',
    startInputId: 'mcf-date-start',
    endInputId: 'mcf-date-end',
    applyBtnId: 'mcf-date-range-apply',
    clearBtnId: 'mcf-date-range-clear',
    matterStatusSelectId: 'mcf-matter-status',
    allMattersCheckboxId: 'mcf-all-matters'
  })

  setupCustomFieldsPicklistSection(MCF_CF_PICKLIST_IDS)

  const mcfFetchBtn = document.getElementById('mcf-fetch-records-btn') as HTMLButtonElement | null
  const mcfFetchStatusEl = document.getElementById('mcf-fetch-status')
  const mcfOpenTableBtn = document.getElementById('mcf-open-table-btn') as HTMLButtonElement | null

  let lastFetchedMatters: unknown[] = []
  let lastDetailKeys: string[] = []
  let lastCustomFieldIds: number[] = []

  const syncOpenTableBtn = (): void => {
    if (mcfOpenTableBtn) {
      mcfOpenTableBtn.hidden = lastFetchedMatters.length === 0
    }
  }
  syncOpenTableBtn()

  mcfFetchBtn?.addEventListener('click', () => {
    void (async () => {
      const detailKeys = getSelectedMcfGeneralDetailKeys()
      const cfSel = getSelectedMcfCustomFieldsPicklist()
      const customFieldIds = resolveCustomFieldClioIdsForRequest(cfSel)
      const allMatters = allMattersEl.checked

      if (detailKeys.length === 0) {
        if (mcfFetchStatusEl) {
          mcfFetchStatusEl.textContent = 'Select at least one general detail field.'
          mcfFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (cfSel.mode === 'specific' && customFieldIds.length === 0) {
        if (mcfFetchStatusEl) {
          mcfFetchStatusEl.textContent = 'Select at least one custom field with a Clio id.'
          mcfFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (!allMatters && state.selected.length === 0) {
        if (mcfFetchStatusEl) {
          mcfFetchStatusEl.textContent = 'Add at least one matter or choose All Matters.'
          mcfFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      lastFetchedMatters = []
      lastDetailKeys = []
      lastCustomFieldIds = []
      syncOpenTableBtn()

      if (mcfFetchStatusEl) {
        mcfFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
        mcfFetchStatusEl.textContent = ''
      }
      if (mcfFetchBtn) mcfFetchBtn.disabled = true

      const matterStatusTrimmed = matterStatusEl.value.trim()
      const matterStatus = matterStatusTrimmed !== '' ? matterStatusTrimmed : undefined

      const dateRangeActive = shouldEnableMatterDateRangeFilters(matterStatusTrimmed, allMatters)
      const mcfDateStart = document.getElementById('mcf-date-start') as HTMLInputElement | null
      const mcfDateEnd = document.getElementById('mcf-date-end') as HTMLInputElement | null
      const openDateAfter = dateRangeActive && mcfDateStart?.value ? mcfDateStart.value : undefined
      const openDateBefore = dateRangeActive && mcfDateEnd?.value ? mcfDateEnd.value : undefined

      try {
        const result = await window.api.clio.fetchMatterCombinedReport({
          allMatters,
          matterDisplayNumbers: state.selected.map((m) => m.display_number),
          matterStatus,
          detailKeys,
          customFieldIds,
          openDateAfter,
          openDateBefore
        })

        if (result.error) {
          if (mcfFetchStatusEl) {
            mcfFetchStatusEl.textContent = result.error
            mcfFetchStatusEl.classList.add('rr-compile-fetch-status--error')
          }
          return
        }

        lastFetchedMatters = Array.isArray(result.data) ? result.data : []
        lastDetailKeys = detailKeys
        lastCustomFieldIds = customFieldIds

        if (mcfFetchStatusEl) {
          mcfFetchStatusEl.textContent = `No. of records fetched: ${result.recordCount}`
          mcfFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
        }
        syncOpenTableBtn()
      } catch (e) {
        if (mcfFetchStatusEl) {
          mcfFetchStatusEl.textContent = e instanceof Error ? e.message : 'Request failed'
          mcfFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
      } finally {
        if (mcfFetchBtn) mcfFetchBtn.disabled = false
      }
    })()
  })

  mcfOpenTableBtn?.addEventListener('click', () => {
    if (lastFetchedMatters.length === 0) return
    const { columns, records } = buildMatterCombinedTablePayload(
      lastFetchedMatters,
      lastDetailKeys,
      lastCustomFieldIds
    )
    void window.api.openTableResults({
      title: 'Matter + Custom Fields',
      columns,
      records,
      csvBaseName: 'matter-custom-fields'
    })
  })
}
