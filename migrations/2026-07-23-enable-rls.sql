-- 2026-07-23 — Enable RLS on all application tables.
--
-- Why: the app's API routes are now gated server-side by requireAuth() and
-- talk to Supabase using the SERVICE ROLE key, which bypasses RLS. Turning
-- RLS on with NO policies means:
--   • service role (our API)     -> full access (unchanged)
--   • anon key (public browser)  -> zero access
--   • authenticated JWTs direct  -> zero access
-- That closes the "anyone with the anon key can hit the REST endpoint and
-- pull everything" hole. This is defense-in-depth on top of the API auth
-- gate — even if a route slips through without requireAuth(), or an anon
-- key holder tries to query the DB directly, they get nothing.
--
-- Safe to re-run. ALTER TABLE ... ENABLE RLS is idempotent.

ALTER TABLE IF EXISTS public.clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sows                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employee_rate_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accountants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pill_themes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pods                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."podTaskDefaults"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."changeRequests"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."clientAttachments"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.time_logs              ENABLE ROW LEVEL SECURITY;

-- Verify. After running the above, this should return 0 rows.
-- If any tables show rls_enabled = false, add them to the ALTER list above.
--
--   SELECT tablename, rowsecurity AS rls_enabled
--   FROM   pg_tables
--   WHERE  schemaname = 'public'
--   AND    rowsecurity = false
--   ORDER  BY tablename;
