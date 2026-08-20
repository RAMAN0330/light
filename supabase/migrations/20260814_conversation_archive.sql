alter table public.conversations add column if not exists archived_at timestamptz;

create index if not exists conversations_user_active_created_at
  on public.conversations (user_id, created_at desc)
  where archived_at is null;
