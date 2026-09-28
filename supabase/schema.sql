-- ============================================================
-- schema.sql — база данных «Азбуки жестов» (Supabase, бесплатный тариф).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Запускать один раз. Повторный запуск тоже безопасен (всё с IF NOT EXISTS / OR REPLACE).
--
-- Что здесь:
--   1. Таблица players — один игрок = одна строка: имя и весь прогресс.
--   2. Защита (RLS): рейтинг видят все, а менять можно только СВОЮ строку.
--   3. Триггер: при регистрации строка игрока создаётся автоматически.
--
-- Регистрация и пароли — встроенная авторизация Supabase (таблица auth.users),
-- пароли мы сами не храним и не видим.
-- ============================================================

-- 1. Таблица игроков
create table if not exists public.players (
  id            uuid primary key references auth.users (id) on delete cascade, -- тот же id, что у аккаунта
  username      text not null unique check (char_length(username) between 2 and 20), -- имя в рейтинге
  lessons       jsonb not null default '{}'::jsonb,  -- звёзды за уроки: {"1": 3, "2": 2}
  best_training integer not null default 0,          -- лучший счёт тренировки (букв за минуту)
  best_exam_ms  integer,                             -- лучшее время экзамена, мс (null — ещё не сдавал)
  letters       jsonb not null default '{}'::jsonb,  -- статистика по буквам: {"В": {"shown": 5, "mistakes": 1}}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Защита на уровне строк (Row Level Security).
-- Без неё любой, у кого есть публичный ключ сайта, мог бы менять чужой прогресс.
alter table public.players enable row level security;

drop policy if exists "Рейтинг видят все" on public.players;
create policy "Рейтинг видят все"
  on public.players for select
  using (true);

drop policy if exists "Игрок меняет только свою строку" on public.players;
create policy "Игрок меняет только свою строку"
  on public.players for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3. При регистрации создаём строку игрока с именем из формы регистрации.
-- security definer — функция работает с правами владельца базы, поэтому
-- отдельное разрешение «вставлять строки» игрокам не нужно.
create or replace function public.create_player_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.players (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_player_for_new_user();
