// ============================================================
// storage.js — прогресс и рекорды пользователя.
//
// Прогресс всегда хранится в localStorage (память браузера) — это быстро и работает
// даже без интернета. Если игрок вошёл в аккаунт, после каждого результата
// копия уходит в облако (auth.js → Supabase), и на другом устройстве прогресс
// подтянется при входе.
//
// У каждого аккаунта своя запись в браузере (ключ с id игрока), у гостя — своя.
//
// Что храним:
//   lessons      — звёзды за каждый пройденный урок: { 1: 3, 2: 2 }
//   bestTraining — лучший счёт тренировки (сколько букв за минуту)
//   bestExamMs   — лучший экзамен: среднее время на одну букву, мс (слова разной длины — так честно)
//   letters      — по каждой букве: сколько раз показали и сколько раз с ошибкой
//   words        — собранные слова и звёзды за них: { "СОВА": 3, "НОС": 1 }
//
// Связь: game.js сохраняет результаты, main.js переключает владельца при входе/выходе.
// ============================================================

import { pushProgress } from "./auth.js";

const STORAGE_PREFIX = "azbuka-progress-v1";
let owner = "guest"; // id игрока или "guest"

function storageKey() {
  return `${STORAGE_PREFIX}:${owner}`;
}

function emptyProgress() {
  return { lessons: {}, bestTraining: 0, bestExamMs: null, letters: {}, words: {} };
}

// Кто сейчас играет. cloudProgress — прогресс из облака (при входе), его объединяем с локальным.
export function setOwner(playerId, cloudProgress = null) {
  owner = playerId || "guest";
  if (cloudProgress) saveProgress(mergeProgress(loadProgress(), cloudProgress), false);
}

// Объединяем два прогресса и берём лучшее из каждого — чтобы ничего не потерять.
function mergeProgress(a, b) {
  const lessons = { ...a.lessons };
  for (const n in b.lessons) lessons[n] = Math.max(lessons[n] || 0, b.lessons[n]);
  const exams = [a.bestExamMs, b.bestExamMs].filter((ms) => ms !== null && ms !== undefined);
  // Статистику букв берём из того, где букву показывали чаще.
  const letters = { ...a.letters };
  for (const l in b.letters) {
    if (!letters[l] || b.letters[l].shown > letters[l].shown) letters[l] = b.letters[l];
  }
  const words = { ...a.words };
  for (const w in b.words) words[w] = Math.max(words[w] || 0, b.words[w]);
  return {
    lessons,
    words,
    bestTraining: Math.max(a.bestTraining || 0, b.bestTraining || 0),
    bestExamMs: exams.length ? Math.min(...exams) : null,
    letters,
  };
}

// Читает прогресс. Если данных нет или они испорчены — начинаем с нуля.
export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()));
    return saved ? { ...emptyProgress(), ...saved } : emptyProgress();
  } catch {
    return emptyProgress(); // например, в режиме инкогнито localStorage может быть недоступен
  }
}

function saveProgress(progress, sendToCloud = true) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(progress));
  } catch {
    // Не сохранилось — не страшно, приложение всё равно работает.
  }
  if (sendToCloud) pushProgress(progress);
}

// Урок пройден: запоминаем лучший результат по звёздам.
export function saveLessonResult(lessonNumber, stars) {
  const progress = loadProgress();
  progress.lessons[lessonNumber] = Math.max(progress.lessons[lessonNumber] || 0, stars);
  saveProgress(progress);
}

// Возвращает true, если это новый рекорд тренировки.
export function saveTrainingResult(score) {
  const progress = loadProgress();
  const isRecord = score > progress.bestTraining;
  if (isRecord) progress.bestTraining = score;
  saveProgress(progress);
  return isRecord;
}

// Возвращает true, если это новый рекорд экзамена (меньше время на букву — лучше).
export function saveExamResult(msPerLetter) {
  const progress = loadProgress();
  const isRecord = progress.bestExamMs === null || msPerLetter < progress.bestExamMs;
  if (isRecord) progress.bestExamMs = msPerLetter;
  saveProgress(progress);
  return isRecord;
}

// Статистика по буквам — чтобы показать «самые трудные буквы».
export function saveLetterStats(letterResults) {
  const progress = loadProgress();
  for (const { letter, hadMistake } of letterResults) {
    const stat = progress.letters[letter] || { shown: 0, mistakes: 0 };
    stat.shown += 1;
    if (hadMistake) stat.mistakes += 1;
    progress.letters[letter] = stat;
  }
  saveProgress(progress);
}

// Слово собрано: запоминаем лучший результат по звёздам (в свободном письме — 1 звезда).
export function saveWord(word, stars) {
  const progress = loadProgress();
  progress.words[word] = Math.max(progress.words[word] || 0, stars);
  saveProgress(progress);
}

export function resetProgress() {
  saveProgress(emptyProgress());
}
