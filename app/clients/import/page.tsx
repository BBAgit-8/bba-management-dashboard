'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type PreviewRow = Record<string, string>
type ResultRow  = { name: string; code: string; status: 'created' | 'skipped'; error?: string }

export default function ImportClientsPage() {
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<PreviewRow[]>([])
  const [headers,   setHeaders]   = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [results,   setResults]   = useState<{ total: number; created: number; skipped: number; results: ResultRow[] } | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  function parseFile(f: File) {
    setError(null); setResults(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        // Find the "Clients" sheet, fallback to first sheet
        const sheetName = wb.SheetNames.includes('Clients') ? 'Clients' : wb.SheetNames[0]
        const ws   = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

        // Find header row (first row with "Client Name" or "Project Code")
        let headerRowIdx = -1
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const rowStr = rows[i].join('|').toLowerCase()
          if (rowStr.includes('client name') || rowStr.includes('project code')) {
            headerRowIdx = i; break
          }
        }
        if (headerRowIdx === -1) { setError('Could not find header row. Make sure your file has "Client Name" and "Project Code" columns.'); return }

        const hdrs = rows[headerRowIdx].map(h => String(h).trim()).filter(Boolean)
        setHeaders(hdrs)

        // Data rows — skip example row (row immediately after headers if first cell is italic/example)
        const dataRows: PreviewRow[] = []
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i]
          // Skip empty rows and the example row (first data row with "Acme Corp" or similar marker)
          const nameVal = String(row[0] ?? '').trim()
          if (!nameVal) continue
          // Skip if it looks like the example row
          if (i === headerRowIdx + 1 && (nameVal === 'Acme Corp' || nameVal.toLowerCase().includes('example'))) continue
          const obj: PreviewRow = {}
          hdrs.forEach((h, idx) => { obj[h] = String(row[idx] ?? '').trim() })
          if (obj['Client Name'] || obj['Project Code']) dataRows.push(obj)
        }
        setPreview(dataRows)
        setFile(f)
      } catch (err: any) {
        setError('Could not parse file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }

  async function runImport() {
    if (!preview.length) return
    setImporting(true); setError(null)
    try {
      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setResults(json)
      setPreview([])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Import Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Upload your filled template to add multiple clients at once</p>
        </div>
        <Link href="/clients" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
          ← Back to Clients
        </Link>
      </div>

      {/* Steps */}
      {!results && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">How it works</h2>
          <ol className="space-y-2">
            {[
              'Download the template (link below), fill it in — one client per row starting at row 4',
              'Drag & drop or browse for your filled file below',
              'Review the preview to confirm the rows look correct',
              'Click Confirm Import — duplicates are skipped automatically',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: 'var(--bba-primary)' }}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Import complete</p>
              <p className="text-sm text-slate-500">{results.created} created · {results.skipped} skipped</p>
            </div>
            <Link href="/clients" className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--bba-primary)' }}>
              View Client List
            </Link>
          </div>
          {results.results.some(r => r.status === 'skipped') && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Skipped rows:</p>
              <div className="space-y-1">
                {results.results.filter(r => r.status === 'skipped').map((r, i) => (
                  <p key={i} className="text-xs text-amber-700">{r.name} ({r.code}) — {r.error}</p>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {results.results.filter(r => r.status === 'created').map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-green-500">✓</span>
                <span>{r.name}</span>
                <span className="text-slate-400 font-mono text-xs">{r.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload area */}
      {!results && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center hover:border-purple-300 transition-colors"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
              <svg className="h-7 w-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Drag & drop your Excel file here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse · .xlsx files only</p>
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-colors">
              Browse file
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100" style={{ backgroundColor: 'var(--bba-primary)' }}>
            <h3 className="text-sm font-semibold text-white">{preview.length} clients ready to import</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { setPreview([]); setFile(null) }}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors">
                Cancel
              </button>
              <button onClick={runImport} disabled={importing}
                className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
                style={{ color: 'var(--bba-primary)' }}>
                {importing ? 'Importing…' : `Confirm Import (${preview.length})`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Client Name','Project Code','Bookkeeper','Entity Type','Project Type','Bkpr Rate','Software Rate'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{row['Client Name']}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{row['Project Code']}</td>
                    <td className="px-3 py-2 text-slate-600">{row['Bookkeeper']}</td>
                    <td className="px-3 py-2 text-slate-600">{row['Entity Type']}</td>
                    <td className="px-3 py-2 text-slate-600">{row['Project Type']}</td>
                    <td className="px-3 py-2 text-slate-600">{row['Bookkeeping Rate'] ? `$${row['Bookkeeping Rate']}` : '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row['Software Rate'] ? `$${row['Software Rate']}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
