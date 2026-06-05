export type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'
export type ArchiveStatus = 'ACTIVE' | 'ARCHIVED'
export type BillingType = 'FLAT' | 'HOURLY'
export type BillingCadence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Client {
  id: string
  name: string
  harvestProjectCode: string
  autoPriceIncreasePercent?: number
  priceAdjustmentDate?: string
  accountantName?: string
  guaranteedDeadlineDay?: number
  processingCadence: ProcessingCadence
  archiveStatus: ArchiveStatus
  tags: Tag[]
}

export interface SOW {
  id: string
  clientId: string
  billingType: BillingType
  fixedMonthlyRate?: number
  targetHours?: number
  expectedHours?: number
  billingRate?: number
  isRefined: boolean
}

export interface Employee {
  id: string
  name: string
  contractedHours: number
  adminTimePercent: number
  effectiveHourlyRate: number
}

export interface TimeLog {
  id: string
  clientId: string
  employeeId: string
  sowId?: string
  hoursLogged: number
  logDate: string
  notes?: string
}

export interface ClientSubscription {
  id: string
  clientId: string
  softwareName: string
  tier?: string
  ourCost: number
  clientPrice: number
  billingCadence: BillingCadence
}

export interface Alert {
  id: string
  clientId: string
  clientName: string
  message: string
  severity: 'warning' | 'critical'
}

export const TAGS: Tag[] = [
  { id: 't1', name: 'Priority',   color: '#EF4444' },
  { id: 't2', name: 'Tax Season', color: '#F59E0B' },
  { id: 't3', name: 'New Client', color: '#10B981' },
  { id: 't4', name: 'At Risk',    color: '#F97316' },
  { id: 't5', name: 'VIP',        color: '#8B5CF6' },
  { id: 't6', name: 'Catch-Up',   color: '#3B82F6' },
]

export const CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Thornbury Accounting',
    harvestProjectCode: 'THRN-001',
    autoPriceIncreasePercent: 3.5,
    priceAdjustmentDate: '2026-06-07',
    accountantName: 'Sarah Johnson',
    guaranteedDeadlineDay: 15,
    processingCadence: 'MONTHLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[0], TAGS[1]],
  },
  {
    id: 'c2',
    name: 'BlueWave Digital',
    harvestProjectCode: 'BLWV-002',
    accountantName: 'Mike Chen',
    guaranteedDeadlineDay: 5,
    processingCadence: 'WEEKLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[2]],
  },
  {
    id: 'c3',
    name: 'Summit Holdings',
    harvestProjectCode: 'SMMT-003',
    autoPriceIncreasePercent: 2.0,
    accountantName: 'Sarah Johnson',
    guaranteedDeadlineDay: 20,
    processingCadence: 'BIWEEKLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[0]],
  },
  {
    id: 'c4',
    name: 'Vantage Partners',
    harvestProjectCode: 'VNTP-004',
    accountantName: 'Tom Williams',
    processingCadence: 'MONTHLY',
    archiveStatus: 'ARCHIVED',
    tags: [TAGS[3]],
  },
  {
    id: 'c5',
    name: 'Clearpath Solutions',
    harvestProjectCode: 'CLRP-005',
    autoPriceIncreasePercent: 5.0,
    priceAdjustmentDate: '2026-08-01',
    accountantName: 'Mike Chen',
    guaranteedDeadlineDay: 10,
    processingCadence: 'QUARTERLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[4]],
  },
  {
    id: 'c6',
    name: 'Dune Capital Group',
    harvestProjectCode: 'DUNE-006',
    autoPriceIncreasePercent: 4.0,
    priceAdjustmentDate: '2026-06-28',
    accountantName: 'Sarah Johnson',
    guaranteedDeadlineDay: 28,
    processingCadence: 'MONTHLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[4], TAGS[0]],
  },
]

export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Sarah Johnson', contractedHours: 40, adminTimePercent: 10, effectiveHourlyRate: 85 },
  { id: 'e2', name: 'Mike Chen',     contractedHours: 32, adminTimePercent: 8,  effectiveHourlyRate: 78 },
  { id: 'e3', name: 'Priya Patel',   contractedHours: 24, adminTimePercent: 5,  effectiveHourlyRate: 72 },
]

export const SOWS: SOW[] = [
  { id: 's1', clientId: 'c1', billingType: 'FLAT',   fixedMonthlyRate: 3500, targetHours: 45, expectedHours: 38, isRefined: true },
  { id: 's2', clientId: 'c2', billingType: 'HOURLY', billingRate: 125,       targetHours: 20, expectedHours: 18, isRefined: false },
  { id: 's3', clientId: 'c3', billingType: 'FLAT',   fixedMonthlyRate: 2800, targetHours: 36, expectedHours: 30, isRefined: true },
  { id: 's4', clientId: 'c5', billingType: 'HOURLY', billingRate: 150,       targetHours: 60, expectedHours: 55, isRefined: true },
  { id: 's5', clientId: 'c6', billingType: 'FLAT',   fixedMonthlyRate: 5200, targetHours: 65, expectedHours: 58, isRefined: true },
]

export const TIME_LOGS: TimeLog[] = [
  { id: 'tl1', clientId: 'c1', employeeId: 'e1', sowId: 's1', hoursLogged: 18.5, logDate: '2026-06-02', notes: 'Monthly reconciliation' },
  { id: 'tl2', clientId: 'c1', employeeId: 'e2', sowId: 's1', hoursLogged: 8.0,  logDate: '2026-06-02' },
  { id: 'tl3', clientId: 'c1', employeeId: 'e3', sowId: 's1', hoursLogged: 4.5,  logDate: '2026-06-03' },
  { id: 'tl4', clientId: 'c2', employeeId: 'e2', sowId: 's2', hoursLogged: 12.0, logDate: '2026-06-01' },
  { id: 'tl5', clientId: 'c3', employeeId: 'e1', sowId: 's3', hoursLogged: 22.0, logDate: '2026-06-02' },
  { id: 'tl6', clientId: 'c6', employeeId: 'e1', sowId: 's5', hoursLogged: 28.0, logDate: '2026-06-01' },
  { id: 'tl7', clientId: 'c6', employeeId: 'e3', sowId: 's5', hoursLogged: 14.0, logDate: '2026-06-02' },
]

export const SUBSCRIPTIONS: ClientSubscription[] = [
  { id: 'sub1', clientId: 'c1', softwareName: 'QuickBooks Online', tier: 'Plus',     ourCost: 40, clientPrice: 65,  billingCadence: 'MONTHLY' },
  { id: 'sub2', clientId: 'c1', softwareName: 'Bill.com',          tier: 'Standard', ourCost: 49, clientPrice: 75,  billingCadence: 'MONTHLY' },
  { id: 'sub3', clientId: 'c1', softwareName: 'Gusto',             tier: 'Core',     ourCost: 39, clientPrice: 60,  billingCadence: 'MONTHLY' },
  { id: 'sub4', clientId: 'c2', softwareName: 'Xero',              tier: 'Growing',  ourCost: 32, clientPrice: 52,  billingCadence: 'MONTHLY' },
  { id: 'sub5', clientId: 'c6', softwareName: 'QuickBooks Online', tier: 'Advanced', ourCost: 90, clientPrice: 140, billingCadence: 'MONTHLY' },
  { id: 'sub6', clientId: 'c6', softwareName: 'Dext',              tier: 'Business', ourCost: 55, clientPrice: 85,  billingCadence: 'MONTHLY' },
]

export const ALERTS: Alert[] = [
  { id: 'a1', clientId: 'c1', clientName: 'Thornbury Accounting', message: 'Price adjustment due in 4 days (Jun 7) — 3.5% increase pending',         severity: 'critical' },
  { id: 'a2', clientId: 'c3', clientName: 'Summit Holdings',      message: 'Monthly guaranteed deadline approaching — Day 20 is in 2 days',          severity: 'warning' },
  { id: 'a3', clientId: 'c2', clientName: 'BlueWave Digital',     message: 'Active SOW is unrefined — billing rate not yet confirmed',               severity: 'warning' },
  { id: 'a4', clientId: 'c6', clientName: 'Dune Capital Group',   message: 'Price adjustment due in 25 days (Jun 28) — 4.0% increase pending',       severity: 'warning' },
]
