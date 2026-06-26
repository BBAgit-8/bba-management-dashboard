"use client";

import Link from "next/link";
import { useState, useEffect } from 'react';
import DashboardTab     from "./tabs/DashboardTab";
import ProfitabilityTab from "./tabs/ProfitabilityTab";
import SettingsTab      from "./tabs/SettingsTab";

type Tab = 'dashboard' | 'profitability' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'profitability',
    label: 'Profitability',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface Props { projectCode: string }

export default function ClientWorkspace({ projectCode }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [client, setClient]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        const found = (d.clients ?? []).find((c: any) => c.harvestProjectCode === projectCode);
        setClient(found ?? null);
      })
      .catch(() => setClient(null))
      .finally(() => setLoading(false));
  }, [projectCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-700 font-medium">Client not found</p>
        <p className="text-sm text-slate-500">No client with project code <span className="font-mono text-bba-primary">{projectCode}</span></p>
        <Link href="/" className="mt-2 text-sm text-bba-action hover:text-purple-800 underline underline-offset-2 transition-colors">
          ← Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb + client header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 transition-colors">Directory</Link>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-mono text-slate-500">{projectCode}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{client.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5">
                {client.harvestProjectCode}
              </span>
              {client.accountantName && (
                <span className="text-xs text-slate-500">
                  Acct: <span className="text-slate-700 font-medium">{client.accountantName}</span>
                </span>
              )}
              {client.bookkeeper && (
                <span className="text-xs text-slate-500">
                  Bkpr: <span className="text-slate-700 font-medium">{client.bookkeeper}</span>
                </span>
              )}
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                client.archiveStatus === 'ACTIVE'
                  ? 'bg-green-50 text-green-700 ring-green-200'
                  : 'bg-slate-100 text-slate-500 ring-slate-200'
              }`}>
                {client.archiveStatus}
              </span>
              {client.tags.map((tag: { id: string; name: string; color: string }) => (
                <span
                  key={tag.id}
                  className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="sticky top-0 z-10 -mx-8 px-8 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active ? 'text-bba-action' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className={active ? 'text-bba-action' : 'text-slate-400'}>{tab.icon}</span>
                {tab.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-bba-action" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-6">
        {activeTab === 'dashboard'     && <DashboardTab     clientId={client.id} client={client} projectCode={client.harvestProjectCode} />}
        {activeTab === 'profitability' && <ProfitabilityTab clientId={client.id} />}
        {activeTab === 'settings'      && <SettingsTab      clientId={client.id} projectCode={client.harvestProjectCode} client={client} />}
      </div>
    </div>
  );
}
