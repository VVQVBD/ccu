// ============================================================
// auth.js — аккаунты игроков и общая таблица рекордов (Supabase).
//
// Supabase — бесплатная облачная база данных со встроенной регистрацией.
// Пароли хранит сам Supabase, мы их не видим. Таблица и правила доступа —
// supabase/schema.sql (каждый игрок может менять только свою строку).
//
// Если адрес и ключ Supabase в config.js не заданы — аккаунты просто выключены,
// приложение работает как раньше (прогресс только в этом браузере).
//
// Связь: main.js вызывает initAuth() при запуске и функции входа/выхода с экрана входа;
// storage.js вызывает pushProgress() после каждого результата; game.js — loadLeaderboard().
// ============================================================

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

let supabase = null;
let currentPlayer = null; // { id, username } или null, если не вошли

export function accountsEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function getPlayer() {
  return currentPlayer;
}

// Подключаемся к Supabase и проверяем, не вошёл ли игрок раньше (сессия хранится в браузере).
// Возвращает прогресс из облака или null.
export async function initAuth() {
  if (!accountsEnabled()) return null;
  // Библиотеку Supabase грузим с CDN — как и MediaPipe, ничего устанавливать не нужно.
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm");
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return loadPlayer(data.session.user.id);
}

// Читает строку игрока из таблицы players. Возвращает прогресс в формате storage.js.
async function loadPlayer(userId) {
  const { data, error } = await supabase.from("players").select("*").eq("id", userId).single();
  if (error || !data) return null;
  currentPlayer = { id: data.id, username: data.username };
  return {
    lessons: data.lessons || {},
    bestTraining: data.best_training || 0,
    bestExamMs: data.best_exam_ms,
    letters: data.letters || {},
  };
}

// Регистрация: имя для рейтинга, почта и пароль. Возвращает прогресс нового игрока.
export async function signUp(username, email, password) {
  username = username.trim();
  if (username.length < 2 || username.length > 20) throw new Error("Имя — от 2 до 20 символов");
  if (password.length < 6) throw new Error("Пароль — минимум 6 символов");

  // Заранее проверяем, не занято ли имя, — так ошибка будет понятной.
  const { data: taken } = await supabase.from("players").select("id").eq("username", username).maybeSingle();
  if (taken) throw new Error("Это имя уже занято — придумай другое");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username } }, // имя попадёт в таблицу players через триггер (schema.sql)
  });
  if (error) throw new Error(translateError(error.message));
  if (!data.session) throw new Error("Аккаунт создан, но нужно подтвердить почту — проверь письмо");
  return loadPlayer(data.user.id);
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translateError(error.message));
  return loadPlayer(data.user.id);
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  currentPlayer = null;
}

// Сохраняет прогресс в облако. Вызывается после каждого результата.
// Ошибку сети не показываем: прогресс всё равно сохранён в браузере и уйдёт в следующий раз.
export async function pushProgress(progress) {
  if (!supabase || !currentPlayer) return;
  const { error } = await supabase.from("players").update({
    lessons: progress.lessons,
    best_training: progress.bestTraining,
    best_exam_ms: progress.bestExamMs,
    letters: progress.letters,
    updated_at: new Date().toISOString(),
  }).eq("id", currentPlayer.id);
  if (error) console.warn("Не удалось сохранить прогресс в облако:", error.message);
}

// Общая таблица рекордов: лучшие по тренировке и по экзамену.
export async function loadLeaderboard(limit = 10) {
  if (!supabase) return null;
  const training = await supabase.from("players")
    .select("username, best_training").gt("best_training", 0)
    .order("best_training", { ascending: false }).limit(limit);
  const exam = await supabase.from("players")
    .select("username, best_exam_ms").not("best_exam_ms", "is", null)
    .order("best_exam_ms", { ascending: true }).limit(limit);
  return { training: training.data || [], exam: exam.data || [] };
}

// Ошибки Supabase приходят по-английски — переводим самые частые.
function translateError(message) {
  if (/invalid login credentials/i.test(message)) return "Неверная почта или пароль";
  if (/already registered|already been registered/i.test(message)) return "Эта почта уже зарегистрирована — войди";
  if (/valid email|invalid.*email/i.test(message)) return "Проверь адрес почты";
  if (/rate limit|too many/i.test(message)) return "Слишком много попыток — подожди минуту";
  if (/database error/i.test(message)) return "Это имя уже занято — придумай другое";
  return message;
}
