'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import type { ProjectType, RevenueType, EntityType } from '@/lib/mock-data'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DbClient {
  id: string
  name: string
  harvestProjectCode: string
  archiveStatus: string
  processingCadence: string
  projectType: string | null
  revenueType: string | null
  qboOnly: boolean
  contractStartDate: string | null
  contractEndDate: string | null
  entityType: string | null
  guaranteedDeadlineDay: number | null
  softwareRate: number | null
  totalMonthlyAmount: number | null
  hasContractedLoom: boolean
  hasScheduledMeetings: boolean
  hasSignedAutoIncrease: boolean
  accountantName: string | null
  autoPriceIncreasePercent: number | null
  priceAdjustmentDate: string | null
  tags: { id: string; name: string; color: string }[]
  sows: { billingType: string; fixedMonthlyRate: number | null; billingRate: number | null; targetHours: number | null }[]
}

// ── Option lists ──────────────────────────────────────────────────────────────
const PROJECT_OPTS: { value: ProjectType; label: string }[] = [
  { value: 'ANNUAL',              label: 'Annual'               },
  { value: 'CLEAN_UP',            label: 'Clean Up'             },
  { value: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance'  },
  { value: 'QBO_ONLY',            label: 'QBO Only'             },
  { value: 'RECURRING',           label: 'Recurring'            },
]
const REVENUE_OPTS: { value: RevenueType; label: string }[] = [
  { value: 'CLEANUP',                    label: 'Cleanup'                      },
  { value: 'FREE',                       label: 'Free'                         },
  { value: 'HOURLY_CLEANUP',             label: 'Hourly Cleanup'               },
  { value: 'QBO_ONLY_ANCHOR',            label: 'QBO only - Anchor'            },
  { value: 'QBO_ONLY_QBO',               label: 'QBO only - QBO'               },
  { value: 'RECURRING_MONTHLY_ACH',      label: 'Recurring Monthly - ACH'      },
  { value: 'RECURRING_MONTHLY_HOURLY',   label: 'Recurring Monthly - Hourly'   },
  { value: 'RECURRING_MONTHLY_INVOICED', label: 'Recurring Monthly - Invoiced' },
]
const ENTITY_OPTS: { value: EntityType; label: string }[] = [
  { value: 'LLC',             label: 'LLC'             },
  { value: 'S_CORP',          label: 'S-Corp'          },
  { value: 'C_CORP',          label: 'C-Corp'          },
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP',     label: 'Partnership'     },
  { value: 'NON_PROFIT',      label: 'Non-Profit'      },
  { value: 'OTHER',           label: 'Other'           },
]

// ── Column definitions ────────────────────────────────────────────────────────
type ColKey = 'name' | 'projectType' | 'revenueType' | 'contractStart' | 'contractEnd' | 'entity' | 'bkRate' | 'swRate' | 'total' | 'deadline' | 'loom' | 'meetings' | 'autoIncrease'
type SortKey = 'name' | 'projectType' | 'revenueType' | 'contractEnd' | 'total'

const COL_META: { key: ColKey; label: string; sortKey?: SortKey; minWidth?: number; align?: 'right' | 'center' }[] = [
  { key: 'name',          label: 'Business Name',  sortKey: 'name',        minWidth: 200 },
  { key: 'projectType',   label: 'Project Type',