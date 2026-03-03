export function getUnpaidBillsFormHtml(): string {
  const billStateOptions = [
    '<option value="">All unpaid states</option>',
    '<option value="draft">Draft</option>',
    '<option value="awaiting_approval">Awaiting Approval</option>',
    '<option value="awaiting_payment">Awaiting Payment</option>'
  ].join('')

  const matterStatusOptions = [
    '<option value="">All statuses</option>',
    '<option value="Open">Open</option>',
    '<option value="Pending">Pending</option>',
    '<option value="Closed">Closed</option>'
  ].join('')

  return `
    <div class="page-header">
      <h1 class="page-title">Unpaid Bills</h1>
      <p class="page-description">Extract unpaid bills (draft, awaiting approval, awaiting payment) from Clio.</p>
    </div>
    <div class="unpaid-bills-form">
      <div class="filter-grid">
        <div class="filter-group">
          <label for="ub-filter-bill-state">Bill State</label>
          <select id="ub-filter-bill-state">${billStateOptions}</select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-client">Client</label>
          <select id="ub-filter-client">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-originating-attorney">Originating Attorney</label>
          <select id="ub-filter-originating-attorney">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-responsible-attorney">Responsible Attorney</label>
          <select id="ub-filter-responsible-attorney">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-practice-area">Practice Area</label>
          <select id="ub-filter-practice-area">
            <option value="">All</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-matter-status">Matter Status</label>
          <select id="ub-filter-matter-status">${matterStatusOptions}</select>
        </div>
        <div class="filter-group">
          <label for="ub-filter-invoice-date-from">Invoice Date From</label>
          <input type="date" id="ub-filter-invoice-date-from" />
        </div>
        <div class="filter-group">
          <label for="ub-filter-invoice-date-to">Invoice Date To</label>
          <input type="date" id="ub-filter-invoice-date-to" />
        </div>
        <div class="filter-group">
          <label for="ub-filter-due-date-from">Due Date From</label>
          <input type="date" id="ub-filter-due-date-from" />
        </div>
        <div class="filter-group">
          <label for="ub-filter-due-date-to">Due Date To</label>
          <input type="date" id="ub-filter-due-date-to" />
        </div>
        <div class="filter-group">
          <label for="ub-filter-overdue-only">Overdue Only</label>
          <input type="checkbox" id="ub-filter-overdue-only" />
        </div>
        <div class="filter-group">
          <label for="ub-filter-invoice-number">Invoice #</label>
          <input type="text" id="ub-filter-invoice-number" placeholder="Search..." />
        </div>
      </div>
      <div class="form-actions">
        <button id="ub-refreshOptionsBtn" class="button secondary">Refresh</button>
        <button id="ub-fetchBtn" class="button">Fetch</button>
      </div>
      <div id="unpaid-bills-status" class="form-status"></div>
    </div>
  `
}

export function populateUnpaidBillsDropdowns(
  users: Array<{ id: number; name: string }>,
  practiceAreas: Array<{ id: number; name: string }>,
  clients: Array<{ id: number; name?: string }>
): void {
  const attorneySelects = ['ub-filter-originating-attorney', 'ub-filter-responsible-attorney']
  attorneySelects.forEach((id) => {
    const sel = document.getElementById(id) as HTMLSelectElement
    if (sel) {
      const opts = users.map((u) => `<option value="${u.id}">${u.name || 'Unknown'}</option>`).join('')
      sel.innerHTML = '<option value="">All</option>' + opts
    }
  })

  const paSel = document.getElementById('ub-filter-practice-area') as HTMLSelectElement
  if (paSel) {
    paSel.innerHTML =
      '<option value="">All</option>' +
      practiceAreas.map((p) => `<option value="${p.id}">${p.name || 'Unknown'}</option>`).join('')
  }

  const clientSel = document.getElementById('ub-filter-client') as HTMLSelectElement
  if (clientSel) {
    clientSel.innerHTML =
      '<option value="">All</option>' +
      clients.map((c) => `<option value="${c.id}">${(c as { name?: string }).name || 'Unknown'}</option>`).join('')
  }
}

export function getUnpaidBillsFilters(): Record<string, unknown> {
  const getVal = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement)?.value?.trim()
  const getCheck = (id: string) => (document.getElementById(id) as HTMLInputElement)?.checked ?? false

  const filters: Record<string, unknown> = {}

  const billState = getVal('ub-filter-bill-state')
  if (billState) filters.billState = billState

  const client = getVal('ub-filter-client')
  if (client) filters.clientId = parseInt(client, 10)

  const oa = getVal('ub-filter-originating-attorney')
  if (oa) filters.originatingAttorneyId = parseInt(oa, 10)

  const ra = getVal('ub-filter-responsible-attorney')
  if (ra) filters.responsibleAttorneyId = parseInt(ra, 10)

  const pa = getVal('ub-filter-practice-area')
  if (pa) filters.practiceAreaId = parseInt(pa, 10)

  const matterStatus = getVal('ub-filter-matter-status')
  if (matterStatus) filters.matterStatus = matterStatus

  const invFrom = getVal('ub-filter-invoice-date-from')
  if (invFrom) filters.invoiceDateFrom = invFrom

  const invTo = getVal('ub-filter-invoice-date-to')
  if (invTo) filters.invoiceDateTo = invTo

  const dueFrom = getVal('ub-filter-due-date-from')
  if (dueFrom) filters.dueDateFrom = dueFrom

  const dueTo = getVal('ub-filter-due-date-to')
  if (dueTo) filters.dueDateTo = dueTo

  if (getCheck('ub-filter-overdue-only')) filters.overdueOnly = true

  const invNum = getVal('ub-filter-invoice-number')
  if (invNum) filters.invoiceNumber = invNum

  return filters
}

export function setUnpaidBillsStatus(message: string, type: 'info' | 'success' | 'error'): void {
  const el = document.getElementById('unpaid-bills-status')
  if (el) {
    el.textContent = message
    el.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#0055aa'
  }
}
