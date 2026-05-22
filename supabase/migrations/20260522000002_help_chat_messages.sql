-- Chat de ayuda IA — historial persistente por user + org.
--
-- Cada mensaje (del user o del asistente) guarda 1 fila.
-- El user ve su propio historial cuando vuelve.
-- Rate limit por hora se calcula contando rows con role='user' en la
-- última hora del user.

create table if not exists public.help_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tokens_used int, -- aproximado, solo para tracking de costos (NULL en user msgs)
  created_at timestamptz not null default now()
);

create index if not exists help_chat_messages_user_idx
  on public.help_chat_messages (user_id, created_at desc);

create index if not exists help_chat_messages_org_idx
  on public.help_chat_messages (organization_id, created_at desc);

-- Para el rate limit (count msgs del user en última hora)
create index if not exists help_chat_messages_user_recent_idx
  on public.help_chat_messages (user_id, created_at)
  where role = 'user';

alter table public.help_chat_messages enable row level security;

-- El user ve solo SUS mensajes (no los de otros miembros de la org)
create policy "user sees own chat" on public.help_chat_messages
  for select using (user_id = auth.uid());

comment on table public.help_chat_messages is
  'Historial del chat de ayuda IA. 1 fila por mensaje (user o assistant). Persistente — el user vuelve y ve su conversación previa.';
