-- =============================================================
-- BBA Management Dashboard: Capacity Planning / Pods migration
-- Run in Supabase SQL Editor (project tkhmfexhcdxwtpfiviyo)
-- Conventions: camelCase columns, explicit id/createdAt/updatedAt defaults
-- =============================================================

-- 1. Pods
create table if not exists pods (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- 2. Employee capacity inputs (capacity is DERIVED, not stored)
--    Reuses existing contractedHours (weekly) + adminTimePercent (0-100) columns.
--    capacity = contractedHours * 4.33 * (1 - adminTimePercent/100) - fixedDeduction
alter table employees
  add column if not exists "podId" text references pods("id"),
  add column if not exists "fixedDeduction" numeric default 0,       -- Deb's 10 hrs non-pod QA
  add column if not exists "fixedDeductionLabel" text;

-- 3. Client workload inputs (drivers for the formulas)
alter table clients
  add column if not exists "totalBudgetedHours" numeric,
  add column if not exists "numBankAccounts" integer default 0,      -- banks + CCs combined
  add column if not exists "numLoans" integer default 0,
  add column if not exists "txnBucket" text,                         -- '0-100','101-200','201-300','301-400','401-500','500+'
  add column if not exists "numPmtPortals" integer default 0,
  add column if not exists "pettyCash" boolean default false,
  add column if not exists "apArHours" numeric default 0,            -- manual entry
  add column if not exists "prRecHours" numeric default 0,           -- manual entry
  add column if not exists "auditHours" numeric default 0,           -- manual entry
  add column if not exists "bankFeedHoursOverride" numeric,          -- null = use bucket lookup
  add column if not exists "recHoursOverride" numeric,               -- null = use rate * accounts
  add column if not exists "assignedPodId" text references pods("id");

-- 4. Capacity rate settings (editable from Settings page, no deploy needed)
create table if not exists "capacitySettings" (
  "id" text primary key default gen_random_uuid()::text,
  "key" text not null unique,
  "value" jsonb not null,
  "updatedAt" timestamptz not null default now()
);

insert into "capacitySettings" ("key", "value") values
  ('bankFeedBuckets', '{"0-100":0.75,"101-200":1.75,"201-300":2.50,"301-400":3.25,"401-500":4.00,"500+":4.75}'),
  ('recHoursPerAccount', '0.5'),
  ('recHoursPerLoan', '0'),
  ('tierRules', '{"thresholds":[10,20],"hours":[0.25,0.5,0.75]}'),  -- QA/CS/YE: <=10 -> 0.25, <=20 -> 0.5, else 0.75
  ('cleanupHourlyRate', '125')
on conflict ("key") do nothing;

-- 5. Task assignments: pod-level defaults + per-client overrides
--    taskType: 'bkpr','bankFeed','rec','apAr','prRec','qa','ye','audit'
create table if not exists "podTaskDefaults" (
  "id" text primary key default gen_random_uuid()::text,
  "podId" text not null references pods("id"),
  "taskType" text not null,
  "employeeId" text not null references employees("id"),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("podId", "taskType")
);

create table if not exists "clientTaskOverrides" (
  "id" text primary key default gen_random_uuid()::text,
  "clientId" text not null references clients("id"),
  "taskType" text not null,
  "employeeId" text not null references employees("id"),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("clientId", "taskType")
);

-- 6. Engagement history (cleanup -> monthly conversions keep one client record)
create table if not exists "clientEngagements" (
  "id" text primary key default gen_random_uuid()::text,
  "clientId" text not null references clients("id"),
  "engagementType" text not null,           -- 'cleanup' | 'monthly' | 'qboOnly'
  "startDate" date not null,
  "endDate" date,                           -- null = active
  "cleanupPrice" numeric,                   -- cleanup only: hours = price / cleanupHourlyRate
  "cleanupDurationMonths" integer,          -- spread hours across N months
  "notes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "clientEngagements_clientId_idx" on "clientEngagements" ("clientId");

-- 7. Seed Pod 1 with Deb + Jada capacity inputs and task defaults
--    (adjust employee name matching if needed)
insert into pods ("name") values ('Pod 1') on conflict do nothing;

update employees set
  "podId" = (select "id" from pods where "name" = 'Pod 1'),
  "contractedHours" = 40, "adminTimePercent" = 35,
  "fixedDeduction" = 10, "fixedDeductionLabel" = 'Non-pod QA'
where "name" ilike '%Deb%';   -- Deb Scotto -> capacity = 40*4.33*0.65 - 10 = 102.6

update employees set
  "podId" = (select "id" from pods where "name" = 'Pod 1'),
  "contractedHours" = 35, "adminTimePercent" = 15,
  "fixedDeduction" = 0
where "name" ilike '%Jada%';  -- Jada Johnson -> capacity = 35*4.33*0.85 = 128.8

insert into "podTaskDefaults" ("podId", "taskType", "employeeId")
select p."id", t.task, e."id"
from pods p,
  (values
    ('bkpr','Deb'), ('qa','Deb'),
    ('bankFeed','Jada'), ('rec','Jada'), ('apAr','Jada'), ('prRec','Jada'), ('ye','Jada')
  ) as t(task, who)
join employees e on e."name" ilike '%' || t.who || '%'
where p."name" = 'Pod 1'
on conflict ("podId","taskType") do nothing;
