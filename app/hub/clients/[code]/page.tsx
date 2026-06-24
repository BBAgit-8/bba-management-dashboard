'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type ClientDetail = {
  id: string; name: string; harvestProjectCode: string
  entityType: string | null; processingCadence: string | null
  projectType: string | null; archiveStatus: string
  contractStartDate: string | null; contractEndDate: string | null
  clientContactName: string | null; accountantName: string | null
  referredBy: string | null; totalHrsPerMonth: number | null
  apArHrs: number | null; qaHours: number | null
  bankFeedTime: number | null; transactionsPerMonth: number | null
  numBanksAndCCs: number | null; numLoans: number | null
  numPmtPortals: number | null; pettyCash: boolean | null
  hasPayroll: boolean | null; payrollProvider: string | null
  hasContractedLoom: boolean | null; hasScheduledMeetings: boolean | null
  bookkeepingRate: number | null; softwareRate: number | null
  totalMonthlyAmount: number | null
  guaranteedDeadlineDay: number | null
  qboOnly: boolean | null
  tags: { name: string; color: string }[]
  notes: { id: string; content: string; createdAt: string }[]
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 w-40 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 font-medium flex-1">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3" style={{ backgroundColor: 'rgba(109,40,217,0.07)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-purple-700">{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  )
}

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
}
const PTYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Annual', CLEAN_UP: 'Cleanup', MONTHLY_MAINTENANCE: 'Recurring',
  QBO_ONLY: 'QBO Only', RECURRING: 'Recurring',
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function HubClientDetail() {
  const { code } = useParams<{ code: string }>()
  const [client,  setClient]  = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/hub/clients/${code}`)
      .then(r => r.json())
      .then(d => { if (d.client) setClient(d.client) })
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
    </div>
  )

  if (!client) return (
    <div className="text-center py-24">
      <p className="text-slate-400">Client not found.</p>
      <Link href="/hub/dashboard" className="mt-3 inline-block text-sm text-purple-600 underline">← Back</Link>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link href="/hub/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-purple-700 transition-colors">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All clients
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
          style={{ backgroundColor: 'rgba(109,40,217,0.12)', color: '#6d28d9' }}>
          {client.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-slate-400">{client.harvestProjectCode}</span>
            {client.entityType && <span className="text-xs text-slate-400">· {client.entityType}</span>}
            {client.projectType && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700">
                {PTYPE_LABEL[client.projectType] ?? client.projectType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Identity */}
      <Section title="Client Info">
        <InfoRow label="Contact Name"        value={client.clientContactName} />
        <InfoRow label="Entity Type"         value={client.entityType} />
        <InfoRow label="Accountant"          value={client.accountantName} />
        <InfoRow label="Contract Start"      value={fmtDate(client.contractStartDate)} />
        <InfoRow label="Contract End"        value={fmtDate(client.contractEndDate)} />
        <InfoRow label="Close Deadline"      value={client.guaranteedDeadlineDay ? `Day ${client.guaranteedDeadlineDay} of the month` : null} />
        <InfoRow label="Referred By"         value={client.referredBy} />
        {client.tags.length > 0 && (
          <div className="flex items-start gap-3 py-2.5 border-b border-slate-100">
            <span className="text-xs text-slate-400 w-40 shrink-0 pt-0.5">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {client.tags.map(tag => (
                <span key={tag.name} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Rates */}
      <Section title="Rates &amp; Billing">
        <InfoRow label="Bookkeeping Rate"  value={client.bookkeepingRate   != null ? `$${Number(client.bookkeepingRate).toFixed(2)}/mo`  : null} />
        <InfoRow label="Software Rate"     value={client.softwareRate      != null ? `$${Number(client.softwareRate).toFixed(2)}/mo`      : null} />
        <InfoRow label="Total Monthly"     value={
          (client.bookkeepingRate != null || client.softwareRate != null)
            ? `$${(Number(client.bookkeepingRate ?? 0) + Number(client.softwareRate ?? 0)).toFixed(2)}/mo`
            : client.totalMonthlyAmount != null
              ? `$${Number(client.totalMonthlyAmount).toFixed(2)}/mo`
              : null
        } />
      </Section>

      {/* Scope */}
      <Section title="Scope of Work">
        <InfoRow label="Project Type"        value={client.projectType ? (PTYPE_LABEL[client.projectType] ?? client.projectType) : null} />
        <InfoRow label="Processing Cadence"  value={client.processingCadence ? CADENCE_LABEL[client.processingCadence] : null} />
        <InfoRow label="QBO Only"            value={client.qboOnly ? 'Yes — QBO access only, no bookkeeping' : null} />
        <InfoRow label="Total Hours / Mo"    value={client.totalHrsPerMonth ? `${client.totalHrsPerMonth} hrs` : null} />
        <InfoRow label="AP / AR Hours"       value={client.apArHrs ? `${client.apArHrs} hrs` : null} />
        <InfoRow label="QA Hours"            value={client.qaHours ? `${client.qaHours} hrs` : null} />
        <InfoRow label="Bank Feed Time"      value={client.bankFeedTime ? `${client.bankFeedTime} hrs` : null} />
        <InfoRow label="Transactions / Mo"   value={client.transactionsPerMonth ?? null} />
        <InfoRow label="# Banks &amp; CCs"   value={client.numBanksAndCCs ?? null} />
        <InfoRow label="# Loans"             value={client.numLoans ?? null} />
        <InfoRow label="# Payment Portals"   value={client.numPmtPortals ?? null} />
        <InfoRow label="Petty Cash"          value={client.pettyCash ? 'Yes' : null} />
        <InfoRow label="Payroll"             value={client.hasPayroll ? (client.payrollProvider ?? 'Yes') : null} />
        <InfoRow label="Contracted Loom"     value={client.hasContractedLoom    ? 'Yes' : null} />
        <InfoRow label="Scheduled Meetings"  value={client.hasScheduledMeetings ? 'Yes' : null} />
      </Section>

      {/* Notes */}
      {client.notes.length > 0 && (
        <Section title="Notes">
          <div className="py-2 space-y-3">
            {client.notes.map(note => (
              <div key={note.id} className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-sm text-slate-700">{note.content}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
