-- Rate limiting para endpoints publicos.
--
-- Modelo: una key (ej. 'public_booking:1.2.3.4') con counter + window_start.
-- Si la window expiro al hacer el check, se resetea. Si no, incrementa.
-- Devuelve true si esta DENTRO del limite, false si lo excedio.
--
-- Sin RLS para usuarios — solo service_role puede tocar la tabla. Como
-- las server actions corren con admin client, esto es seguro.

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- Sin policies = solo service_role. anon/authenticated no pueden leer/escribir.

-- Funcion atomica: upsert + reset si window expirada + return de si paso el limite.
create or replace function public.check_rate_limit(
  p_key text,
  p_max_count int,
  p_window_minutes int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when public.rate_limits.window_start < (now() - (p_window_minutes || ' minutes')::interval) then 1
      else public.rate_limits.count + 1
    end,
    window_start = case
      when public.rate_limits.window_start < (now() - (p_window_minutes || ' minutes')::interval) then now()
      else public.rate_limits.window_start
    end
  returning public.rate_limits.count into v_count;

  return v_count <= p_max_count;
end;
$$;

-- Cleanup periodico: borrar keys con window_start vieja (>1 dia) para que
-- la tabla no crezca infinito. Se llama desde el cron diario o manualmente.
create or replace function public.gc_rate_limits()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.rate_limits
  where window_start < (now() - interval '1 day');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
