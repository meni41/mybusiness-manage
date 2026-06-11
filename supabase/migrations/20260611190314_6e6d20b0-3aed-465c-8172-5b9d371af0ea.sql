-- Migrate client_status enum to new values and add financial fields
ALTER TABLE public.clients ALTER COLUMN status DROP DEFAULT;

CREATE TYPE public.client_status_new AS ENUM ('quote', 'in_progress', 'archived');

ALTER TABLE public.clients
  ALTER COLUMN status TYPE public.client_status_new
  USING (
    CASE status::text
      WHEN 'lead' THEN 'quote'
      WHEN 'active' THEN 'in_progress'
      WHEN 'inactive' THEN 'archived'
      WHEN 'archived' THEN 'archived'
      ELSE 'quote'
    END
  )::public.client_status_new;

DROP TYPE public.client_status;
ALTER TYPE public.client_status_new RENAME TO client_status;

ALTER TABLE public.clients ALTER COLUMN status SET DEFAULT 'quote'::public.client_status;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_meters numeric(12,2),
  ADD COLUMN IF NOT EXISTS quote_rate numeric(12,2) NOT NULL DEFAULT 80;