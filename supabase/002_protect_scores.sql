-- ============================================================
-- 002_protect_scores.sql — защита рейтинга от накрутки и подмены имени.
--
-- Запускать ПОСЛЕ schema.sql: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Повторный запуск безопасен.
--
-- Проблема: правило из schema.sql разрешает игроку менять ЛЮБЫЕ колонки своей строки.
-- Через консоль браузера можно было бы написать себе рекорд 999 или сменить имя
-- в обход проверки «имя занято».
--
-- Решение:
--   1. Игрок может менять только колонки прогресса (не имя, не id, не дату создания).
--   2. Рекорды должны быть в разумных пределах (CHECK — база сама отклонит неправдоподобное).
-- Полностью защититься от накрутки без своего сервера нельзя — это честно говорим на защите.
-- ============================================================

-- 1. Права на изменение — только для колонок прогресса.
revoke update on public.players from anon, authenticated;
grant update (lessons, best_training, best_exam_ms, letters, updated_at) on public.players to authenticated;

-- 2. Разумные границы рекордов.
-- Тренировка длится 60 с, а одна буква занимает минимум ~1,4 с (удержание 0,7 с + пауза 0,7 с),
-- значит больше 60 букв за минуту физически не получится.
-- Экзамен храним как время НА ОДНУ БУКВУ (мс) — быстрее 1 секунды на букву не бывает.
alter table public.players drop constraint if exists best_training_realistic;
alter table public.players add constraint best_training_realistic check (best_training between 0 and 60);

alter table public.players drop constraint if exists best_exam_realistic;
alter table public.players add constraint best_exam_realistic check (best_exam_ms is null or best_exam_ms >= 1000);
