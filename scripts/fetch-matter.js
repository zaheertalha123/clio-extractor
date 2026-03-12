#!/usr/bin/env node
/**
 * Standalone script to fetch a matter from Clio API by display_number.
 * Reads CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, REFRESH_TOKEN from .env (project root).
 * Refreshes the access token, looks up the matter by display_number, then fetches full matter.
 *
 * Usage: node scripts/fetch-matter.js [display_number]
 * Default display_number: 16420.001
 */

const fs = require('fs')
const path = require('path')

const DISPLAY_NUMBER = process.argv[2] || '16420.001'
const ROOT = path.join(__dirname, '..')
const ENV_FILE = path.join(ROOT, '.env')
const TOKEN_URL = 'https://app.clio.com/oauth/token'
const MATTERS_LIST_URL = 'https://app.clio.com/api/v4/matters.json'

// All matter fields + one-level nested (per Clio API: second-level nested return defaults only)
const MATTER_FIELDS = [
  'id', 'etag', 'number', 'display_number', 'custom_number', 'description', 'status', 'location',
  'client_reference', 'client_id', 'billable', 'maildrop_address', 'billing_method', 'open_date',
  'close_date', 'pending_date', 'created_at', 'updated_at', 'shared', 'has_tasks', 'last_activity_date',
  'matter_stage_updated_at',
  'currency{id,etag,code,sign,created_at,updated_at}',
  'client{id,etag,name,first_name,middle_name,last_name,date_of_birth,type,created_at,updated_at,prefix,title,initials,clio_connect_email,locked_clio_connect_email,client_connect_user_id,primary_email_address,secondary_email_address,primary_phone_number,secondary_phone_number,ledes_client_id,has_clio_for_clients_permission,is_client,is_clio_for_client_user,is_co_counsel,is_bill_recipient,sales_tax_number}',
  'contingency_fee{id,etag,created_at,updated_at,show_contingency_award}',
  'custom_rate{type,on_invoice,rates}',
  'evergreen_retainer{id,created_at,updated_at,etag,minimum_threshold}',
  'folder{id,etag,created_at,updated_at,deleted_at,type,locked,name,root}',
  'group{client_connect_user,etag,id,name,type,updated_at}',
  'matter_budget{id,etag,budget,include_expenses,notification_threshold,notify_users,created_at,updated_at}',
  'matter_stage{id,etag,practice_area_id,name,order,created_at,updated_at}',
  'originating_attorney{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
  'practice_area{id,etag,created_at,updated_at,name,category,code}',
  'responsible_attorney{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
  'responsible_staff{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
  'statute_of_limitations{id,etag,name,status,description,description_text_type,priority,due_at,permission,completed_at,notify_completion,statute_of_limitations,time_estimated,created_at,updated_at,time_entries_count}',
  'user{account_owner,clio_connect,court_rules_default_attendee,created_at,default_calendar_id,email,enabled,etag,first_name,id,initials,last_name,name,phone_number,rate,roles,subscription_type,time_zone,updated_at}',
  'attorney_allocation{id,etag,account_id,resource_id,resource_type,originating_attorney_allocation,responsible_attorney_allocation,created_at,updated_at}',
  'account_balances{id,balance,type,name,currency_id}',
  'custom_field_values{id,etag,field_name,created_at,updated_at,field_type,field_required,field_displayed,field_display_order,value,soft_deleted,custom_field,picklist_option,matter,contact}',
  'custom_field_set_associations{id,etag,display_order,created_at,updated_at}',
  'matter_bill_recipients{created_at,etag,id,updated_at,recipient}',
  'relationships{id,etag,description,created_at,updated_at}',
  'task_template_list_instances{id,etag,created_at,updated_at}',
  'kyc_field_values{id,etag,field_name,field_label,created_at,updated_at,field_type,field_value,field_possible_values,group}',
  'split_invoice_payers{id,contact_id,matter_id,send_to_bill_recipients,split_portion,etag,created_at,updated_at}'
].join(',')

// legal_aid_uk_matter has many fields; request top-level (API returns defaults for nested)
const LEGAL_AID_UK_FIELDS = 'legal_aid_uk_matter{access_point,laa_office_number,ait_hearing_centre,attended_several_hearings_acting_for_multiple_clients,bill_ho_ucn,bill_number_of_attendances,bill_outcome_for_the_client_code,bill_stage_reached_code,case_reference,case_start_date,category,category_as_string,certificate_effective_date,certificate_expiration_date,certificate_number,certificate_scope,certification_type,change_of_solicitor,client_equal_opportunity_monitoring,client_type,clr_start_date,clr_total_profit_costs,cost_limit,counsel,court,court_id,court_id_code,created_at,delivery_location,dscc_number,duty_solicitor,etag,exceptional_case_funding_reference,expense_limit,fee_scheme,first_conducting_solicitor,id,irc_surgery,legacy_case,legal_representation_number,lh_total_disbursements,lh_start_date,lh_total_profit_costs,linked_matter_id,local_authority_number,maat_id,matter_type,matter_type_code,matter_type_1,matter_type_1_code,matter_type_1_title,matter_type_2,matter_type_2_code,matter_type_2_title,matter_types_combined,number_of_clients_seen_at_surgery,number_of_clients,party,police_station,post_transfer_clients_represented,postal_application_accepted,prior_authority_reference,prison_id,prison_law_prior_approval_number,procurement_area,region,related_claims_number,representation_order_date,schedule_reference_number,scheme_id,session_type,solicitor_type,standard_fee_category,surgery_clients_resulting_in_a_legal_help_matter_opened,surgery_clients,surgery_date,transfer_date,type_of_advice,type_of_service,ucn,ufn,undesignated_area_court,updated_at,user_type,youth_court}'

const MATTER_FIELDS_FULL = [MATTER_FIELDS, LEGAL_AID_UK_FIELDS].join(',')

function parseEnv(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) env[key] = value.slice(1, -1)
    else env[key] = value
  }
  return env
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }).toString()

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.access_token
}

async function findMatterIdByDisplayNumber(accessToken) {
  const params = new URLSearchParams()
  params.set('query', DISPLAY_NUMBER)
  params.set('limit', '50')
  params.set('fields', 'id,display_number')
  const url = `${MATTERS_LIST_URL}?${params.toString()}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.error('API error (list matters):', res.status, res.statusText)
    const text = await res.text()
    console.error(text)
    process.exit(1)
  }

  const body = await res.json()
  const data = body.data || []
  const match = data.find((m) => String(m.display_number) === String(DISPLAY_NUMBER))
  if (!match) {
    console.error('No matter found with display_number:', DISPLAY_NUMBER)
    if (data.length > 0) {
      console.error('Query returned', data.length, 'matter(s); display_numbers:', data.map((m) => m.display_number).join(', '))
    }
    process.exit(1)
  }
  return match.id
}

async function fetchMatterById(accessToken, matterId) {
  const url = `https://app.clio.com/api/v4/matters/${matterId}.json?fields=${encodeURIComponent(MATTER_FIELDS_FULL)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.error('API error (get matter):', res.status, res.statusText)
    const text = await res.text()
    console.error(text)
    process.exit(1)
  }

  return res.json()
}

async function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('.env not found at:', ENV_FILE)
    process.exit(1)
  }

  const env = parseEnv(ENV_FILE)
  const clientId = env.CLIO_CLIENT_ID
  const clientSecret = env.CLIO_CLIENT_SECRET
  const refreshToken = env.REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('.env must contain CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, and REFRESH_TOKEN')
    process.exit(1)
  }

  console.error('Refreshing access token...')
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken)
  console.error('Looking up matter by display_number:', DISPLAY_NUMBER, '...')
  const matterId = await findMatterIdByDisplayNumber(accessToken)
  console.error('Found matter id:', matterId, '- fetching full matter...')
  const data = await fetchMatterById(accessToken, matterId)
  console.log(JSON.stringify(data, null, 2))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
