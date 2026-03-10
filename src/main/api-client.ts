import ClioAuthManager from './auth'

class ClioAPIClient {
  private authManager: ClioAuthManager
  private baseURL = 'https://app.clio.com/api/v4'

  constructor(authManager: ClioAuthManager) {
    this.authManager = authManager
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: unknown; error?: string }> {
    const token = this.authManager.getAccessToken()

    if (!token) {
      return { data: null, error: 'Not authenticated' }
    }

    const url = `${this.baseURL}${endpoint}`

    try {
      let response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      if (response.status === 401) {
        const refreshed = await this.authManager.refreshAccessToken()
        if (refreshed) {
          const newToken = this.authManager.getAccessToken()
          response = await fetch(url, {
            ...options,
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
              ...options.headers
            }
          })
        } else {
          return { data: null, error: 'Token refresh failed' }
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        return { data: null, error: `API error: ${response.status} - ${errorText}` }
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error('API request error:', error)
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getCurrentUser(): Promise<{ data: unknown; error?: string }> {
    return await this.makeRequest('/users/who_am_i?fields=id,etag,name')
  }

  async getContacts(params?: {
    fields?: string
    limit?: number
    offset?: number
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/contacts?${query}` : '/contacts'

    return await this.makeRequest(endpoint)
  }

  async getMatters(params?: {
    fields?: string
    limit?: number
    offset?: number
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/matters?${query}` : '/matters'

    return await this.makeRequest(endpoint)
  }

  async getBills(params?: {
    fields?: string
    limit?: number
    offset?: number
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/bills?${query}` : '/bills'

    return await this.makeRequest(endpoint)
  }

  /** Custom field record from Clio API */
  static readonly CUSTOM_FIELDS_FIELDS =
    'id,etag,created_at,updated_at,name,parent_type,field_type,displayed,deleted,required,display_order,picklist_options{id,etag,created_at,updated_at,option,deleted_at}'

  /**
   * Fetch all custom fields with parent_type filter (e.g. Contact or Matter). Paginates until no more pages.
   */
  async getCustomFields(parentType: 'Contact' | 'Matter'): Promise<{
    data: Array<Record<string, unknown>>
    error?: string
  }> {
    const limit = 200
    const order = 'id(asc)'
    const allData: Array<Record<string, unknown>> = []
    let pageToken: string | null = null

    do {
      const params = new URLSearchParams()
      params.set('fields', ClioAPIClient.CUSTOM_FIELDS_FIELDS)
      params.set('limit', String(limit))
      params.set('order', order)
      params.set('parent_type', parentType)
      if (pageToken) params.set('page_token', pageToken)

      const endpoint = `/custom_fields.json?${params.toString()}`
      const result = await this.makeRequest(endpoint)
      if (result.error) return { data: [], error: result.error }

      const body = result.data as { data?: Array<Record<string, unknown>>; meta?: { paging?: { next_page_token?: string } } }
      const pageData = body?.data ?? []
      allData.push(...pageData)

      const nextToken = body?.meta?.paging?.next_page_token ?? (body?.meta as { next_page_token?: string })?.next_page_token ?? null
      const hasMore = nextToken && pageData.length === limit
      pageToken = hasMore ? nextToken : null
    } while (pageToken)

    return { data: allData }
  }

  async getUsers(params?: { fields?: string; limit?: number }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()
    queryParams.append('fields', params?.fields || 'id,name')
    queryParams.append('limit', String(params?.limit || 200))
    return await this.makeRequest(`/users?${queryParams}`)
  }

  async getPracticeAreas(params?: { limit?: number }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()
    queryParams.append('fields', 'id,name')
    queryParams.append('limit', String(params?.limit || 200))
    return await this.makeRequest(`/practice_areas?${queryParams}`)
  }

  async getBillableClients(): Promise<{ data: unknown; error?: string }> {
    return await this.makeRequest('/billable_clients?fields=id,name&limit=200')
  }

  async getFirmRevenueData(filters: FirmRevenueFilters): Promise<{
    data: FirmRevenueRow[]
    error?: string
  }> {
    const rows: FirmRevenueRow[] = []

    try {
      const billsParams = new URLSearchParams()
      billsParams.append('limit', '200')
      billsParams.append('type', 'revenue')
      billsParams.append('state', 'paid')
      if (filters.clientId) billsParams.append('client_id', String(filters.clientId))
      if (filters.originatingAttorneyId) billsParams.append('originating_attorney_id', String(filters.originatingAttorneyId))
      if (filters.responsibleAttorneyId) billsParams.append('responsible_attorney_id', String(filters.responsibleAttorneyId))
      if (filters.invoiceDateFrom) billsParams.append('issued_after', filters.invoiceDateFrom + 'T00:00:00Z')
      if (filters.invoiceDateTo) billsParams.append('issued_before', filters.invoiceDateTo + 'T23:59:59Z')
      if (filters.invoiceNumber) billsParams.append('query', filters.invoiceNumber)

      const billFields =
        'id,number,issued_at,paid,total,matters{id,display_number,description,open_date,status,client_id,client}'
      const { data: billsData, error: billsError } = await this.makeRequest(
        `/bills?${billsParams}&fields=${billFields}`
      )

      if (billsError) return { data: [], error: billsError }

      const apiResponse = billsData as { data?: Array<Record<string, unknown>> }
      const bills = apiResponse?.data || []

      const matterDetailsCache = new Map<
        number,
        { originatingAttorney: string; responsibleAttorney: string; practiceAreaName: string; practiceAreaId?: number }
      >()

      for (const bill of bills) {
        const billId = bill.id as number
        const matters = bill.matters as Array<Record<string, unknown>> | undefined
        const matter = matters?.[0]

        if (!matter) continue

        if (filters.matterStatus && (matter.status as string) !== filters.matterStatus) continue

        const matterId = matter.id as number
        if (!matterDetailsCache.has(matterId)) {
          const { data: matterData } = await this.makeRequest(
            `/matters/${matterId}?fields=originating_attorney{name},responsible_attorney{name},practice_area{id,name}`
          )
          const m = matterData as Record<string, unknown> | undefined
          const oa = (m?.originating_attorney as Record<string, string>)?.name || ''
          const ra = (m?.responsible_attorney as Record<string, string>)?.name || ''
          const pa = m?.practice_area as Record<string, unknown> | undefined
          const paName = (pa?.name as string) || ''
          const paId = pa?.id as number | undefined
          matterDetailsCache.set(matterId, {
            originatingAttorney: oa,
            responsibleAttorney: ra,
            practiceAreaName: paName,
            practiceAreaId: paId
          })
        }
        const details = matterDetailsCache.get(matterId)!

        if (filters.practiceAreaId && details.practiceAreaId !== filters.practiceAreaId) continue

        const matterNumber = (matter.display_number as string) || ''
        const matterName = (matter.description as string) || ''
        if (filters.matterNumber && !matterNumber.toLowerCase().includes(filters.matterNumber.toLowerCase())) continue
        if (filters.matterName && !matterName.toLowerCase().includes(filters.matterName.toLowerCase())) continue

        const openDate = (matter.open_date as string) || ''
        if (filters.startDateFrom && openDate < filters.startDateFrom) continue
        if (filters.startDateTo && openDate > filters.startDateTo) continue

        const client = matter.client as Record<string, string> | undefined
        const clientName = client?.name || ''
        if (filters.clientId && (matter.client_id as number) !== filters.clientId) continue

        const paid = (bill.paid as number) ?? (bill.total as number) ?? 0
        if (filters.feesCollectedMin && paid < filters.feesCollectedMin) continue
        if (filters.feesCollectedMax && paid > filters.feesCollectedMax) continue

        const lineItemsFields =
          'bill{number,issued_at,paid,total},activity{date,quantity_in_hours,user},matter{display_number,description,open_date,status,client}'
        const { data: lineItemsData, error: lineError } = await this.makeRequest(
          `/line_items?bill_id=${billId}&display=true&fields=${lineItemsFields}&limit=200`
        )

        if (lineError) continue

        const lineResponse = lineItemsData as { data?: Array<Record<string, unknown>> }
        const lineItems = lineResponse?.data || []

        const { originatingAttorney, responsibleAttorney, practiceAreaName } = details

        for (const item of lineItems) {
          const activity = item.activity as Record<string, unknown> | undefined
          const activityUser = activity?.user as Record<string, unknown> | undefined
          const biller = (activityUser?.name as string) || ''

          if (filters.billerId && (activityUser?.id as number) !== filters.billerId) continue

          const quantity = (activity?.quantity_in_hours as number) ?? (item.quantity as number) ?? 0
          if (filters.billableHoursMin && quantity < filters.billableHoursMin) continue
          if (filters.billableHoursMax && quantity > filters.billableHoursMax) continue

          const activityDate = (activity?.date as string) || ''
          const monthStr = this.formatMonth(activityDate)
          if (filters.month && monthStr !== filters.month) continue

          const billObj = item.bill as Record<string, unknown>
          const invoiceNumber = ((billObj?.number as string) || (bill.number as string) || '') as string
          const invoiceDate = this.formatDate(
            ((billObj?.issued_at as string) || (bill.issued_at as string) || '') as string
          )
          const feesCollected = (billObj?.paid as number) ?? paid

          rows.push({
            month: monthStr,
            originatingAttorney,
            responsibleAttorney,
            biller,
            clientName,
            practiceArea: practiceAreaName,
            matterNumber,
            matterName,
            startDate: this.formatDate(openDate),
            matterStatus: (matter.status as string) || '',
            billableHours: Math.round(quantity * 100) / 100,
            invoiceNumber,
            invoiceDate,
            feesCollected: Math.round((feesCollected || 0) * 100) / 100
          })
        }

        if (lineItems.length === 0) {
          rows.push({
            month: this.formatMonth((bill.issued_at as string) || ''),
            originatingAttorney,
            responsibleAttorney,
            biller: '',
            clientName,
            practiceArea: practiceAreaName,
            matterNumber,
            matterName,
            startDate: this.formatDate(openDate),
            matterStatus: (matter.status as string) || '',
            billableHours: 0,
            invoiceNumber: (bill.number as string) || '',
            invoiceDate: this.formatDate((bill.issued_at as string) || ''),
            feesCollected: Math.round(paid * 100) / 100
          })
        }
      }

      return { data: rows }
    } catch (error) {
      console.error('Firm revenue fetch error:', error)
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      }
    }
  }

  private formatMonth(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return `${months[d.getMonth()]} ${d.getFullYear()}`
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString()
  }

  async getUnpaidBillsData(filters: UnpaidBillsFilters): Promise<{
    data: UnpaidBillsRow[]
    error?: string
  }> {
    const rows: UnpaidBillsRow[] = []
    const unpaidStates = ['draft', 'awaiting_approval', 'awaiting_payment'] as const
    const statesToFetch =
      filters.billState && unpaidStates.includes(filters.billState as (typeof unpaidStates)[number])
        ? [filters.billState as string]
        : unpaidStates

    try {
      const billFields =
        'id,number,issued_at,due_at,state,total,balance,matters{id,display_number,description,open_date,status,client_id,client}'

      const matterDetailsCache = new Map<
        number,
        { originatingAttorney: string; responsibleAttorney: string; practiceAreaName: string; practiceAreaId?: number }
      >()

      for (const state of statesToFetch) {
        const billsParams = new URLSearchParams()
        billsParams.append('limit', '200')
        billsParams.append('type', 'revenue')
        billsParams.append('state', state)
        if (filters.clientId) billsParams.append('client_id', String(filters.clientId))
        if (filters.originatingAttorneyId) billsParams.append('originating_attorney_id', String(filters.originatingAttorneyId))
        if (filters.responsibleAttorneyId) billsParams.append('responsible_attorney_id', String(filters.responsibleAttorneyId))
        if (filters.invoiceDateFrom) billsParams.append('issued_after', filters.invoiceDateFrom + 'T00:00:00Z')
        if (filters.invoiceDateTo) billsParams.append('issued_before', filters.invoiceDateTo + 'T23:59:59Z')
        if (filters.dueDateFrom) billsParams.append('due_after', filters.dueDateFrom + 'T00:00:00Z')
        if (filters.dueDateTo) billsParams.append('due_before', filters.dueDateTo + 'T23:59:59Z')
        if (filters.overdueOnly) billsParams.append('overdue_only', 'true')
        if (filters.invoiceNumber) billsParams.append('query', filters.invoiceNumber)

        const { data: billsData, error: billsError } = await this.makeRequest(
          `/bills?${billsParams}&fields=${billFields}`
        )

        if (billsError) return { data: [], error: billsError }

        const apiResponse = billsData as { data?: Array<Record<string, unknown>> }
        const bills = apiResponse?.data || []

        for (const bill of bills) {
          const matters = bill.matters as Array<Record<string, unknown>> | undefined
          const matter = matters?.[0]

          if (!matter) continue

          if (filters.matterStatus && (matter.status as string) !== filters.matterStatus) continue

          const matterId = matter.id as number
          if (!matterDetailsCache.has(matterId)) {
            const { data: matterData } = await this.makeRequest(
              `/matters/${matterId}?fields=originating_attorney{name},responsible_attorney{name},practice_area{id,name}`
            )
            const m = (matterData as { data?: Record<string, unknown> })?.data
            const oa = (m?.originating_attorney as Record<string, string>)?.name || ''
            const ra = (m?.responsible_attorney as Record<string, string>)?.name || ''
            const pa = m?.practice_area as Record<string, unknown> | undefined
            const paName = (pa?.name as string) || ''
            const paId = pa?.id as number | undefined
            matterDetailsCache.set(matterId, {
              originatingAttorney: oa,
              responsibleAttorney: ra,
              practiceAreaName: paName,
              practiceAreaId: paId
            })
          }

          const details = matterDetailsCache.get(matterId)!
          if (filters.practiceAreaId && details.practiceAreaId !== filters.practiceAreaId) continue
          const client = matter.client as Record<string, string> | undefined
          const clientName = client?.name || ''
          if (filters.clientId && (matter.client_id as number) !== filters.clientId) continue

          const dueAt = (bill.due_at as string) || ''
          const daysOverdue = dueAt ? this.getDaysOverdue(dueAt) : 0
          if (filters.overdueOnly && daysOverdue <= 0) continue

          const balance = (bill.balance as number) ?? (bill.total as number) ?? 0

          rows.push({
            invoiceNumber: (bill.number as string) || '',
            invoiceDate: this.formatDate((bill.issued_at as string) || ''),
            dueDate: this.formatDate(dueAt),
            clientName,
            matterNumber: (matter.display_number as string) || '',
            matterName: (matter.description as string) || '',
            matterStatus: (matter.status as string) || '',
            billState: this.formatBillState(state),
            total: Math.round(((bill.total as number) ?? 0) * 100) / 100,
            balance: Math.round(balance * 100) / 100,
            daysOverdue,
            originatingAttorney: details.originatingAttorney,
            responsibleAttorney: details.responsibleAttorney,
            practiceArea: details.practiceAreaName
          })
        }
      }

      return { data: rows }
    } catch (error) {
      console.error('Unpaid bills fetch error:', error)
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      }
    }
  }

  private formatBillState(state: string): string {
    const map: Record<string, string> = {
      draft: 'Draft',
      awaiting_approval: 'Awaiting Approval',
      awaiting_payment: 'Awaiting Payment'
    }
    return map[state] || state
  }

  private getDaysOverdue(dueDateStr: string): number {
    const due = new Date(dueDateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }
}

export interface UnpaidBillsFilters {
  billState?: string
  clientId?: number
  originatingAttorneyId?: number
  responsibleAttorneyId?: number
  practiceAreaId?: number
  matterStatus?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  overdueOnly?: boolean
  invoiceNumber?: string
}

export interface UnpaidBillsRow {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  matterNumber: string
  matterName: string
  matterStatus: string
  billState: string
  total: number
  balance: number
  daysOverdue: number
  originatingAttorney: string
  responsibleAttorney: string
  practiceArea: string
}

export interface FirmRevenueFilters {
  month?: string
  originatingAttorneyId?: number
  responsibleAttorneyId?: number
  billerId?: number
  clientId?: number
  practiceAreaId?: number
  matterNumber?: string
  matterName?: string
  startDateFrom?: string
  startDateTo?: string
  matterStatus?: string
  billableHoursMin?: number
  billableHoursMax?: number
  invoiceNumber?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  feesCollectedMin?: number
  feesCollectedMax?: number
}

export interface FirmRevenueRow {
  month: string
  originatingAttorney: string
  responsibleAttorney: string
  biller: string
  clientName: string
  practiceArea: string
  matterNumber: string
  matterName: string
  startDate: string
  matterStatus: string
  billableHours: number
  invoiceNumber: string
  invoiceDate: string
  feesCollected: number
}

export default ClioAPIClient
