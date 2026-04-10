export type MatterPickerRow = {
  id: number
  display_number: string
  description: string | null
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

export function getRevenueReportPageHtml(): string {
  return `
    <div class="page-header">
      <h1 class="page-title">Revenue Report</h1>
      <p class="page-description">Add one or more matters by display ID.</p>
    </div>
    <div class="revenue-report-form">
      <div class="rr-matter-block" data-rr-matter-field>
        <label class="rr-matter-label" for="rr-matter-input">Matter ID</label>
        <div class="rr-chips-stack" id="rr-matter-chips" aria-live="polite"></div>
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
        <div class="form-actions rr-compile-actions">
          <button type="button" id="rr-compile-report-btn" class="button">Compile Report</button>
        </div>
        <p class="rr-hint">Search by matter display ID. Choose from the list or press Enter. Add more using the same field.</p>
        <div class="rr-status" id="rr-matter-status" aria-live="polite"></div>
      </div>
    </div>
  `
}

function getElements(): Elements | null {
  const input = document.getElementById('rr-matter-input') as HTMLInputElement | null
  const suggestions = document.getElementById('rr-matter-suggestions') as HTMLUListElement | null
  const chips = document.getElementById('rr-matter-chips') as HTMLDivElement | null
  const status = document.getElementById('rr-matter-status')
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

export function setupRevenueReportPage(): void {
  const els = getElements()
  if (!els) return

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

  document.getElementById('rr-compile-report-btn')?.addEventListener('click', () => {
    console.log('Compile Report', { matters: state.selected })
  })
}
