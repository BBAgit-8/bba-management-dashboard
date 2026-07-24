// ────────────────────────────────────────────────────────────────────────────
// Pricing sheet constants — single source of truth for hour budgeting.
//
// When Dawn's pricing sheet changes, this is the one file to update.
// If a formula ever needs to be exposed to non-devs, promote these
// constants into a `pricing_config` table — but until then a plain
// module is faster to change and safer than a DB config would be.
// ────────────────────────────────────────────────────────────────────────────

// Bank-feed time by monthly-transaction bracket (hrs/mo).
// 8 buckets — matches pricing sheet Image 3.
export const BANK_FEED_HRS: Record<string, number> = {
  '0-100':    0.833,
  '101-200':  1.667,
  '201-300':  2.5,
  '301-400':  3.333,
  '401-500':  4.167,
  '501-750':  6.25,
  '751-1000': 8.333,
  '1000+':    10,
}

// Rec-time coefficients per item type (hrs/mo per unit).
// Pricing sheet Image 2.
export const REC_HRS_PER_BANK_OR_CC   = 0.3574
export const REC_HRS_PER_LOAN         = 0.1787
export const REC_HRS_PER_PMT_PORTAL   = 0.5956

// Audit support — annual hours. Divide by 12 for the monthly slice.
// Pricing sheet Image 1.
export const WC_AUDIT_ANNUAL_HRS     = 2.472
export const ANNUAL_AUDIT_ANNUAL_HRS = 20

// Annual 1099s — annual hours by count bracket. Divide by 12 for monthly.
// Pricing sheet Image 1.
export const ANNUAL_1099_HRS: Record<string, number> = {
  '0':      0,
  '1-5':    0.774,
  '6-10':   1.549,
  '11-20':  2.382,
  '21-30':  3.216,
  '31-50':  4.288,
  '51-75':  5.717,
  '76-100': 7.505,
  '101+':   9.887,
}

// QA / CS / YE tier — Dawn's rule: same hours for all three, based on total
// monthly hours (not just bkpr).
//   0–10 total → 0.25
//   11–20      → 0.50
//   21+        → 0.75
export function tierFor(totalHrs: number): number {
  if (totalHrs <= 10) return 0.25
  if (totalHrs <= 20) return 0.5
  return 0.75
}

// ────────────────────────────────────────────────────────────────────────────
// The main calc.
//
// Inputs:
//   - transactionsPerMonth: range key (e.g. '101-200')
//   - numBanksAndCCs / numLoans / numPmtPortals: item counts
//   - bkprHours: user-entered bookkeeper container hours. INCLUDES bank feed,
//     rec, and AR — user manages that split themselves.
//   - wcAuditSupport / annualAuditSupport: Y/N
//   - annual1099sRange: range key (e.g. '11-20')
//
// Outputs: monthly hour values for every derivable field.
//   The tier depends on total hours; since QA/CS/YE add to the total, there's
//   a mild circular dependency. Resolved by iterating up to 3 times — the
//   tier boundaries are 10 and 20, and 3 × tier is at most 2.25 hrs, so
//   convergence is quick.
//
// bkprHours is passed through unchanged (it's a user input, not derived).
// apArHrs is not touched at all — it stays wherever the user entered it, and
// is conceptually included inside bkprHours per current business rule.
// ────────────────────────────────────────────────────────────────────────────
export interface HourCalcInputs {
  transactionsPerMonth: string | null
  numBanksAndCCs:       number
  numLoans:             number
  numPmtPortals:        number
  bkprHours:            number
  wcAuditSupport:       boolean
  annualAuditSupport:   boolean
  annual1099sRange:     string | null
}

export interface HourCalcResult {
  bankFeedTime:        number
  recTime:             number
  auditHours:          number
  qaHours:             number
  custSuccessMgmtHrs:  number
  yeOrTaxHours:        number
  totalHrsPerMonth:    number
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

// Lightweight helper for callers that only need the two "bank operations"
// hour figures — no dependency on bkprHours, audit toggles, or 1099 range.
// Used by the client list's inline-edit flow so editing raw counts flows
// straight into the derived time fields without opening the detail page.
export function computeBankAndRecTime(input: {
  transactionsPerMonth: string | null
  numBanksAndCCs:       number
  numLoans:             number
  numPmtPortals:        number
}): { bankFeedTime: number; recTime: number } {
  const bankFeedTime = input.transactionsPerMonth
    ? (BANK_FEED_HRS[input.transactionsPerMonth] ?? 0)
    : 0
  const recTime =
      REC_HRS_PER_BANK_OR_CC * (input.numBanksAndCCs || 0)
    + REC_HRS_PER_LOAN       * (input.numLoans        || 0)
    + REC_HRS_PER_PMT_PORTAL * (input.numPmtPortals   || 0)
  return { bankFeedTime: round2(bankFeedTime), recTime: round2(recTime) }
}

export function computeHours(input: HourCalcInputs): HourCalcResult {
  const bankFeedTime = input.transactionsPerMonth
    ? (BANK_FEED_HRS[input.transactionsPerMonth] ?? 0)
    : 0

  const recTime =
      REC_HRS_PER_BANK_OR_CC * (input.numBanksAndCCs || 0)
    + REC_HRS_PER_LOAN       * (input.numLoans        || 0)
    + REC_HRS_PER_PMT_PORTAL * (input.numPmtPortals   || 0)

  const annualAudit =
      (input.wcAuditSupport     ? WC_AUDIT_ANNUAL_HRS     : 0)
    + (input.annualAuditSupport ? ANNUAL_AUDIT_ANNUAL_HRS : 0)
  const auditHours = annualAudit / 12

  const annual1099Hours = input.annual1099sRange
    ? (ANNUAL_1099_HRS[input.annual1099sRange] ?? 0)
    : 0
  const monthly1099Hours = annual1099Hours / 12

  // bkprHours already contains bankFeed + rec + AR — don't add them again.
  // Iterate the tier: tier depends on total, total depends on tier.
  const bkpr = input.bkprHours || 0
  let tier = tierFor(bkpr + auditHours + monthly1099Hours) // initial guess
  for (let i = 0; i < 3; i++) {
    // ye = tier + monthly1099 (1099 hours land in YE)
    const est = bkpr + auditHours + tier + tier + (tier + monthly1099Hours)
    const next = tierFor(est)
    if (next === tier) break
    tier = next
  }

  const qaHours            = tier
  const custSuccessMgmtHrs = tier
  const yeOrTaxHours       = tier + monthly1099Hours
  const totalHrsPerMonth   = bkpr + qaHours + custSuccessMgmtHrs + yeOrTaxHours + auditHours

  return {
    bankFeedTime:       round2(bankFeedTime),
    recTime:            round2(recTime),
    auditHours:         round2(auditHours),
    qaHours:            round2(qaHours),
    custSuccessMgmtHrs: round2(custSuccessMgmtHrs),
    yeOrTaxHours:       round2(yeOrTaxHours),
    totalHrsPerMonth:   round2(totalHrsPerMonth),
  }
}
