export type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'
export type ArchiveStatus    = 'ACTIVE' | 'ARCHIVED' | 'INACTIVE' | 'OFF_BOARDING' | 'PENDING_ARCHIVE'
export type BillingType      = 'FLAT' | 'HOURLY'
export type BillingCadence   = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type EntityType       = 'LLC' | 'S_CORP' | 'C_CORP' | 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'NON_PROFIT' | 'OTHER'
export type OfficeType       = 'PHYSICAL' | 'HOME_OFFICE'
export type ProjectType      = 'ANNUAL' | 'CLEAN_UP' | 'MONTHLY_MAINTENANCE' | 'QBO_ONLY' | 'RECURRING'
export type RevenueType      = 'CLEANUP' | 'FREE' | 'HOURLY_CLEANUP' | 'QBO_ONLY_ANCHOR' | 'QBO_ONLY_QBO' | 'RECURRING_MONTHLY_ACH' | 'RECURRING_MONTHLY_HOURLY' | 'RECURRING_MONTHLY_INVOICED'
export type TimeLogType      = 'BOOKKEEPER' | 'QA' | 'CUSTOMER_SUCCESS' | 'MANAGEMENT' | 'YEAR_END'

export interface Tag {
  id: string
  name: string
  color: string
}

export type AccountantStatus = 'ACTIVE' | 'ARCHIVED'
export type EmployeeRole     = 'employee' | 'contractor'

export interface Accountant {
  id: string
  name: string
  businessName?: string
  email?: string
  phoneNumber?: string
  status: AccountantStatus
  hasSecurePortal?: boolean
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
  // Administration fields
  contractStartDate?: string
  entityType?: EntityType
  einNumber?: string
  officeType?: OfficeType
  hasPayroll?: boolean
  payrollProvider?: string
  referredBy?: string
  projectType?: ProjectType
  revenueType?: RevenueType
  // Compliance & billing tracking
  hasContractedLoom?: boolean
  hasScheduledMeetings?: boolean
  hasSignedAutoIncrease?: boolean
  softwareRate?: number
  totalMonthlyAmount?: number
  // Accountant consent
  okToContactAccountant?: boolean
  // QBO-only client fields
  qboOnly?: boolean
  qboMonthlyFee?: number
  // Rolodex / contact fields
  primaryContact?: string
  phone?: string
  email?: string
  address?: string
  contractEndDate?: string
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
  role: EmployeeRole
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
  logType?: TimeLogType
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

export interface CallLog {
  id: string
  clientId: string
  callDate: string
  summary: string
  rawNotes?: string
}

export interface Alert {
  id: string
  clientId: string
  clientName: string
  message: string
  severity: 'warning' | 'critical'
}

export const ACCOUNTANTS: Accountant[] = [
  { id: 'ac1', name: 'Sarah Johnson', businessName: 'BBA Associates', email: 'sarah@bba.com',  phoneNumber: '(617) 555-0111', status: 'ACTIVE'   },
  { id: 'ac2', name: 'Mike Chen',     businessName: 'BBA Associates', email: 'mike@bba.com',   phoneNumber: '(617) 555-0222', status: 'ACTIVE'   },
  { id: 'ac3', name: 'Priya Patel',   businessName: 'BBA Associates', email: 'priya@bba.com',  phoneNumber: '(617) 555-0333', status: 'ACTIVE'   },
  { id: 'ac4', name: 'Tom Williams',  businessName: 'BBA Associates', email: 'tom@bba.com',    phoneNumber: '(617) 555-0444', status: 'ARCHIVED' },
]

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
    contractStartDate: '2024-01-15',
    entityType: 'LLC',
    einNumber: '82-1234567',
    officeType: 'HOME_OFFICE',
    hasPayroll: true,
    payrollProvider: 'Gusto',
    referredBy: 'Chamber of Commerce',
    projectType: 'MONTHLY_MAINTENANCE',
    revenueType: 'RECURRING_MONTHLY_ACH',
    hasContractedLoom: true, hasScheduledMeetings: true, hasSignedAutoIncrease: true,
    softwareRate: 200,
    okToContactAccountant: true,
    primaryContact: 'James Thornbury',
    phone: '(617) 555-0142',
    email: 'james@thornbury-acct.com',
    address: '412 Tremont St, Boston, MA 02116',
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
    contractStartDate: '2026-03-01',
    entityType: 'S_CORP',
    einNumber: '47-9876543',
    officeType: 'PHYSICAL',
    hasPayroll: false,
    referredBy: 'Direct Outreach',
    projectType: 'CLEAN_UP',
    revenueType: 'HOURLY_CLEANUP',
    hasContractedLoom: false, hasScheduledMeetings: true, hasSignedAutoIncrease: false,
    softwareRate: 52,
    primaryContact: 'Rachel Kim',
    phone: '(512) 555-0283',
    email: 'rachel.kim@bluewave.io',
    address: '3500 Bee Cave Rd, Austin, TX 78746',
  },
  {
    id: 'c3',
    name: 'Summit Holdings',
    harvestProjectCode: 'SMMT-003',
    autoPriceIncreasePercent: 2.0,
    priceAdjustmentDate: '2026-09-01',
    accountantName: 'Sarah Johnson',
    guaranteedDeadlineDay: 20,
    processingCadence: 'BIWEEKLY',
    archiveStatus: 'ACTIVE',
    tags: [TAGS[0]],
    contractStartDate: '2023-09-01',
    entityType: 'LLC',
    einNumber: '55-2468013',
    officeType: 'PHYSICAL',
    hasPayroll: true,
    payrollProvider: 'ADP',
    projectType: 'RECURRING',
    revenueType: 'RECURRING_MONTHLY_INVOICED',
    hasContractedLoom: true, hasScheduledMeetings: false, hasSignedAutoIncrease: true,
    softwareRate: 175,
    primaryContact: 'David Martinez',
    phone: '(303) 555-0371',
    email: 'dmartinez@summitholdings.com',
    address: '1700 Lincoln St, Denver, CO 80203',
  },
  {
    id: 'c4',
    name: 'Vantage Partners',
    harvestProjectCode: 'VNTP-004',
    accountantName: 'Tom Williams',
    processingCadence: 'MONTHLY',
    archiveStatus: 'ARCHIVED',
    tags: [TAGS[3]],
    entityType: 'PARTNERSHIP',
    projectType: 'MONTHLY_MAINTENANCE',
    revenueType: 'RECURRING_MONTHLY_ACH',
    primaryContact: 'Patricia Chen',
    phone: '(312) 555-0459',
    email: 'pchen@vantagepartners.com',
    address: '875 N Michigan Ave, Chicago, IL 60611',
    contractEndDate: '2025-03-15',
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
    contractStartDate: '2022-08-01',
    entityType: 'C_CORP',
    einNumber: '91-3579124',
    officeType: 'PHYSICAL',
    hasPayroll: true,
    payrollProvider: 'Rippling',
    projectType: 'RECURRING',
    revenueType: 'RECURRING_MONTHLY_HOURLY',
    hasContractedLoom: true, hasScheduledMeetings: true, hasSignedAutoIncrease: false,
    softwareRate: 230,
    okToContactAccountant: true,
    contractEndDate: '2026-09-30',
    primaryContact: 'Michael Torres',
    phone: '(206) 555-0524',
    email: 'mtorres@clearpathsolutions.com',
    address: '1420 5th Ave, Seattle, WA 98101',
  },
  {
    id: 'c7',
    name: 'Harper Studio LLC',
    harvestProjectCode: 'HRPR-007',
    accountantName: 'Priya Patel',
    processingCadence: 'MONTHLY',
    archiveStatus: 'ACTIVE',
    tags: [],
    projectType: 'QBO_ONLY',
    revenueType: 'QBO_ONLY_QBO',
    hasContractedLoom: false, hasScheduledMeetings: false, hasSignedAutoIncrease: false,
    softwareRate: 35,
    qboOnly: true,
    qboMonthlyFee: 35,
    primaryContact: 'Harper Lee',
    phone: '(615) 555-0718',
    email: 'hello@harperstudio.com',
    address: '2416 21st Ave S, Nashville, TN 37212',
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
    contractStartDate: '2023-06-28',
    entityType: 'LLC',
    einNumber: '73-1357924',
    officeType: 'HOME_OFFICE',
    hasPayroll: false,
    referredBy: 'Mike Chen Referral',
    projectType: 'MONTHLY_MAINTENANCE',
    revenueType: 'RECURRING_MONTHLY_ACH',
    hasContractedLoom: true, hasScheduledMeetings: true, hasSignedAutoIncrease: true,
    softwareRate: 225,
    primaryContact: 'Sophie Beaumont',
    phone: '(212) 555-0637',
    email: 'sbeaumont@dunecapital.com',
    address: '245 Park Ave, New York, NY 10167',
  },
]

export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Sarah Johnson', role: 'employee',   contractedHours: 40, adminTimePercent: 20, effectiveHourlyRate: 85 },
  { id: 'e2', name: 'Mike Chen',     role: 'employee',   contractedHours: 32, adminTimePercent: 20, effectiveHourlyRate: 78 },
  { id: 'e3', name: 'Priya Patel',   role: 'contractor', contractedHours: 24, adminTimePercent: 20, effectiveHourlyRate: 72 },
]

export const SOWS: SOW[] = [
  { id: 's1', clientId: 'c1', billingType: 'FLAT',   fixedMonthlyRate: 3500, targetHours: 45, expectedHours: 38, isRefined: true },
  { id: 's2', clientId: 'c2', billingType: 'HOURLY', billingRate: 125,       targetHours: 20, expectedHours: 18, isRefined: false },
  { id: 's3', clientId: 'c3', billingType: 'FLAT',   fixedMonthlyRate: 2800, targetHours: 36, expectedHours: 30, isRefined: true },
  { id: 's4', clientId: 'c5', billingType: 'HOURLY', billingRate: 150,       targetHours: 60, expectedHours: 55, isRefined: true },
  { id: 's5', clientId: 'c6', billingType: 'FLAT',   fixedMonthlyRate: 5200, targetHours: 65, expectedHours: 58, isRefined: true },
]

export const TIME_LOGS: TimeLog[] = [
  { id: 'tl1', clientId: 'c1', employeeId: 'e1', sowId: 's1', hoursLogged: 18.5, logDate: '2026-06-02', logType: 'BOOKKEEPER', notes: 'Monthly reconciliation' },
  { id: 'tl2', clientId: 'c1', employeeId: 'e2', sowId: 's1', hoursLogged: 8.0,  logDate: '2026-06-02', logType: 'BOOKKEEPER' },
  { id: 'tl3', clientId: 'c1', employeeId: 'e3', sowId: 's1', hoursLogged: 4.5,  logDate: '2026-06-03', logType: 'BOOKKEEPER' },
  { id: 'tl4', clientId: 'c2', employeeId: 'e2', sowId: 's2', hoursLogged: 12.0, logDate: '2026-06-01', logType: 'BOOKKEEPER' },
  { id: 'tl5', clientId: 'c3', employeeId: 'e1', sowId: 's3', hoursLogged: 22.0, logDate: '2026-06-02', logType: 'BOOKKEEPER' },
  { id: 'tl6', clientId: 'c6', employeeId: 'e1', sowId: 's5', hoursLogged: 28.0, logDate: '2026-06-01', logType: 'BOOKKEEPER' },
  { id: 'tl7', clientId: 'c6', employeeId: 'e3', sowId: 's5', hoursLogged: 14.0, logDate: '2026-06-02', logType: 'BOOKKEEPER' },
  // Non-bookkeeper pool logs (do NOT count against bookkeeper budget alert)
  { id: 'tl8', clientId: 'c1', employeeId: 'e1', sowId: 's1', hoursLogged: 0.25, logDate: '2026-06-01', logType: 'QA' },
  { id: 'tl9', clientId: 'c1', employeeId: 'e2', sowId: 's1', hoursLogged: 0.25, logDate: '2026-06-01', logType: 'CUSTOMER_SUCCESS' },
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
  { id: 'a1', clientId: 'c1', clientName: 'Thornbury Accounting', message: 'Price adjustment due in 4 days (Jun 7) — 3.5% increase pending',     severity: 'critical' },
  { id: 'a2', clientId: 'c3', clientName: 'Summit Holdings',      message: 'Guaranteed deadline approaching — Day 20 is in 2 days',              severity: 'warning' },
  { id: 'a3', clientId: 'c2', clientName: 'BlueWave Digital',     message: 'Active SOW is unrefined — billing rate not yet confirmed',           severity: 'warning' },
  { id: 'a4', clientId: 'c6', clientName: 'Dune Capital Group',   message: 'Price adjustment due in 25 days (Jun 28) — 4.0% increase pending',   severity: 'warning' },
]

export const CALL_LOGS: CallLog[] = [
  {
    id: 'cl1',
    clientId: 'c1',
    callDate: '2026-05-28',
    summary: '**Client Mood:** Positive\n\n**Project Blockers:**\n- Missing credit card statements from April\n\n**New Scoping Opportunities:**\n- Client asked about annual tax planning session\n\n**Deadline Changes:**\n- None mentioned\n\n**Key Action Items:**\n- Follow up on missing statements before month-end close',
    rawNotes: 'Spoke with Thornbury team. Everything on track. They asked about tax planning. Need the April CC statements urgently.',
  },
  {
    id: 'cl2',
    clientId: 'c1',
    callDate: '2026-04-15',
    summary: '**Client Mood:** Neutral\n\n**Project Blockers:**\n- None identified\n\n**New Scoping Opportunities:**\n- None identified\n\n**Deadline Changes:**\n- None mentioned\n\n**Key Action Items:**\n- Send Q1 summary report by April 30',
    rawNotes: 'Routine check-in. No issues. Remind them to review Q1 summary when sent.',
  },
  {
    id: 'cl3',
    clientId: 'c6',
    callDate: '2026-05-30',
    summary: '**Client Mood:** Concerned\n\n**Project Blockers:**\n- New software integration needs testing\n\n**New Scoping Opportunities:**\n- Potential second entity setup\n\n**Deadline Changes:**\n- June close moved from June 28 to July 3 (urgency: High)\n\n**Key Action Items:**\n- Test new integration before July 1\n- Get engagement letter for potential entity work',
    rawNotes: 'Dune Capital concerned about new software. Also mentioned possibly setting up a second LLC. Deadline shifted slightly.',
  },
]
