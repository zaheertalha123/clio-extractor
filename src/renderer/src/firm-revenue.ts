const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function generateMonthOptions(): string[] {
  const options: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
  }
  return options
}

export function getFirmRevenueFormHtml(): string {
  const monthOptions = generateMonthOptions()
  const monthSelectOptions = [
    '<option value="">All months</option>',
    ...monthOptions.map((m) => `<option value="${m}">${m}</option>`)
  ].join('')

  const matterStatusOptions = [
    '<option value="">All statuses</option>',
    '<option value="Open">Open</option>',
    '<option value="Pending">Pending</option>',
    '<option value="Closed">Closed</option>'
  ].join('')

  return `
    <div class="page-header">
      <h1 class="page-title">Firm Revenue</h1>
      <p class="page-description">Extract firm revenue data from Clio. Fill in filters and click Fetch.</p>
    </div>
    <div class="firm-revenue-form">
      <div class="filter-grid">
        <div class="filter-group">
          <label for="filter-month">Month</label>
          <select id="filter-month">${monthSelectOptions}</select>
        </div>
        <div class="filter-group">
          <label for="filter-originating-attorney">Originating Attorney</label>
          <select id="filter-originating-attorney">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-responsible-attorney">Responsible Attorney</label>
          <select id="filter-responsible-attorney">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-biller">Biller</label>
          <select id="filter-biller">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-client">Client Name</label>
          <select id="filter-client">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-practice-area">Practice Area</label>
          <select id="filter-practice-area">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-matter-number">Matter Number</label>
          <input type="text" id="filter-matter-number" placeholder="Search..." />
        </div>
        <div class="filter-group">
          <label for="filter-matter-name">Matter Name</label>
          <input type="text" id="filter-matter-name" placeholder="Search..." />
        </div>
        <div class="filter-group">
          <label for="filter-start-date-from">Start Date From</label>
          <input type="date" id="filter-start-date-from" />
        </div>
        <div class="filter-group">
          <label for="filter-start-date-to">Start Date To</label>
          <input type="date" id="filter-start-date-to" />
        </div>
        <div class="filter-group">
          <label for="filter-matter-status">Matter Status</label>
          <select id="filter-matter-status">${matterStatusOptions}</select>
        </div>
        <div class="filter-group">
          <label for="filter-billable-hours-min">Billable Hours Min</label>
          <input type="number" id="filter-billable-hours-min" placeholder="0" step="0.01" min="0" />
        </div>
        <div class="filter-group">
          <label for="filter-billable-hours-max">Billable Hours Max</label>
          <input type="number" id="filter-billable-hours-max" placeholder="Any" step="0.01" min="0" />
        </div>
        <div class="filter-group">
          <label for="filter-invoice-number">Invoice #</label>
          <input type="text" id="filter-invoice-number" placeholder="Search..." />
        </div>
        <div class="filter-group">
          <label for="filter-invoice-date-from">Invoice Date From</label>
          <input type="date" id="filter-invoice-date-from" />
        </div>
        <div class="filter-group">
          <label for="filter-invoice-date-to">Invoice Date To</label>
          <input type="date" id="filter-invoice-date-to" />
        </div>
        <div class="filter-group">
          <label for="filter-fees-min">Fees Collected Min</label>
          <input type="number" id="filter-fees-min" placeholder="0" step="0.01" min="0" />
        </div>
        <div class="filter-group">
          <label for="filter-fees-max">Fees Collected Max</label>
          <input type="number" id="filter-fees-max" placeholder="Any" step="0.01" min="0" />
        </div>
      </div>
      <div class="form-actions">
        <button id="refreshOptionsBtn" class="button secondary">Refresh</button>
        <button id="fetchRevenueBtn" class="button">Fetch</button>
      </div>
      <div id="firm-revenue-status" class="form-status"></div>
    </div>
  `
}

export function populateFirmRevenueDropdowns(
  users: Array<{ id: number; name: string }>,
  practiceAreas: Array<{ id: number; name: string }>,
  clients: Array<{ id: number; name?: string }>
): void {
  const attorneySelects = ['filter-originating-attorney', 'filter-responsible-attorney', 'filter-biller']
  attorneySelects.forEach((id) => {
    const sel = document.getElementById(id) as HTMLSelectElement
    if (sel) {
      const opts = users.map((u) => `<option value="${u.id}">${u.name || 'Unknown'}</option>`).join('')
      sel.innerHTML = '<option value="">All</option>' + opts
    }
  })

  const paSel = document.getElementById('filter-practice-area') as HTMLSelectElement
  if (paSel) {
    paSel.innerHTML =
      '<option value="">All</option>' +
      practiceAreas.map((p) => `<option value="${p.id}">${p.name || 'Unknown'}</option>`).join('')
  }

  const clientSel = document.getElementById('filter-client') as HTMLSelectElement
  if (clientSel) {
    clientSel.innerHTML =
      '<option value="">All</option>' +
      clients.map((c) => `<option value="${c.id}">${(c as { name?: string }).name || 'Unknown'}</option>`).join('')
  }
}

export function getFirmRevenueFilters(): Record<string, unknown> {
  const getVal = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value?.trim()

  const filters: Record<string, unknown> = {}
  const month = getVal('filter-month')
  if (month) filters.month = month

  const oa = getVal('filter-originating-attorney')
  if (oa) filters.originatingAttorneyId = parseInt(oa, 10)

  const ra = getVal('filter-responsible-attorney')
  if (ra) filters.responsibleAttorneyId = parseInt(ra, 10)

  const biller = getVal('filter-biller')
  if (biller) filters.billerId = parseInt(biller, 10)

  const client = getVal('filter-client')
  if (client) filters.clientId = parseInt(client, 10)

  const pa = getVal('filter-practice-area')
  if (pa) filters.practiceAreaId = parseInt(pa, 10)

  const matterNum = getVal('filter-matter-number')
  if (matterNum) filters.matterNumber = matterNum

  const matterName = getVal('filter-matter-name')
  if (matterName) filters.matterName = matterName

  const startFrom = getVal('filter-start-date-from')
  if (startFrom) filters.startDateFrom = startFrom

  const startTo = getVal('filter-start-date-to')
  if (startTo) filters.startDateTo = startTo

  const status = getVal('filter-matter-status')
  if (status) filters.matterStatus = status

  const bhMin = getVal('filter-billable-hours-min')
  if (bhMin) filters.billableHoursMin = parseFloat(bhMin)

  const bhMax = getVal('filter-billable-hours-max')
  if (bhMax) filters.billableHoursMax = parseFloat(bhMax)

  const invNum = getVal('filter-invoice-number')
  if (invNum) filters.invoiceNumber = invNum

  const invFrom = getVal('filter-invoice-date-from')
  if (invFrom) filters.invoiceDateFrom = invFrom

  const invTo = getVal('filter-invoice-date-to')
  if (invTo) filters.invoiceDateTo = invTo

  const feesMin = getVal('filter-fees-min')
  if (feesMin) filters.feesCollectedMin = parseFloat(feesMin)

  const feesMax = getVal('filter-fees-max')
  if (feesMax) filters.feesCollectedMax = parseFloat(feesMax)

  return filters
}

export function setFirmRevenueStatus(message: string, type: 'info' | 'success' | 'error'): void {
  const el = document.getElementById('firm-revenue-status')
  if (el) {
    el.textContent = message
    el.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#0055aa'
  }
}
