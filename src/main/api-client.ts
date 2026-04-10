import ClioAuthManager from './auth'
import { getMattersByDisplayId as fetchMattersByDisplayId } from './api/matters/get-matter-by-display-id'
import type { MatterByDisplayIdRow } from './api/matters/get-matter-by-display-id'

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
    query?: string
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.query != null) queryParams.append('query', params.query)

    const query = queryParams.toString()
    const endpoint = query ? `/contacts?${query}` : '/contacts'

    return await this.makeRequest(endpoint)
  }

  async getMatters(params?: {
    fields?: string
    limit?: number
    offset?: number
    query?: string
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.query != null) queryParams.append('query', params.query)

    const qs = queryParams.toString()
    const endpoint = qs ? `/matters?${qs}` : '/matters'

    return await this.makeRequest(endpoint)
  }

  /**
   * List matters matching a display-ID search query. Delegates to api/matters/get-matter-by-display-id.
   */
  async getMattersByDisplayId(query: string): Promise<{ data: MatterByDisplayIdRow[]; error?: string }> {
    return fetchMattersByDisplayId((endpoint, options) => this.makeRequest(endpoint, options), query)
  }

  /**
   * Matter fields for getMatterByDisplayNumber.
   * Clio allows only single-level nesting in fields (e.g. matter{client} not matter{client{date_of_birth}}).
   * Nested resources use curly brackets with comma-separated fields; no second-level nesting.
   */
  private static readonly MATTER_DETAIL_FIELDS = [
    'id', 'etag', 'number', 'display_number', 'custom_number', 'description', 'status', 'location',
    'client_reference', 'client_id', 'billable', 'maildrop_address', 'billing_method', 'open_date',
    'close_date', 'pending_date', 'created_at', 'updated_at', 'shared', 'has_tasks', 'last_activity_date',
    'matter_stage_updated_at',
    'currency{id,etag,code,sign,created_at,updated_at}',
    'client{id,etag,name,first_name,middle_name,last_name,date_of_birth,type,created_at,updated_at,prefix,title,initials,clio_connect_email,locked_clio_connect_email,client_connect_user_id,primary_email_address,secondary_email_address,primary_phone_number,secondary_phone_number,ledes_client_id,has_clio_for_clients_permission,is_client,is_clio_for_client_user,is_co_counsel,is_bill_recipient,sales_tax_number,currency}',
    'contingency_fee{id,etag,created_at,updated_at,show_contingency_award}',
    'custom_rate{type,on_invoice,rates}',
    'evergreen_retainer{id,created_at,updated_at,etag,minimum_threshold}',
    'folder{id,etag,created_at,updated_at,deleted_at,type,locked,name,root}',
    'group{client_connect_user,etag,id,name,type,updated_at}',
    'matter_budget{id,etag,budget,include_expenses,notification_threshold,notify_users,created_at,updated_at}',
    'matter_stage{id,etag,practice_area_id,name,order,created_at,updated_at}',
    'originating_attorney{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'practice_area{id,etag,name,category,code,created_at,updated_at}',
    'responsible_attorney{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'responsible_staff{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'statute_of_limitations{id,etag,name,status,description,description_text_type,priority,due_at,permission,completed_at,notify_completion,statute_of_limitations,time_estimated,created_at,updated_at,time_entries_count}',
    'user{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'legal_aid_uk_matter{access_point,laa_office_number,ait_hearing_centre,attended_several_hearings_acting_for_multiple_clients,bill_ho_ucn,bill_number_of_attendances,bill_outcome_for_the_client_code,bill_stage_reached_code,case_reference,case_start_date,category,category_as_string,certificate_effective_date,certificate_expiration_date,certificate_number,certificate_scope,certification_type,change_of_solicitor,client_equal_opportunity_monitoring,client_type,clr_start_date,clr_total_profit_costs,cost_limit,counsel,court,court_id,court_id_code,created_at,delivery_location,dscc_number,duty_solicitor,etag,exceptional_case_funding_reference,expense_limit,fee_scheme,first_conducting_solicitor,id,irc_surgery,legacy_case,legal_representation_number,lh_total_disbursements,lh_start_date,lh_total_profit_costs,linked_matter_id,local_authority_number,maat_id,matter_type,matter_type_code,matter_type_1,matter_type_1_code,matter_type_1_title,matter_type_2,matter_type_2_code,matter_type_2_title,matter_types_combined,number_of_clients_seen_at_surgery,number_of_clients,party,police_station,post_transfer_clients_represented,postal_application_accepted,prior_authority_reference,prison_id,prison_law_prior_approval_number,procurement_area,region,related_claims_number,representation_order_date,schedule_reference_number,scheme_id,session_type,solicitor_type,standard_fee_category,surgery_clients_resulting_in_a_legal_help_matter_opened,surgery_clients,surgery_date,transfer_date,type_of_advice,type_of_service,ucn,ufn,undesignated_area_court,updated_at,user_type,youth_court}',
    'attorney_allocation{id,etag,account_id,resource_id,resource_type,originating_attorney_allocation,responsible_attorney_allocation,created_at,updated_at}',
    'account_balances{id,balance,type,name,currency_id}',
    'matter_bill_recipients{id,etag,created_at,updated_at,recipient}',
    'relationships{id,etag,description,created_at,updated_at}',
    'custom_field_values{id,etag,field_name,created_at,updated_at,field_type,field_required,field_displayed,field_display_order,value,soft_deleted,custom_field,picklist_option,matter,contact}',
    'custom_field_set_associations{id,etag,display_order,created_at,updated_at}',
    'kyc_field_values{id,etag,field_name,field_label,created_at,updated_at,field_type,field_value,field_possible_values,group}',
    'split_invoice_payers{id,contact_id,matter_id,send_to_bill_recipients,split_portion,etag,created_at,updated_at}'
  ].join(',')
  /** Contact fields for getContactCustomFieldValues (include custom_field_values). */
  private static readonly CONTACT_DETAIL_FIELDS = [
    'id', 'etag', 'name', 'first_name', 'middle_name', 'last_name', 'created_at', 'updated_at',
    'custom_field_values{id,etag,field_name,created_at,updated_at,field_type,field_required,field_displayed,field_display_order,value,soft_deleted,custom_field,picklist_option,matter,contact}'
  ].join(',')

  /**
   * Activity Rates are custom rates per contact (single-level nesting only).
   * GET /activity_rates – filter by contact_id to get rates for a matter's client.
   */
  async getActivityRates(params?: {
    contact_id?: number
    limit?: number
    fields?: string
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()
    if (params?.contact_id != null) queryParams.append('contact_id', String(params.contact_id))
    if (params?.limit != null) queryParams.append('limit', String(params.limit))
    if (params?.fields) queryParams.append('fields', params.fields)
    const qs = queryParams.toString()
    const endpoint = qs ? `/activity_rates?${qs}` : '/activity_rates'
    return await this.makeRequest(endpoint)
  }

  /**
   * Fetch only custom_field_values for a matter. Resolves matter ID the same way as matters part:
   * getMatters by query, match by display_number, then GET /matters/{id} with custom_field_ids[].
   */
  async getMatterCustomFieldValues(
    matterIdentifier: string,
    customFieldIds: number[]
  ): Promise<{ data: Array<Record<string, unknown>>; error?: string }> {
    const listRes = await this.getMatters({
      query: matterIdentifier.trim(),
      limit: 50,
      fields: 'id,display_number'
    })
    if (listRes.error) return { data: [], error: listRes.error }
    const listBody = listRes.data as { data?: Array<{ id: number; display_number?: string }> }
    const items = listBody?.data ?? []
    const match = items.find((m) => String(m.display_number) === String(matterIdentifier.trim()))
    if (!match) {
      return { data: [], error: `No matter found with display_number: ${matterIdentifier}` }
    }
    const matterId = match.id
    const params = new URLSearchParams()
    params.set('fields', ClioAPIClient.MATTER_DETAIL_FIELDS)
    customFieldIds.forEach((id) => params.append('custom_field_ids[]', String(id)))
    const res = await this.makeRequest(`/matters/${matterId}.json?${params.toString()}`)
    if (res.error) return { data: [], error: res.error }
    const body = res.data as { data?: { custom_field_values?: Array<Record<string, unknown>> } }
    const values = body?.data?.custom_field_values ?? []
    return { data: values }
  }

  /**
   * Fetch only custom_field_values for a contact. Resolves contact ID via getContacts (query or numeric id), then GET /contacts/{id} with custom_field_ids[].
   */
  async getContactCustomFieldValues(
    contactIdentifier: string,
    customFieldIds: number[]
  ): Promise<{ data: Array<Record<string, unknown>>; error?: string }> {
    const trimmed = contactIdentifier.trim()
    let contactId: number
    const numericId = Number(trimmed)
    if (!Number.isNaN(numericId) && String(numericId) === trimmed) {
      contactId = numericId
    } else {
      const listRes = await this.getContacts({
        query: trimmed,
        limit: 50,
        fields: 'id,name'
      })
      if (listRes.error) return { data: [], error: listRes.error }
      const listBody = listRes.data as { data?: Array<{ id: number; name?: string }> }
      const items = listBody?.data ?? []
      const match = items.find((m) => String(m.name ?? '').toLowerCase().includes(trimmed.toLowerCase())) ?? items[0]
      if (!match) {
        return { data: [], error: `No contact found for: ${contactIdentifier}` }
      }
      contactId = match.id
    }
    const params = new URLSearchParams()
    params.set('fields', ClioAPIClient.CONTACT_DETAIL_FIELDS)
    customFieldIds.forEach((id) => params.append('custom_field_ids[]', String(id)))
    const res = await this.makeRequest(`/contacts/${contactId}.json?${params.toString()}`)
    if (res.error) return { data: [], error: res.error }
    const body = res.data as { data?: { custom_field_values?: Array<Record<string, unknown>> } }
    const values = body?.data?.custom_field_values ?? []
    return { data: values }
  }

  /** Fetch a single matter by display_number (list by query, then get by id). Returns matter object or error. */
  async getMatterByDisplayNumber(displayNumber: string): Promise<{ data: Record<string, unknown> | null; error?: string }> {
    const listRes = await this.getMatters({
      query: displayNumber,
      limit: 50,
      fields: 'id,display_number'
    })
    if (listRes.error) return { data: null, error: listRes.error }
    const listBody = listRes.data as { data?: Array<{ id: number; display_number?: string }> }
    const items = listBody?.data ?? []
    const match = items.find((m) => String(m.display_number) === String(displayNumber))
    if (!match) {
      return { data: null, error: `No matter found with display_number: ${displayNumber}` }
    }

    const customFieldsRes = await this.getCustomFields('Matter')
    const customFieldIds: number[] = []
    if (!customFieldsRes.error && Array.isArray(customFieldsRes.data)) {
      for (const cf of customFieldsRes.data) {
        const id = cf?.id != null ? Number(cf.id) : NaN
        if (!Number.isNaN(id)) customFieldIds.push(id)
      }
    }

    const matterParams = new URLSearchParams()
    matterParams.set('fields', ClioAPIClient.MATTER_DETAIL_FIELDS)
    customFieldIds.forEach((id) => matterParams.append('custom_field_ids[]', String(id)))
    const matterRes = await this.makeRequest(`/matters/${match.id}?${matterParams.toString()}`)
    if (matterRes.error) return { data: null, error: matterRes.error }
    const matterBody = matterRes.data as { data?: Record<string, unknown> }
    const matter = matterBody?.data ?? null
    if (!matter) return { data: null }

    const clientId =
      (matter.client_id as number | undefined) ??
      (matter.client != null && typeof matter.client === 'object' && 'id' in matter.client
        ? (matter.client as { id?: number }).id
        : undefined)
    if (clientId != null) {
      const activityRatesRes = await this.getActivityRates({
        contact_id: clientId,
        limit: 200,
        fields: 'id,etag,rate,flat_rate,created_at,updated_at,contact_id,co_counsel_contact_id,user{id,etag,name,first_name,last_name,email},group{id,etag,name,type}'
      })
      if (!activityRatesRes.error && activityRatesRes.data != null) {
        const activityRatesData = activityRatesRes.data as { data?: unknown[] }
        const list = Array.isArray(activityRatesData?.data) ? activityRatesData.data : []
        let customRate = matter.custom_rate as Record<string, unknown> | undefined
        if (customRate == null || typeof customRate !== 'object') {
          matter.custom_rate = customRate = {}
        }
        customRate.activity_rates = list
      }
    }
    return { data: matter }
  }

  /** Bill order options per Clio API (e.g. id(asc), issued_at(desc)). */
  async getBills(params?: {
    matter_id?: number
    order?: string
    fields?: string
    limit?: number
    offset?: number
    page_token?: string
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()

    if (params?.matter_id != null) queryParams.append('matter_id', String(params.matter_id))
    if (params?.order) queryParams.append('order', params.order)
    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.limit != null) queryParams.append('limit', String(params.limit))
    if (params?.offset != null) queryParams.append('offset', String(params.offset))
    if (params?.page_token) queryParams.append('page_token', params.page_token)

    const query = queryParams.toString()
    const endpoint = query ? `/bills.json?${query}` : '/bills.json'

    return await this.makeRequest(endpoint)
  }

  /**
   * Resolve matter display_number to matter id, then fetch bills for that matter (latest issued first).
   * Returns id, number, and type for each bill.
   */
  async getBillsByMatterDisplayNumber(displayNumber: string): Promise<{
    data: Array<{ id: number; number?: string; type?: string }>
    error?: string
  }> {
    const matterRes = await this.getMatterByDisplayNumber(displayNumber)
    if (matterRes.error) return { data: [], error: matterRes.error }
    const matter = matterRes.data
    if (!matter || matter.id == null) return { data: [], error: 'Matter not found' }
    const matterId = matter.id as number
    const results: Array<{ id: number; number?: string; type?: string }> = []
    let pageToken: string | null = null
    const limit = 200
    do {
      const res = await this.getBills({
        matter_id: matterId,
        order: 'issued_at(desc)',
        limit,
        fields: 'id,number,type',
        page_token: pageToken ?? undefined
      })
      if (res.error) return { data: results.length ? results : [], error: res.error }
      const body = res.data as { data?: Array<{ id: number; number?: string; type?: string }>; meta?: { paging?: { next_page_token?: string } } }
      const page = body?.data ?? []
      for (const b of page) {
        if (b?.id != null) results.push({ id: b.id, number: b.number, type: b.type })
      }
      const next = body?.meta?.paging?.next_page_token ?? (body?.meta as { next_page_token?: string })?.next_page_token ?? null
      pageToken = next && page.length === limit ? next : null
    } while (pageToken)
    return { data: results }
  }

  /** Bill fields for getBillById – all fields up to first level of nesting. */
  private static readonly BILL_DETAIL_FIELDS = [
    'id', 'etag', 'number', 'issued_at', 'created_at', 'due_at', 'tax_rate', 'secondary_tax_rate',
    'updated_at', 'subject', 'purchase_order', 'type', 'memo', 'start_at', 'end_at', 'balance', 'state',
    'kind', 'total', 'paid', 'paid_at', 'pending', 'due', 'discount_services_only', 'can_update',
    'credits_issued', 'shared', 'last_sent_at', 'services_secondary_tax', 'services_sub_total',
    'services_tax', 'services_taxable_sub_total', 'services_secondary_taxable_sub_total',
    'taxable_sub_total', 'secondary_taxable_sub_total', 'sub_total', 'tax_sum', 'secondary_tax_sum',
    'total_tax', 'available_state_transitions',
    'user{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'client{id,etag,name,first_name,middle_name,last_name,date_of_birth,type,created_at,updated_at,prefix,title,initials,clio_connect_email,locked_clio_connect_email,client_connect_user_id,primary_email_address,secondary_email_address,primary_phone_number,secondary_phone_number,ledes_client_id,has_clio_for_clients_permission,is_client,is_clio_for_client_user,is_co_counsel,is_bill_recipient,sales_tax_number,currency}',
    'discount{rate,type,note,early_payment_rate,early_payment_period}',
    'interest{balance,period,rate,total,type}',
    'matters{id,etag,number,display_number,custom_number,currency,description,status,location,client_reference,client_id,billable,maildrop_address,billing_method,open_date,close_date,pending_date,created_at,updated_at,shared,has_tasks,last_activity_date,matter_stage_updated_at}',
    'group{client_connect_user,etag,id,name,type,updated_at}',
    'bill_theme{id,etag,created_at,updated_at,account_id,default,name,config}',
    'original_bill{id,etag,number,issued_at,created_at,due_at,tax_rate,secondary_tax_rate,updated_at,subject,purchase_order,type,memo,start_at,end_at,balance,state,kind,total,paid,paid_at,pending,due,discount_services_only,can_update,credits_issued,shared,last_sent_at,services_secondary_tax,services_sub_total,services_tax,services_taxable_sub_total,services_secondary_taxable_sub_total,taxable_sub_total,secondary_taxable_sub_total,sub_total,tax_sum,secondary_tax_sum,total_tax,available_state_transitions}',
    'destination_account{account_number,balance,bank_transactions_count,clio_payment_page_link,clio_payment_page_qr_code,clio_payments_enabled,controlled_account,created_at,currency,currency_symbol,currency_id,default_account,domicile_branch,etag,general_ledger_number,holder,id,institution,name,swift,transit_number,type,updated_at}',
    'balances{id,amount,type,interest_amount,due}',
    'matter_totals{id,amount}',
    'currency{id,etag,code,sign,created_at,updated_at}',
    'billing_setting{id,etag,rounded_duration,rounding,use_decimal_rounding,currency,currency_sign,tax_rate,tax_name,apply_tax_by_default,apply_secondary_tax_by_default,time_on_flat_rate_contingency_matters_is_non_billable,use_secondary_tax,secondary_tax_rate,secondary_tax_rule,secondary_tax_name,notify_after_bill_created,use_utbms_codes,created_at,updated_at,multi_currency_billing}',
    'client_addresses{id,etag,street,city,province,postal_code,country,name,created_at,updated_at,primary}',
    'legal_aid_uk_bill{additional_travel_payment,adjourned_hearing_fee,advocacy_costs,advice_time,bill_type,case_concluded,case_stage_level,cla_exemption_code,cla_reference,cmrh_oral,cmrh_telephone,cost_of_counsel,costs_are_those_of,court_location,date_of_claim,designated_accredited_representative,detention_travel_and_waiting_costs,disbursements_vat,exceptional_case_funding_reference,exemption_criteria_satisfied,fee_code,follow_on_work,ho_interview,ho_ucn,id,independent_medical_reports_claimed,jr_form_filling,maat_id,meetings_attended,mht_ref_no,net_disbursements,net_profit_costs,niat_disbursement_prior_authority_number,number_of_attendances,outcome_for_the_client,profit_costs_ex_vat,prior_authority_reference,representation_order_date,stage_reached,substantive_hearing,travel_and_waiting_costs,travel_time,value_of_costs,waiting_time}',
    'split_invoice{id,bill_id,linked_invoices_display_numbers,linked_invoices_ids,split_connection_id,split_portion,etag,created_at,updated_at}'
  ].join(',')

  /**
   * GET /bills/{id}.json – fetch a single bill by id with full fields.
   */
  async getBillById(id: number): Promise<{ data: Record<string, unknown> | null; error?: string }> {
    const res = await this.makeRequest(
      `/bills/${id}.json?fields=${encodeURIComponent(ClioAPIClient.BILL_DETAIL_FIELDS)}`
    )
    if (res.error) return { data: null, error: res.error }
    const body = res.data as { data?: Record<string, unknown> }
    return { data: body?.data ?? null }
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

  /**
   * GET /activities – list activities with optional filters (e.g. matter_id).
   * order: e.g. "date(desc)" for latest first.
   */
  async getActivities(params?: {
    matter_id?: number
    order?: string
    limit?: number
    fields?: string
    page_token?: string
  }): Promise<{ data: unknown; error?: string }> {
    const queryParams = new URLSearchParams()
    if (params?.matter_id != null) queryParams.append('matter_id', String(params.matter_id))
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit != null) queryParams.append('limit', String(params.limit))
    if (params?.fields) queryParams.append('fields', params.fields)
    if (params?.page_token) queryParams.append('page_token', params.page_token)
    const qs = queryParams.toString()
    const endpoint = qs ? `/activities?${qs}` : '/activities'
    return await this.makeRequest(endpoint)
  }

  /**
   * Resolve matter display_number to matter id, then fetch activities for that matter (latest to oldest).
   * Returns id and note (first 10 chars of note used in UI).
   */
  async getActivityIdsByMatterDisplayNumber(displayNumber: string): Promise<{
    data: Array<{ id: number; note?: string }>
    error?: string
  }> {
    const listRes = await this.getMatters({
      query: displayNumber,
      limit: 50,
      fields: 'id,display_number'
    })
    if (listRes.error) return { data: [], error: listRes.error }
    const listBody = listRes.data as { data?: Array<{ id: number; display_number?: string }> }
    const items = listBody?.data ?? []
    const match = items.find((m) => String(m.display_number) === String(displayNumber))
    if (!match) {
      return { data: [], error: `No matter found with display_number: ${displayNumber}` }
    }
    const results: Array<{ id: number; note?: string }> = []
    let pageToken: string | null = null
    const limit = 200
    do {
      const res = await this.getActivities({
        matter_id: match.id,
        order: 'date(desc)',
        limit,
        fields: 'id,note',
        page_token: pageToken ?? undefined
      })
      if (res.error) return { data: results.length ? results : [], error: res.error }
      const body = res.data as { data?: Array<{ id: number; note?: string }>; meta?: { paging?: { next_page_token?: string } } }
      const page = body?.data ?? []
      for (const a of page) {
        if (a?.id != null) results.push({ id: a.id, note: a.note })
      }
      const next = body?.meta?.paging?.next_page_token ?? (body?.meta as { next_page_token?: string })?.next_page_token ?? null
      pageToken = next && page.length === limit ? next : null
    } while (pageToken)
    return { data: results }
  }

  /** Activity fields for getActivityById (single-level nesting only). */
  private static readonly ACTIVITY_DETAIL_FIELDS = [
    'id', 'etag', 'type', 'date', 'quantity_in_hours', 'rounded_quantity_in_hours', 'quantity', 'rounded_quantity',
    'quantity_redacted', 'price', 'note', 'flat_rate', 'billed', 'on_bill', 'total', 'contingency_fee',
    'created_at', 'updated_at', 'reference', 'non_billable', 'non_billable_total', 'no_charge', 'tax_setting',
    'currency{id,etag,code,sign,created_at,updated_at}',
    'activity_description{id,etag,name,visible_to_co_counsel,created_at,updated_at,default,type,utbms_activity_id,utbms_task_name,utbms_task_id,xero_service_code,accessible_to_user,category_type,currency}',
    'expense_category{id,etag,name,rate,entry_type,created_at,updated_at,xero_expense_code,accessible_to_user,currency,tax_setting}',
    'bill{id,etag,number,issued_at,created_at,due_at,tax_rate,secondary_tax_rate,updated_at,subject,purchase_order,type,memo,start_at,end_at,balance,state,kind,total,paid,paid_at,pending,due,discount_services_only,can_update,credits_issued,shared,last_sent_at,services_secondary_tax,services_sub_total,services_tax,services_taxable_sub_total,services_secondary_taxable_sub_total,taxable_sub_total,secondary_taxable_sub_total,sub_total,tax_sum,secondary_tax_sum,total_tax,available_state_transitions}',
    'communication{id,etag,subject,body,type,date,time_entries_count,created_at,updated_at,received_at}',
    'client_portal{id,etag,created_at,updated_at,unread_count,unread_notifiable_count}',
    'matter{id,etag,number,display_number,custom_number,currency,description,status,location,client_reference,client_id,billable,maildrop_address,billing_method,open_date,close_date,pending_date,created_at,updated_at,shared,has_tasks,last_activity_date,matter_stage_updated_at}',
    'matter_note{id,etag,type,subject,detail,detail_text_type,date,created_at,updated_at,time_entries_count}',
    'contact_note{id,etag,type,subject,detail,detail_text_type,date,created_at,updated_at,time_entries_count}',
    'subject{id,type,identifier,secondary_identifier,tertiary_identifier}',
    'user{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
    'vendor{id,etag,name,first_name,middle_name,last_name,date_of_birth,type,created_at,updated_at,prefix,title,initials,clio_connect_email,locked_clio_connect_email,client_connect_user_id,primary_email_address,secondary_email_address,primary_phone_number,secondary_phone_number,ledes_client_id,has_clio_for_clients_permission,is_client,is_clio_for_client_user,is_co_counsel,is_bill_recipient,sales_tax_number,currency}',
    'timer{id,etag,start_time,elapsed_time,created_at,updated_at}',
    'utbms_expense{id,etag,name,code,description,type,utbms_set_id,created_at,updated_at}',
    'task{id,etag}',
    'text_message_conversation{id,etag}',
    'document_version{id,document_id,etag,uuid,created_at,updated_at,filename,size,version_number,content_type,received_at,put_url,fully_uploaded}',
    'calendar_entry{id,etag,calendar_owner_id}',
    'legal_aid_uk_activity{activity_sub_category,advocacy,base_rate,bolt_ons,bolt_ons_summary,court,eligible_for_sqm,expert,form_of_civil_legal_service,id,is_custom_rate,json_key,region,tax_exclusive,uplift,user_type}'
  ].join(',')

  /**
   * GET /activities/{id} – fetch a single activity by id with full fields.
   */
  async getActivityById(id: number): Promise<{ data: Record<string, unknown> | null; error?: string }> {
    const res = await this.makeRequest(`/activities/${id}?fields=${encodeURIComponent(ClioAPIClient.ACTIVITY_DETAIL_FIELDS)}`)
    if (res.error) return { data: null, error: res.error }
    const body = res.data as { data?: Record<string, unknown> }
    return { data: body?.data ?? null }
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
