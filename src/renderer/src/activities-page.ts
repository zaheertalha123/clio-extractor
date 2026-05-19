import { buildActivityFieldCheckboxesHtml } from './activities-fields-shared'
import { buildActivitiesTablePayload } from './activities-table'
import { setupStandaloneDateRangePicker } from './matter-date-range-ui'

export type ActivityTypeFilter = 'both' | 'time_entry' | 'expense'

export interface ActivitiesPageFilters {
  activityType: ActivityTypeFilter
  activityTypeApi?: 'TimeEntry' | 'ExpenseEntry'
  startDate: string
  endDate: string
  fieldKeys: string[]
}

const ACTIVITY_TYPE_OPTIONS_HTML = [
  '<option value="both">Both</option>',
  '<option value="time_entry">Time Entry</option>',
  '<option value="expense">Expense</option>'
].join('')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function activitiesDateRangeHtml(): string {
  return `
    <div class="filter-group rr-date-range-group">
      <span class="rr-date-range-group-label">Date Range</span>
      <div class="rr-date-range-field" id="act-activities-date-range-field">
        <span class="rr-date-range-display" id="act-activities-date-range-display" aria-live="polite">—</span>
        <button
          type="button"
          class="rr-date-range-picker-btn"
          id="act-activities-date-range-btn"
          aria-expanded="false"
          aria-controls="act-activities-date-range-popover"
          title="Choose date range"
        >
          <span class="rr-date-range-picker-icon" aria-hidden="true">&#128197;</span>
          <span class="visually-hidden">Open date range picker</span>
        </button>
        <div
          class="rr-date-range-popover"
          id="act-activities-date-range-popover"
          hidden
          role="dialog"
          aria-label="Choose date range"
        >
          <div class="rr-date-range-popover-inner">
            <div class="rr-date-range-popover-dates">
              <label class="rr-date-range-popover-label">
                <span>Start</span>
                <input type="date" id="act-activities-date-start" class="rr-date-input rr-date-input--popover" />
              </label>
              <label class="rr-date-range-popover-label">
                <span>End</span>
                <input type="date" id="act-activities-date-end" class="rr-date-input rr-date-input--popover" />
              </label>
            </div>
            <div class="rr-date-range-popover-actions">
              <button type="button" class="button rr-date-range-action-btn" id="act-activities-date-range-apply">
                Apply
              </button>
              <button type="button" class="button secondary rr-date-range-action-btn" id="act-activities-date-range-clear">
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function getSelectedActivityFieldKeys(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('#act-fields-panel .act-field-cb:checked'))
    .map((cb) => cb.dataset.actFieldKey ?? '')
    .filter((k) => k.length > 0)
}

export function readActivitiesPageFilters(): ActivitiesPageFilters {
  const activityType = (document.getElementById('act-activity-type') as HTMLSelectElement | null)?.value ?? 'both'
  const startDate =
    (document.getElementById('act-activities-date-start') as HTMLInputElement | null)?.value.trim() ?? ''
  const endDate =
    (document.getElementById('act-activities-date-end') as HTMLInputElement | null)?.value.trim() ?? ''
  const typeNorm = activityType as ActivityTypeFilter

  return {
    activityType: typeNorm,
    activityTypeApi:
      typeNorm === 'time_entry' ? 'TimeEntry' : typeNorm === 'expense' ? 'ExpenseEntry' : undefined,
    startDate,
    endDate,
    fieldKeys: getSelectedActivityFieldKeys()
  }
}

export function getActivitiesPageHtml(): string {
  return `
    <div class="page-header">
      <h1 class="page-title">Activities</h1>
      <p class="page-description">Filter by activity type and date range, choose fields to fetch, then fetch records or open the results table.</p>
    </div>
    <div class="custom-fields-page-form">
      <section class="rr-section rr-section--activities" aria-labelledby="act-section-activities-title">
        <h2 class="rr-section-title" id="act-section-activities-title">Activities</h2>
        <div class="rr-activities-filters">
          <div class="filter-group">
            <label for="act-activity-type">Activity Type</label>
            <select id="act-activity-type">${ACTIVITY_TYPE_OPTIONS_HTML}</select>
          </div>
          ${activitiesDateRangeHtml()}
        </div>
      </section>

      <section class="rr-section rr-section--general-details" aria-labelledby="act-section-fields-title">
        <h2 class="rr-section-title" id="act-section-fields-title">Fields</h2>
        <p class="rr-cf-all-hint" style="margin-top:0;margin-bottom:12px">
          Choose which activity fields to load. Only selected fields are requested from Clio.
        </p>
        <div id="act-fields-panel" class="rr-custom-fields-panel" role="group" aria-label="Activity fields">
          ${buildActivityFieldCheckboxesHtml(escapeHtml)}
        </div>
      </section>

      <div class="form-actions rr-compile-actions">
        <button type="button" id="act-fetch-records-btn" class="button">Fetch records</button>
        <span class="rr-compile-fetch-status" id="act-fetch-status" aria-live="polite"></span>
        <button type="button" id="act-open-table-btn" class="button" hidden>
          Open table
        </button>
      </div>
    </div>
  `
}

export function setupActivitiesPage(): void {
  setupStandaloneDateRangePicker({
    fieldWrapId: 'act-activities-date-range-field',
    displayId: 'act-activities-date-range-display',
    openBtnId: 'act-activities-date-range-btn',
    popoverId: 'act-activities-date-range-popover',
    startInputId: 'act-activities-date-start',
    endInputId: 'act-activities-date-end',
    applyBtnId: 'act-activities-date-range-apply',
    clearBtnId: 'act-activities-date-range-clear'
  })

  const actFetchBtn = document.getElementById('act-fetch-records-btn') as HTMLButtonElement | null
  const actFetchStatusEl = document.getElementById('act-fetch-status')
  const actOpenTableBtn = document.getElementById('act-open-table-btn') as HTMLButtonElement | null

  let lastFetchedActivities: unknown[] = []
  let lastFetchedFieldKeys: string[] = []

  const syncOpenTableBtn = (): void => {
    if (actOpenTableBtn) {
      actOpenTableBtn.hidden = lastFetchedActivities.length === 0
    }
  }
  syncOpenTableBtn()

  actFetchBtn?.addEventListener('click', () => {
    void (async () => {
      if (actFetchStatusEl) {
        actFetchStatusEl.classList.remove('rr-compile-fetch-status--error')
      }

      const filters = readActivitiesPageFilters()

      if (filters.fieldKeys.length === 0) {
        if (actFetchStatusEl) {
          actFetchStatusEl.textContent = 'Select at least one field to fetch.'
          actFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (!filters.startDate || !filters.endDate) {
        if (actFetchStatusEl) {
          actFetchStatusEl.textContent = 'Choose a start and end date for the activity date range.'
          actFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (filters.startDate > filters.endDate) {
        if (actFetchStatusEl) {
          actFetchStatusEl.textContent = 'Start date must be on or before end date.'
          actFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
        return
      }

      if (actFetchStatusEl) {
        actFetchStatusEl.textContent = 'Fetching…'
      }
      if (actFetchBtn) {
        actFetchBtn.disabled = true
      }

      lastFetchedActivities = []
      lastFetchedFieldKeys = []
      syncOpenTableBtn()

      try {
        const result = await window.api.clio.fetchActivitiesReport({
          fieldKeys: filters.fieldKeys,
          activityType: filters.activityTypeApi,
          startDate: filters.startDate,
          endDate: filters.endDate
        })

        if (result.error) {
          if (actFetchStatusEl) {
            actFetchStatusEl.textContent = result.error
            actFetchStatusEl.classList.add('rr-compile-fetch-status--error')
          }
          return
        }

        lastFetchedActivities = Array.isArray(result.data) ? result.data : []
        lastFetchedFieldKeys = filters.fieldKeys
        syncOpenTableBtn()

        if (actFetchStatusEl) {
          actFetchStatusEl.textContent = `No. of records fetched: ${result.recordCount}`
        }
      } catch (e) {
        if (actFetchStatusEl) {
          actFetchStatusEl.textContent = e instanceof Error ? e.message : 'Request failed'
          actFetchStatusEl.classList.add('rr-compile-fetch-status--error')
        }
      } finally {
        if (actFetchBtn) {
          actFetchBtn.disabled = false
        }
      }
    })()
  })

  actOpenTableBtn?.addEventListener('click', () => {
    if (lastFetchedActivities.length === 0 || lastFetchedFieldKeys.length === 0) {
      return
    }
    const { columns, records } = buildActivitiesTablePayload(lastFetchedActivities, lastFetchedFieldKeys)
    void window.api.openTableResults({
      title: 'Activities',
      columns,
      records,
      csvBaseName: 'activities'
    })
  })
}
