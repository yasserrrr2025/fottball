-- ترقية المزايا التشغيلية (1-8) دون ميزتي إخفاء البيانات ودعم عدة فرق
-- نفّذ بعد supabase_setup.sql

alter table public.submissions
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists consent_text_version text,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists submitter_ip_hash text,
  add column if not exists detected_bank_code text,
  add column if not exists bank_match_status text not null default 'not_checked'
    check (bank_match_status in ('matched','mismatched','not_checked')),
  add column if not exists review_note text,
  add column if not exists last_notified_at timestamptz;

create table if not exists public.bank_codes (
  code text primary key check (code ~ '^\\d{2}$'),
  bank_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.bank_codes is 'تُدخل الإدارة أكواد البنوك الرسمية المستخدمة في موضع رمز البنك داخل الآيبان السعودي.';

create table if not exists public.correction_tokens (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists correction_tokens_submission_idx on public.correction_tokens(submission_id, created_at desc);
create index if not exists correction_tokens_expiry_idx on public.correction_tokens(expires_at);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  channel text not null default 'whatsapp_copy' check (channel in ('whatsapp_copy','system')),
  recipient_phone text,
  template_key text not null,
  message_text text not null,
  status text not null default 'prepared' check (status in ('prepared','opened','sent','failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_submission_idx on public.notifications(submission_id, created_at desc);

alter table public.correction_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.bank_codes enable row level security;

create policy "admins manage correction tokens" on public.correction_tokens for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage notifications" on public.notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage bank codes" on public.bank_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.correction_tokens to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.bank_codes to authenticated;

grant usage, select on sequence public.notifications_id_seq to authenticated;

-- سجل تدقيق غني بالقيم قبل وبعد الإجراء
alter table public.submission_audit_log
  add column if not exists previous_values jsonb,
  add column if not exists new_values jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
