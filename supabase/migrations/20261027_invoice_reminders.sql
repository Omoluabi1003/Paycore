create table if not exists public.invoices (
 id text primary key,
 number text not null,
 customer text not null,
 customer_email text not null,
 due_on date not null,
 status text not null default 'OPEN',
 balance_cents bigint not null check (balance_cents >= 0),
 company_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.invoice_reminder_events (
 id text primary key,
 invoice_id text not null references public.invoices(id) on delete cascade,
 stage text not null,
 scheduled_for date not null,
 sent_at timestamptz,
 status text not null check(status in ('PENDING','SENT','FAILED','SKIPPED')),
 reason text,
 created_at timestamptz not null default now()
);
create index if not exists invoice_reminder_events_invoice_idx on public.invoice_reminder_events(invoice_id,created_at desc);
