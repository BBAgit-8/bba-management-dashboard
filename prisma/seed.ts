/**
 * Prisma seed — management-dashboard
 *
 * Generates:
 *  • 3 employees (20 % admin buffer each, unique hourly rates)
 *  • 8 colour-coded tags
 *  • 76 normal clients  (alternating FLAT / HOURLY, diverse metadata)
 *  •  4 violation clients that intentionally trip "Needs Attention" alerts:
 *       #77 Redstone Advisory Group   — FLAT, 181 % budget overrun  (CRITICAL)
 *       #78 Hawthorne Financial Svcs  — HOURLY, accrued hours 68 % over SOW target
 *       #79 Pinecrest Holdings LLC    — FLAT, price adjustment 63 days overdue
 *       #80 Summit Peak Capital Mgmt  — HOURLY, SOW unrefined with active hours logged
 */

import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg }     from '@prisma/adapter-pg'
import pg               from 'pg'

// Seed uses a direct TCP connection to local Prisma Postgres (port 51214).
// The accelerated prisma+postgres:// URL is for runtime; the raw postgres://
// URL from DIRECT_DATABASE_URL is required by the pg adapter during seeding.
const pool   = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─────────────────────────────────────────────────────────────────────────────
// Seed constants
// ─────────────────────────────────────────────────────────────────────────────

// 76 company prefixes — each generates a unique name via pick(SUFFIXES, i)
const PREFIXES = [
  'Acorn', 'Atlas', 'Beacon', 'Birch', 'Blue Ridge', 'Brightfield',
  'Cedar Hill', 'Clearwater', 'Coastal', 'Copper Creek', 'Crestwood', 'Crown',
  'Crystal Bay', 'Delta', 'Diamond Ridge', 'Eagle Rock', 'Elm Street', 'Emerald',
  'Empire', 'Falcon', 'Fernwood', 'Forest Ridge', 'Frost', 'Granite Peak',
  'Harbor View', 'Haven', 'Highland', 'Horizon', 'Iron Bridge', 'Ivory Tower',
  'Jade River', 'Jasper', 'Kestrel', 'Keystone', 'Larchmont', 'Lark',
  'Laurel Canyon', 'Liberty', 'Lincoln', 'Maple Grove', 'Meadow Creek', 'Mesa',
  'Midland', 'Monarch', 'Mosaic', 'Mountain Peak', 'Noble', 'Northgate',
  'Oak Valley', 'Onyx', 'Orion', 'Pacific Rim', 'Pebble Creek', 'Pine Valley',
  'Pioneer', 'Platinum', 'Premier', 'Prism', 'Quantum', 'Quartz Ridge',
  'Ridgeline', 'Riverstone', 'Rock Creek', 'Royal Oak', 'Ruby Mountain', 'Sage',
  'Silver Lake', 'Skyline', 'Solar', 'Solid Ground', 'Southfield', 'Sparrow',
  'Sterling Oak', 'Stonegate', 'Summit View', 'Swift River',
] as const  // exactly 76

const SUFFIXES = [
  'Advisory', 'Associates', 'Capital', 'Consulting',
  'Financial', 'Group', 'Holdings', 'Management',
  'Partners', 'Services', 'Solutions', 'Ventures',
]

const ACCOUNTANTS  = ['Sarah Johnson', 'Mike Chen', 'Priya Patel']

// Weighted cadence pool — MONTHLY is most common in a real book of business
const CADENCES = [
  'MONTHLY', 'MONTHLY', 'MONTHLY', 'MONTHLY', 'MONTHLY',
  'BIWEEKLY', 'BIWEEKLY', 'BIWEEKLY',
  'WEEKLY', 'WEEKLY',
  'QUARTERLY',
] as const

const DEADLINES        = [5, 10, 12, 15, 18, 20, 22, 25, 28]
const FLAT_RATES       = [1800, 2200, 2500, 2800, 3000, 3200, 3500, 4000, 4500, 5000, 5500, 6000]
const HOURLY_RATES     = [100, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 165, 175]
const TARGET_HRS_FLAT  = [20, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50, 55, 60]
const TARGET_HRS_HRLY  = [10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 40]
const PRICE_INC_PCT    = [2.0, 2.5, 3.0, 3.0, 3.5, 3.5, 4.0, 4.5, 5.0]

const TAGS = [
  { name: 'High Touch',       color: '#8B5CF6' },
  { name: 'Clean-up',         color: '#F97316' },
  { name: 'Tax Season',       color: '#F59E0B' },
  { name: 'New Client',       color: '#10B981' },
  { name: 'Priority',         color: '#EF4444' },
  { name: 'Quarterly Review', color: '#3B82F6' },
  { name: 'VIP',              color: '#EC4899' },
  { name: 'Advisory Only',    color: '#14B8A6' },
]

const SOFTWARE = [
  { softwareName: 'QuickBooks Online', tier: 'Plus',         ourCost: 40, clientPrice: 65  },
  { softwareName: 'QuickBooks Online', tier: 'Advanced',     ourCost: 90, clientPrice: 140 },
  { softwareName: 'Xero',              tier: 'Growing',      ourCost: 32, clientPrice: 52  },
  { softwareName: 'Xero',              tier: 'Established',  ourCost: 56, clientPrice: 85  },
  { softwareName: 'Bill.com',          tier: 'Standard',     ourCost: 49, clientPrice: 75  },
  { softwareName: 'Gusto',             tier: 'Core',         ourCost: 39, clientPrice: 60  },
  { softwareName: 'Gusto',             tier: 'Plus',         ourCost: 80, clientPrice: 125 },
  { softwareName: 'Dext',              tier: 'Business',     ourCost: 55, clientPrice: 85  },
  { softwareName: 'ADP Run',           tier: 'Essential',    ourCost: 60, clientPrice: 90  },
  { softwareName: 'Rippling',          tier: 'Starter',      ourCost: 45, clientPrice: 70  },
  { softwareName: 'Stripe Dashboard',  tier: null,           ourCost: 0,  clientPrice: 25  },
]

const CALL_TEMPLATES = [
  (n: string) => `Monthly check-in with ${n}. All accounts reconciled through last month. Client flagged a missing vendor invoice — follow-up required before period close. Overall sentiment positive.`,
  (n: string) => `Quarterly review with ${n}. YTD bookkeeping is on track. Client exploring potential payroll services expansion — scoping opportunity noted. Price increase reminder scheduled for next cycle.`,
  (n: string) => `Status call with ${n}. New credit card account needs to be added to the chart of accounts. Payroll run confirmed for next Friday. No blockers currently.`,
  (n: string) => `Introductory call with ${n}. Collected prior accountant's credentials. Three months of catch-up work identified. Client available for weekly check-ins during clean-up phase.`,
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic array pick based on integer seed. */
const p = <T>(arr: readonly T[], seed: number): T =>
  arr[((seed % arr.length) + arr.length) % arr.length]

/** Date N days before the fixed seed reference date (2026-06-03). */
const ago = (days: number): Date => {
  const d = new Date('2026-06-03T12:00:00.000Z')
  d.setDate(d.getDate() - days)
  return d
}

/** Date N days after the seed reference date. */
const fwd = (days: number): Date => ago(-days)

/** Generate a Harvest-style project code from a company prefix. */
const toCode = (prefix: string, idx: number): string => {
  const letters = prefix.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X')
  return `${letters}-${String(idx + 1).padStart(3, '0')}`
}

/** Round to 1 decimal place. */
const r1 = (n: number) => Math.round(n * 10) / 10

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

async function clearAll() {
  process.stdout.write('  Clearing existing data … ')
  await prisma.clientTag.deleteMany({})
  await prisma.timeLog.deleteMany({})
  await prisma.callLog.deleteMany({})
  await prisma.clientSubscription.deleteMany({})
  await prisma.sOW.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.tag.deleteMany({})
  console.log('done.')
}

async function seedTags() {
  process.stdout.write('  Creating tags … ')
  const rows = await Promise.all(TAGS.map(t => prisma.tag.create({ data: t })))
  console.log(`${rows.length} created.`)
  return rows.map((r: { id: string }) => r.id)
}

async function seedEmployees() {
  process.stdout.write('  Creating employees … ')
  const defs = [
    { name: 'Sarah Johnson', contractedHours: 40, adminTimePercent: 20, effectiveHourlyRate: 85 },
    { name: 'Mike Chen',     contractedHours: 32, adminTimePercent: 20, effectiveHourlyRate: 72 },
    { name: 'Priya Patel',   contractedHours: 24, adminTimePercent: 20, effectiveHourlyRate: 58 },
  ]
  const [sarah, mike, priya] = await Promise.all(defs.map(d => prisma.employee.create({ data: d })))
  console.log('3 created.')
  return { sarah, mike, priya }
}

// ─── Normal client factory ───────────────────────────────────────────────────

interface EmpMap { sarah: { id: string }; mike: { id: string }; priya: { id: string } }

async function seedNormalClient(idx: number, tagIds: string[], emps: EmpMap) {
  const prefix   = PREFIXES[idx]
  const name     = `${prefix} ${p(SUFFIXES, idx * 7)}`
  const code     = toCode(prefix, idx)
  const acctName = p(ACCOUNTANTS, idx * 3)
  const empId    = acctName === 'Sarah Johnson' ? emps.sarah.id
                 : acctName === 'Mike Chen'     ? emps.mike.id
                 :                                emps.priya.id

  const isFlat       = idx % 2 === 0
  const targetHours  = isFlat ? p(TARGET_HRS_FLAT, idx * 11) : p(TARGET_HRS_HRLY, idx * 13)
  const flatRate     = isFlat ? p(FLAT_RATES, idx * 9)       : undefined
  const hourlyRate   = isFlat ? undefined                    : p(HOURLY_RATES, idx * 7)

  // Bookkeeper allowance = total - 0.75 (QA 0.25 + Mgmt 0.25 + YE 0.25)
  const budget      = isFlat ? targetHours - 0.75 : targetHours
  // 60–92 % utilisation spread across 76 clients
  const utilPct     = 0.60 + (idx % 9) * 0.04
  const totalLogHrs = r1(budget * utilPct)

  const hasPriceAdj = idx % 4 !== 0
  const futureMonth = 7 + (idx % 5)          // Jul–Nov 2026
  const futureDateStr = `2026-${String(futureMonth).padStart(2, '0')}-01`

  // Create client
  const client = await prisma.client.create({
    data: {
      name,
      harvestProjectCode:       code,
      accountantName:           acctName,
      processingCadence:        p(CADENCES, idx * 9) as 'MONTHLY',
      archiveStatus:            'ACTIVE' as 'ACTIVE',
      guaranteedDeadlineDay:    p(DEADLINES, idx * 5),
      ...(hasPriceAdj ? {
        autoPriceIncreasePercent: p(PRICE_INC_PCT, idx),
        priceAdjustmentDate:      new Date(futureDateStr),
      } : {}),
    },
  })

  // Create SOW
  const sow = await prisma.sOW.create({
    data: {
      clientId:         client.id,
      billingType:      isFlat ? 'FLAT' as 'FLAT' : 'HOURLY' as 'HOURLY',
      fixedMonthlyRate: flatRate  ?? null,
      billingRate:      hourlyRate ?? null,
      targetHours,
      expectedHours:    r1(targetHours * 0.85),
      isRefined:        idx % 5 !== 0,   // 80 % of clients have refined SOWs
    },
  })

  // Create 3–5 time log entries
  const logCount = 3 + (idx % 3)
  const hrsEach  = r1(totalLogHrs / logCount)
  for (let j = 0; j < logCount; j++) {
    await prisma.timeLog.create({
      data: {
        clientId:    client.id,
        sowId:       sow.id,
        employeeId:  empId,
        hoursLogged: hrsEach,
        logDate:     ago(2 + j * 5 + (idx % 4)),
        notes:       j === 0 ? `${isFlat ? 'Monthly' : 'Hourly'} bookkeeping — period close` : null,
      },
    })
  }

  // 1–2 software subscriptions
  const subCount = 1 + (idx % 2)
  for (let s = 0; s < subCount; s++) {
    const sw = SOFTWARE[p(SOFTWARE.map((_, k) => k), idx + s * 4)]
    await prisma.clientSubscription.create({
      data: {
        clientId:       client.id,
        softwareName:   sw.softwareName,
        tier:           sw.tier,
        ourCost:        sw.ourCost,
        clientPrice:    sw.clientPrice,
        billingCadence: 'MONTHLY' as 'MONTHLY',
      },
    })
  }

  // 0–2 tags
  const tagCount = idx % 3   // 0, 1, or 2
  for (let t = 0; t < tagCount; t++) {
    const tagId = tagIds[p(tagIds.map((_, k) => k), idx + t * 3)]
    await prisma.clientTag.upsert({
      where:  { clientId_tagId: { clientId: client.id, tagId } },
      create: { clientId: client.id, tagId },
      update: {},
    })
  }

  // Call log for every third client
  if (idx % 3 === 0) {
    await prisma.callLog.create({
      data: {
        clientId: client.id,
        callDate: ago(5 + idx % 12),
        summary:  p(CALL_TEMPLATES, idx)(name),
      },
    })
  }
}

// ─── Violation clients ───────────────────────────────────────────────────────

async function seedViolationClients(tagIds: string[], emps: EmpMap) {
  const priorityTag = tagIds[4]   // 'Priority'  (#EF4444)
  const cleanUpTag  = tagIds[1]   // 'Clean-up'  (#F97316)

  // ── #77 REDSTONE: FLAT-RATE with catastrophic budget overrun ──────────────
  // Bookkeeper budget = 40 − 0.75 = 39.25 h. Logged: 71.0 h → 181 % utilisation.
  {
    const c = await prisma.client.create({
      data: {
        name: 'Redstone Advisory Group', harvestProjectCode: 'RDST-077',
        accountantName: 'Sarah Johnson', processingCadence: 'MONTHLY',
        archiveStatus: 'ACTIVE', guaranteedDeadlineDay: 15,
        autoPriceIncreasePercent: 3.5, priceAdjustmentDate: fwd(14),
      },
    })
    const sow = await prisma.sOW.create({
      data: { clientId: c.id, billingType: 'FLAT', fixedMonthlyRate: 5000, targetHours: 40, expectedHours: 36, isRefined: true },
    })
    // Three employees contributing — total 71 h (25 + 28 + 18)
    const logs = [
      { emp: emps.sarah.id, hrs: 25.0 }, { emp: emps.sarah.id, hrs: 14.0 },
      { emp: emps.mike.id,  hrs: 18.0 }, { emp: emps.mike.id,  hrs: 10.0 },
      { emp: emps.priya.id, hrs: 4.0  },
    ]
    for (const [j, l] of logs.entries()) {
      await prisma.timeLog.create({
        data: { clientId: c.id, sowId: sow.id, employeeId: l.emp, hoursLogged: l.hrs, logDate: ago(j * 4 + 1) },
      })
    }
    await prisma.clientSubscription.create({
      data: { clientId: c.id, softwareName: 'QuickBooks Online', tier: 'Advanced', ourCost: 90, clientPrice: 140, billingCadence: 'MONTHLY' },
    })
    await prisma.clientTag.createMany({ data: [{ clientId: c.id, tagId: priorityTag }] })
    await prisma.callLog.create({
      data: {
        clientId: c.id, callDate: ago(3),
        summary: 'Redstone Advisory Group — emergency scope review. Client requested significant additional clean-up work covering 18 months of backlog in addition to current month close. Hours are running 180 % over the agreed monthly budget. Billing escalation required before further work proceeds.',
      },
    })
    console.log('    ⚠️  Redstone Advisory Group     [OVER BUDGET — 181% utilisation]')
  }

  // ── #78 HAWTHORNE: HOURLY with accrued billing 68 % above SOW target ──────
  // SOW: 25 h × $150 = $3,750 target. Logged: 42 h → accrued $6,300 (+$2,550 delta).
  {
    const c = await prisma.client.create({
      data: {
        name: 'Hawthorne Financial Services', harvestProjectCode: 'HWTH-078',
        accountantName: 'Mike Chen', processingCadence: 'BIWEEKLY',
        archiveStatus: 'ACTIVE', guaranteedDeadlineDay: 10,
        autoPriceIncreasePercent: 4.0, priceAdjustmentDate: fwd(45),
      },
    })
    const sow = await prisma.sOW.create({
      data: { clientId: c.id, billingType: 'HOURLY', billingRate: 150, targetHours: 25, expectedHours: 22, isRefined: true },
    })
    const logs = [
      { emp: emps.mike.id,  hrs: 14.0 }, { emp: emps.mike.id,  hrs: 12.0 },
      { emp: emps.sarah.id, hrs: 10.0 }, { emp: emps.sarah.id, hrs: 6.0  },
    ]
    for (const [j, l] of logs.entries()) {
      await prisma.timeLog.create({
        data: { clientId: c.id, sowId: sow.id, employeeId: l.emp, hoursLogged: l.hrs, logDate: ago(j * 5 + 2) },
      })
    }
    await prisma.clientSubscription.create({
      data: { clientId: c.id, softwareName: 'Xero', tier: 'Established', ourCost: 56, clientPrice: 85, billingCadence: 'MONTHLY' },
    })
    await prisma.clientTag.createMany({ data: [{ clientId: c.id, tagId: priorityTag }] })
    await prisma.callLog.create({
      data: {
        clientId: c.id, callDate: ago(6),
        summary: 'Hawthorne Financial Services — billing variance flagged. Client SOW targets 25 h/mo at $150/hr ($3,750). Harvest logs show 42 h already accrued this period ($6,300). Client was not pre-approved for additional hours. Requires immediate billing reconciliation and updated SOW before next invoice.',
      },
    })
    console.log('    ⚠️  Hawthorne Financial Services [BILLING MISMATCH — $2,550 over target]')
  }

  // ── #79 PINECREST: FLAT with price adjustment 63 days past due ────────────
  {
    const c = await prisma.client.create({
      data: {
        name: 'Pinecrest Holdings LLC', harvestProjectCode: 'PINE-079',
        accountantName: 'Priya Patel', processingCadence: 'MONTHLY',
        archiveStatus: 'ACTIVE', guaranteedDeadlineDay: 20,
        autoPriceIncreasePercent: 4.5,
        priceAdjustmentDate: ago(63),   // ← 63 days in the PAST → overdue
      },
    })
    const sow = await prisma.sOW.create({
      data: { clientId: c.id, billingType: 'FLAT', fixedMonthlyRate: 3000, targetHours: 30, expectedHours: 26, isRefined: true },
    })
    const logs = [
      { emp: emps.priya.id, hrs: 9.0 }, { emp: emps.priya.id, hrs: 8.5 },
      { emp: emps.mike.id,  hrs: 5.0 },
    ]
    for (const [j, l] of logs.entries()) {
      await prisma.timeLog.create({
        data: { clientId: c.id, sowId: sow.id, employeeId: l.emp, hoursLogged: l.hrs, logDate: ago(j * 6 + 1) },
      })
    }
    await prisma.clientSubscription.create({
      data: { clientId: c.id, softwareName: 'QuickBooks Online', tier: 'Plus', ourCost: 40, clientPrice: 65, billingCadence: 'MONTHLY' },
    })
    await prisma.clientSubscription.create({
      data: { clientId: c.id, softwareName: 'Gusto', tier: 'Core', ourCost: 39, clientPrice: 60, billingCadence: 'MONTHLY' },
    })
    await prisma.callLog.create({
      data: {
        clientId: c.id, callDate: ago(10),
        summary: 'Pinecrest Holdings — routine check-in. Bookkeeping is on track. NOTE: The 4.5% automatic price increase was due April 1, 2026 (63 days ago) and has not been applied. Client has not been notified. Action required before next invoice cycle.',
      },
    })
    console.log('    ⚠️  Pinecrest Holdings LLC       [PRICE ADJUSTMENT 63 DAYS OVERDUE]')
  }

  // ── #80 SUMMIT PEAK: HOURLY with active hours but SOW completely unrefined ─
  // billingRate = 0 / isRefined = false → no confirmed rate, but work is being logged.
  {
    const c = await prisma.client.create({
      data: {
        name: 'Summit Peak Capital Management', harvestProjectCode: 'SMPT-080',
        accountantName: 'Sarah Johnson', processingCadence: 'WEEKLY',
        archiveStatus: 'ACTIVE', guaranteedDeadlineDay: 5,
      },
    })
    const sow = await prisma.sOW.create({
      data: {
        clientId: c.id, billingType: 'HOURLY',
        billingRate: null,    // ← no rate agreed yet
        targetHours: 20, expectedHours: 18,
        isRefined: false,     // ← SOW not refined → billing cannot be confirmed
      },
    })
    const logs = [
      { emp: emps.sarah.id, hrs: 8.0 }, { emp: emps.sarah.id, hrs: 7.5 },
      { emp: emps.mike.id,  hrs: 6.5 },
    ]
    for (const [j, l] of logs.entries()) {
      await prisma.timeLog.create({
        data: { clientId: c.id, sowId: sow.id, employeeId: l.emp, hoursLogged: l.hrs, logDate: ago(j * 3 + 1) },
      })
    }
    await prisma.clientSubscription.create({
      data: { clientId: c.id, softwareName: 'Dext', tier: 'Business', ourCost: 55, clientPrice: 85, billingCadence: 'MONTHLY' },
    })
    await prisma.clientTag.createMany({ data: [{ clientId: c.id, tagId: cleanUpTag }] })
    await prisma.callLog.create({
      data: {
        clientId: c.id, callDate: ago(2),
        summary: 'Summit Peak Capital Management — onboarding call. Still negotiating hourly rate with client (estimates range from $115–$140/hr). 22 hours already logged this month with no confirmed billing rate. SOW must be finalised before month end to avoid unbillable hours.',
      },
    })
    console.log('    ⚠️  Summit Peak Capital Mgmt     [UNREFINED SOW — 22 h logged, $0 billing rate]')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Management Dashboard — Prisma Seed\n')

  await clearAll()

  const tagIds  = await seedTags()
  const emps    = await seedEmployees()

  console.log(`  Seeding 76 normal clients …`)
  for (let i = 0; i < 76; i++) {
    await seedNormalClient(i, tagIds, emps)
    if ((i + 1) % 10 === 0) console.log(`    … ${i + 1}/76 done`)
  }
  console.log('  76 normal clients created.')

  console.log('\n  Seeding 4 violation clients:')
  await seedViolationClients(tagIds, emps)

  console.log('\n✅ Seed complete.\n')
  console.log('  Totals:')
  console.log('    Employees    :', await prisma.employee.count())
  console.log('    Tags         :', await prisma.tag.count())
  console.log('    Clients      :', await prisma.client.count())
  console.log('    SOWs         :', await prisma.sOW.count())
  console.log('    Time logs    :', await prisma.timeLog.count())
  console.log('    Subscriptions:', await prisma.clientSubscription.count())
  console.log('    Call logs    :', await prisma.callLog.count())
  console.log('    Client tags  :', await prisma.clientTag.count())
  console.log('')
}

main()
  .catch(e => { console.error('\n❌ Seed failed:\n', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
