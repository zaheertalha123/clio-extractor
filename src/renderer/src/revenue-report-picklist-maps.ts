/**
 * Clio picklist option id → display label for Matter custom fields (revenue report).
 * Keys are picklist_option ids from the API; values match Clio's option strings.
 */
const PICKLIST_OPTION_ID_TO_LABEL: Readonly<Record<number, string>> = {
  // Originator 1 % (field 15306307)
  8795257: '25%',
  8795272: '20%',
  8795287: '15%',
  8795302: '10%',
  // Managing (field 14739022)
  8493907: 'Darren Enenstein',
  8493922: 'Peter Fischer',
  8493937: 'Ryan Wenger',
  8493952: 'David Ribakoff',
  8493967: 'Teri Pham',
  8493982: 'Ruth Lynn Estep',
  8493997: 'Robert Rabbat',
  8494012: 'David Glass',
  8494027: 'EPG',
  8494042: 'Salvador P. LaVina',
  8494057: 'Burak Ahmed',
  8494072: 'William Small',
  8494087: 'Connolly Oyler',
  8494102: 'Jennifer Skolnick',
  8494117: 'Akimi Nakagawa',
  8494132: 'Ryan Del Giorgio',
  8494147: 'Michael Rosenthal',
  8494162: 'Suneel J. Nelson',
  8494177: 'Simon Newfield',
  8494192: 'Courtney Havens',
  8494207: 'Ruth Dayan Eget',
  8494222: 'Ned Gelhaar',
  8494237: 'Chris Pacetti',
  8494252: 'Daniel R. Gutenplan',
  8494267: 'Aja M Taormina',
  8494282: 'Nima Kamali',
  8494297: 'Doug Lipstone',
  8494312: 'Pam Bille',
  8494327: 'Richard Wirick',
  // Bill Cycle (field 14760022)
  8503672: 'Monthly ',
  8503687: 'Bi-Monthly ',
  // Billing_Frequency (field 14935582)
  8602672: 'Q1 (Jan, Apr, Jul, Oct)',
  8602687: 'Monthly',
  8602702: 'Mid Monthly',
  // BIll Theme (field 15012907)
  8625622: 'CA LLP Bill Theme',
  8625637: 'NV LLP Bill Theme',
  // Originating Attorney 2 (field 15306352)
  8795317: 'Teri Pham',
  8795332: 'Jesse Bolling',
  8795347: 'Lauri Martin',
  8795362: 'Robert Rabbat',
  8795377: 'Carole Azran',
  8795392: 'Erin Grey',
  8795407: 'William Small',
  8795422: 'Thang Le',
  8795437: 'Richard Schaefer',
  8795452: 'Daniel Gutenplan',
  8795467: 'Darren Enenstein',
  8795482: 'Michael Pinto',
  8795497: 'David Glass',
  8795512: 'Howard Kern',
  8795527: 'Ned Gelhaar',
  8795542: 'Dina Randazzo',
  8795557: 'Elizabeth Peterson',
  8795572: 'Yass Sepidnameh',
  8795587: 'Silvana Naguib',
  8795602: 'Paul Toepel Jr.',
  8795617: 'Kristen Tsaklis',
  8795632: 'Dorie Rogers',
  8795647: 'Karoleen Tekin',
  8795662: 'Nikki Hart',
  8795677: 'Ruth Eget',
  8795692: 'Neeloufar Mahrouyan',
  8795707: 'Matthew Rosene',
  8795722: 'Isolde Moore',
  8795737: 'Bao Pham',
  8795752: 'Stephen Rafferty',
  // Originator 2 % (field 15306367)
  8795767: '25%',
  8795782: '20%',
  8795797: '15%',
  8795812: '10%',
  // Responsible 1 % (field 15306382)
  8795827: '5%',
  8795842: '10%',
  8795857: '15%',
  8795872: '20%',
  // Responsible Attorney 2 (field 15306667)
  8795887: 'Teri Pham',
  8795902: 'Jesse Bolling',
  8795917: 'Lauri Martin',
  8795932: 'Robert Rabbat',
  8795947: 'Carole Azran',
  8795962: 'Erin Grey',
  8795977: 'William Small',
  8795992: 'Thang Le',
  8796007: 'Richard Schaefer',
  8796022: 'Daniel Gutenplan',
  8796037: 'Darren Enenstein',
  8796052: 'Michael Pinto',
  8796067: 'David Glass',
  8796082: 'Howard Kern',
  8796097: 'Ned Gelhaar',
  8796112: 'Dina Randazzo',
  8796127: 'Elizabeth Peterson',
  8796142: 'Yass Sepidnameh',
  8796157: 'Silvana Naguib',
  8796172: 'Paul Toepel Jr.',
  8796187: 'Kristen Tsaklis',
  8796202: 'Dorie Rogers',
  8796217: 'Karoleen Tekin',
  8796232: 'Nikki Hart',
  8796247: 'Ruth Eget',
  8796262: 'Neeloufar Mahrouyan',
  8796277: 'Matthew Rosene',
  8796292: 'Isolde Moore',
  8796307: 'Bao Pham',
  8796322: 'Stephen Rafferty',
  // Responsible 2 % (field 15306682)
  8796337: '5%',
  8796352: '10%',
  8796367: '15%',
  8796382: '20%',
  // Office Location (field 16729658)
  9373163: 'LA',
  9373178: 'OC',
  9373193: 'NV'
}

export function resolvePicklistOptionLabel(
  picklistOptionId: number | string | undefined | null
): string | undefined {
  if (picklistOptionId == null || picklistOptionId === '') {
    return undefined
  }
  const n = typeof picklistOptionId === 'string' ? Number(picklistOptionId) : picklistOptionId
  if (!Number.isFinite(n)) {
    return undefined
  }
  return PICKLIST_OPTION_ID_TO_LABEL[n]
}
