-- ============================================================
-- 003_words.sql — коллекция собранных слов (раздел «Слова»).
--
-- Запускать ПОСЛЕ schema.sql и 002_protect_scores.sql:
-- Supabase → SQL Editor → New query → вставить весь файл → Run. Повторный запуск безопасен.
--
-- words — собранные слова и звёзды за них: {"СОВА": 3, "НОС": 1}.
-- Игроку разрешаем менять эту колонку (как и остальные колонки прогресса).
-- ============================================================

alter table public.players add column if not exists words jsonb not null default '{}'::jsonb;

grant update (words) on public.players to authenticated;
