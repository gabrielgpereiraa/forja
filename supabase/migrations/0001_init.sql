-- Forja — schema inicial (Supabase / Postgres)
--
-- Modelo "documento por entidade": cada tabela guarda um tipo de entidade do
-- domínio (hábitos, registros, tarefas...). O conteúdo fica em `data` (jsonb,
-- exatamente o objeto do app) e a sincronização usa `updated_at` (definido
-- pelo servidor) + `deleted_at` (exclusão lógica, para propagar entre aparelhos).
--
-- Segurança: Row Level Security em todas as tabelas — cada usuário só lê e
-- escreve linhas com o próprio `user_id`. A chave pública do site não dá
-- acesso a dados de ninguém sem uma sessão válida.

create or replace function public.forja_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'profiles',        -- perfil + ajustes (uma linha por usuário, id = 'main')
    'habits',
    'habit_logs',
    'tasks',
    'day_records',     -- dias encerrados (id = data ISO)
    'ledger_entries',  -- lançamentos de XP/foco
    'achievements',
    'skills',
    'skill_practices',
    'skill_links'      -- vínculo hábito → habilidade (id = habitId:skillId)
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
        id         text        not null check (char_length(id) between 1 and 128),
        data       jsonb       not null,
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        primary key (user_id, id)
      );
      create index if not exists %1$s_user_updated_idx on public.%1$I (user_id, updated_at);

      alter table public.%1$I enable row level security;

      drop policy if exists "own rows: select" on public.%1$I;
      drop policy if exists "own rows: insert" on public.%1$I;
      drop policy if exists "own rows: update" on public.%1$I;
      drop policy if exists "own rows: delete" on public.%1$I;
      create policy "own rows: select" on public.%1$I for select to authenticated
        using ((select auth.uid()) = user_id);
      create policy "own rows: insert" on public.%1$I for insert to authenticated
        with check ((select auth.uid()) = user_id);
      create policy "own rows: update" on public.%1$I for update to authenticated
        using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
      create policy "own rows: delete" on public.%1$I for delete to authenticated
        using ((select auth.uid()) = user_id);

      revoke all on table public.%1$I from anon;
      grant select, insert, update, delete on table public.%1$I to authenticated;

      drop trigger if exists touch_updated_at on public.%1$I;
      create trigger touch_updated_at before insert or update on public.%1$I
        for each row execute function public.forja_touch_updated_at();
    $f$, t);
  end loop;
end;
$$;
