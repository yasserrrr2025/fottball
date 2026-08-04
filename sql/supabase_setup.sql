-- نظام تسجيل واعتماد لاعبي فريق كرة القدم
-- نفّذ الملف كاملًا مرة واحدة من Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.submission_status as enum (
  'pending_review',
  'returned_for_correction',
  'approved',
  'rejected'
);

create type public.iban_match_status as enum (
  'matched',
  'mismatched',
  'not_found',
  'unsupported',
  'failed'
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.team_settings (
  id uuid primary key default gen_random_uuid(),
  sport_type text not null default 'كرة القدم',
  category text not null default 'U13',
  gender text not null default 'بنين',
  school_name text not null default 'عماد الدين زنكي المتوسطة',
  players_count integer not null default 20 check (players_count > 0),
  coach_name text not null default 'موسى مهدي الفاهمي',
  coach_national_id text not null default '1086500525' check (coach_national_id ~ '^\d{10}$'),
  coach_phone text not null default '966508812384',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_team_settings on public.team_settings ((is_active)) where is_active = true;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 4),
  national_id text not null unique check (national_id ~ '^\d{10}$'),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  has_student_bank_account boolean not null,
  student_iban text,
  guardian_name text,
  guardian_phone text,
  guardian_iban text,
  bank_name text not null,
  iban_attachment_path text not null,
  extracted_iban text,
  iban_match_status public.iban_match_status not null default 'not_found',
  iban_match_confidence numeric(5,2),
  iban_verified_at timestamptz,
  status public.submission_status not null default 'pending_review',
  return_reason text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_owner_fields check (
    (has_student_bank_account = true and student_iban is not null and guardian_name is null and guardian_phone is null and guardian_iban is null)
    or
    (has_student_bank_account = false and student_iban is null and guardian_name is not null and guardian_phone is not null and guardian_iban is not null)
  ),
  constraint student_iban_format check (student_iban is null or student_iban ~ '^SA[0-9]{22}$'),
  constraint guardian_iban_format check (guardian_iban is null or guardian_iban ~ '^SA[0-9]{22}$'),
  constraint extracted_iban_format check (extracted_iban is null or extracted_iban ~ '^SA[0-9]{22}$')
);

create table public.submission_audit_log (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  action text not null,
  reason text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index students_name_idx on public.students using gin (to_tsvector('simple', full_name));
create index submissions_status_idx on public.submissions(status);
create index submissions_submitted_at_idx on public.submissions(submitted_at desc);
create index audit_submission_idx on public.submission_audit_log(submission_id, created_at desc);

insert into public.team_settings default values;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.team_settings enable row level security;
alter table public.students enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_audit_log enable row level security;

create policy "admins read admin users" on public.admin_users for select to authenticated using (public.is_admin());
create policy "admins read team settings" on public.team_settings for select to authenticated using (public.is_admin());
create policy "admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage submissions" on public.submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit" on public.submission_audit_log for select to authenticated using (public.is_admin());

-- لا تمنح anon أي صلاحية مباشرة؛ بوابة الطالب تستخدم Route Handlers بمفتاح service role المخزن في الخادم.
revoke all on public.admin_users from anon;
revoke all on public.team_settings from anon;
revoke all on public.students from anon;
revoke all on public.submissions from anon;
revoke all on public.submission_audit_log from anon;

grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select on public.team_settings to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.submission_audit_log to authenticated;

-- Bucket خاص للمستندات البنكية. الملفات ليست عامة.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iban-documents',
  'iban-documents',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- وصول الإدارة إلى الملفات عبر Supabase Auth. بوابة الطالب ترفع من الخادم بمفتاح service role.
create policy "admins select iban documents"
on storage.objects for select to authenticated
using (bucket_id = 'iban-documents' and public.is_admin());

create policy "admins insert iban documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'iban-documents' and public.is_admin());

create policy "admins update iban documents"
on storage.objects for update to authenticated
using (bucket_id = 'iban-documents' and public.is_admin())
with check (bucket_id = 'iban-documents' and public.is_admin());

create policy "admins delete iban documents"
on storage.objects for delete to authenticated
using (bucket_id = 'iban-documents' and public.is_admin());

-- بعد إنشاء مستخدم الإدارة من Authentication > Users، نفّذ المثال التالي بعد استبدال البريد:
-- insert into public.admin_users (user_id, full_name)
-- select id, 'مدير النظام' from auth.users where email = 'admin@example.com'
-- on conflict (user_id) do update set is_active = true;
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
