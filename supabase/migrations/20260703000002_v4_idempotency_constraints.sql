-- V4 idempotency constraints: prevent duplicate XP awards under concurrent requests

-- One gym check-in per user per UTC calendar day (DB-enforced, no application-level race)
CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_date_uniq
  ON public.checkins (user_id, date(created_at AT TIME ZONE 'UTC'));

-- Optional dedupe key on xp_transactions for once-per-period events (Sunday planning, etc.)
-- Nullable so existing rows without a key are unaffected.
ALTER TABLE public.xp_transactions
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS xp_transactions_dedupe_uniq
  ON public.xp_transactions (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
