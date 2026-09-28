// ============================================================
// game.js — сценарий приложения: урок, тренировка, экзамен и итоги.
//
// Путь пользователя: Меню → Урок 1 → Урок 2 → Урок 3 → Тренировка / Экзамен → Итоги.
//   Урок       — буквы урока по очереди, с фото и описанием. Без таймера.
//   Тренировка — 60 секунд, случайные пройденные буквы. Счёт = сколько букв успел.
//   Экзамен    — собери слова по буквам на время. Эталон — только если застрял.
// Правила счёта (точность, звёзды) — docs/PLAN.md, раздел 4.
//
// Связь: main.js на каждом кадре вызывает onFrame(); для каждой буквы
// создаётся LetterJudge (mistakes.js); на экран выводит ui.js; рекорды — storage.js.
// ============================================================

import { LESSONS, WORDS } from "./letters.js";
import { LetterJudge } from "./mistakes.js";
import {
  TRAINING_DURATION_S, EXAM_WORDS_COUNT, SHOW_SKIP_AFTER_MS, STARS_3_ACCURACY, STARS_2_ACCURACY,
  MISTAKE_HINTS_COUNT,
} from "./config.js";
import * as ui from "./ui.js";
import * as storage from "./storage.js";
import * as writing from "./writing.js";
import { playSuccess, playHint, playFinish } from "./sound.js";
import { burstFromElement, burstConfetti, flashStage } from "./effects.js";
import { getPlayer, loadLeaderboard } from "./auth.js";

const PRAISES = ["Отлично!", "Точно!", "Супер!", "Молодец!", "Идеально!"];
const PRAISE_PAUSE_MS = 700; // пауза после засчитанной буквы, чтобы порадоваться

let session = null; // текущий режим (null — мы в меню)

// ---------- Что открыто ----------

// Урок открыт, если пройден предыдущий. Тренировка — после урока 1, экзамен — после урока 2.
function isLessonOpen(n, progress) {
  return n === 1 || Boolean(progress.lessons[n - 1]);
}

// Буквы из пройденных уроков — для тренировки и экзамена.
function learnedLetters(progress) {
  return Object.keys(LESSONS).filter((n) => progress.lessons[n]).flatMap((n) => LESSONS[n]);
}

// Остановить текущий режим без итогов (например, при выходе из аккаунта).
export function stop() {
  session = null;
}

export function showMenu() {
  session = null;
  const progress = storage.loadProgress();
  const items = Object.keys(LESSONS).map((key) => {
    const n = Number(key);
    const stars = progress.lessons[n] || 0;
    const open = isLessonOpen(n, progress);
    return {
      action: "lesson", lesson: n, title: `Урок ${n}: ${LESSONS[n].join(" ")}`,
      sub: stars ? "★".repeat(stars) + "☆".repeat(3 - stars) : open ? "Новый урок" : "Сначала пройди предыдущий",
      locked: !open, primary: open && !stars,
    };
  });
  items.push({
    action: "training", title: "Тренировка", sub: `${TRAINING_DURATION_S} секунд на скорость`,
    locked: !progress.lessons[1],
  });
  items.push({
    action: "exam", title: "Экзамен", sub: "Собери слово",
    locked: !progress.lessons[2],
  });
  items.push({
    action: "words", title: "Слова", sub: "Письмо рукой и словарь",
    locked: !progress.lessons[1],
  });
  items.push({ action: "alphabet", title: "Алфавит", sub: "Все 33 буквы" });
  items.push({ action: "records", title: "Рекорды", sub: "и прогресс", wide: true });
  const player = getPlayer();
  ui.renderMenu(items, player ? `Привет, ${player.username}!` : "Учим дактильную азбуку");
  ui.showScreen("menu");
}

// ---------- Запуск режимов ----------

export function startLesson(n, now) {
  session = {
    type: "lesson", lesson: n, title: `Урок ${n}`,
    letters: [...LESSONS[n]], index: 0, results: [], startedAt: now,
  };
  beginLetter(now);
}

export function startTraining(now) {
  session = {
    type: "training", title: "Тренировка",
    pool: learnedLetters(storage.loadProgress()),
    letters: [], index: 0, results: [], startedAt: now,
  };
  session.letters.push(randomLetter(session.pool, null));
  beginLetter(now);
}

export function startExam(now) {
  const learned = learnedLetters(storage.loadProgress());
  // Только слова, все буквы которых уже пройдены.
  const available = WORDS.filter((w) => [...w].every((ch) => learned.includes(ch)));
  const words = pickExamWords(available);
  session = {
    type: "exam", title: "Экзамен", words,
    letters: words.flatMap((w) => [...w]), index: 0, results: [], startedAt: now,
  };
  beginLetter(now);
}

// ---------- Раздел «Слова» ----------

// Экран словаря: все слова; открыты те, все буквы которых уже пройдены.
export function showWords() {
  session = null;
  const progress = storage.loadProgress();
  const learned = learnedLetters(progress);
  const items = WORDS.map((word) => ({
    word,
    stars: progress.words[word] || 0,
    locked: ![...word].every((ch) => learned.includes(ch)),
  }));
  ui.renderWords(items);
  ui.showScreen("words");
}

// Раздел «Алфавит»: все 33 буквы.
export function showAlphabet() {
  session = null;
  ui.renderAlphabet("all");
  ui.showScreen("alphabet");
}

// Тренировка одного слова из словаря (или одной буквы из «Алфавита»):
// буквы по очереди, схема руки видна всегда.
function startWord(word, now) {
  session = {
    type: "word", title: word.length === 1 ? `Буква «${word}»` : `Слово «${word}»`, words: [word],
    letters: [...word], index: 0, results: [], startedAt: now,
  };
  beginLetter(now);
}

// Свободное письмо: вся логика — в writing.js.
export function startWriting() {
  session = { type: "write" };
  writing.startWriting();
  ui.showScreen("write");
}

// Повторить последний режим (кнопка «Ещё раз» на итогах).
let lastStart = null;
export function restart(now) {
  if (!lastStart) return;
  lastStart(now);
  ui.showScreen("play");
}

// param — номер урока (для урока) или слово (для тренировки слова).
export function start(type, now, param) {
  if (type === "lesson") lastStart = (t) => startLesson(param, t);
  if (type === "word") lastStart = (t) => startWord(param, t);
  if (type === "training") lastStart = (t) => startTraining(t);
  if (type === "exam") lastStart = (t) => startExam(t);
  lastStart(now);
  ui.showScreen("play");
}

// ---------- Буква за буквой ----------

function beginLetter(now) {
  const letter = session.letters[session.index];
  session.judge = new LetterJudge(letter, now);
  session.letterStartedAt = now;
  session.pauseUntil = 0;
  session.lastHint = null;
  ui.hidePraise();
  ui.setHint(null);
  ui.setHoldProgress(0);
}

// Буква засчитана или пропущена.
function finishLetter(now, skipped) {
  const judge = session.judge;
  session.results.push({
    letter: judge.letterKey,
    // Одна подсказка — это нормальное обучение, а не ошибка. Ошибка — если понадобилось
    // MISTAKE_HINTS_COUNT подсказок или больше, либо букву пропустили.
    hadMistake: skipped || judge.mistakeCount >= MISTAKE_HINTS_COUNT,
    mistakes: judge.mistakeCount + (skipped ? 1 : 0),
    skipped,
  });
  if (!skipped) {
    playSuccess();
    ui.showPraise(PRAISES[Math.floor(Math.random() * PRAISES.length)]);
    burstFromElement(ui.getTargetElement(), 40); // конфетти из буквы
    flashStage();                                // зелёная вспышка по краям камеры
    ui.setHint(null);
    session.pauseUntil = now + PRAISE_PAUSE_MS;
  } else {
    goToNextLetter(now);
  }
}

function goToNextLetter(now) {
  session.index += 1;
  if (session.type === "training") {
    session.letters.push(randomLetter(session.pool, session.letters[session.index - 1]));
  }
  if (session.index >= session.letters.length) {
    finishSession(now);
    return;
  }
  beginLetter(now);
}

export function skipLetter(now) {
  if (session && !session.pauseUntil) finishLetter(now, true);
}

// ---------- Каждый кадр ----------

// features — признаки руки (или null), pointing — жест «указка».
// Возвращает подсветку пальцев для draw.js (или null, если не в игре).
export function onFrame(features, pointing, now) {
  if (!session) return null;
  if (session.type === "write") return writing.onFrame(features, pointing, now);

  // Время тренировки вышло.
  if (session.type === "training" && now - session.startedAt >= TRAINING_DURATION_S * 1000) {
    finishSession(now);
    return null;
  }

  // Пауза на похвалу после буквы.
  if (session.pauseUntil) {
    if (now >= session.pauseUntil) goToNextLetter(now);
    if (!session) return null;
    renderPlayView(now);
    return null;
  }

  const verdict = session.judge.update(features, now, pointing);
  ui.setHoldProgress(verdict.holdProgress);
  ui.setHint(verdict.hint);
  if (verdict.hint && verdict.hint !== session.lastHint) playHint();
  session.lastHint = verdict.hint;

  if (verdict.done) finishLetter(now, false);
  renderPlayView(now);
  return verdict;
}

// Собирает, что показать на экране игры, и отдаёт в ui.js.
function renderPlayView(now) {
  const s = session;
  const letter = s.letters[s.index];
  const stuck = now - s.letterStartedAt >= SHOW_SKIP_AFTER_MS;
  const view = {
    modeTitle: s.title, letter, word: null, wordPosition: 0,
    // В уроке и тренировке слова эталон виден всегда; в тренировке и экзамене — только если застрял.
    showReference: s.type === "lesson" || s.type === "word" || stuck,
    showSkip: stuck && !s.pauseUntil,
    info: "",
  };

  if (s.type === "lesson") {
    view.info = `${s.index + 1} / ${s.letters.length}`;
  }
  if (s.type === "training") {
    const left = Math.max(0, Math.ceil(TRAINING_DURATION_S - (now - s.startedAt) / 1000));
    const score = s.results.filter((r) => !r.skipped).length;
    view.info = `⏱ ${left} с · ${score} ✓`;
  }
  if (s.type === "exam" || s.type === "word") {
    // Находим, какое слово сейчас и какая в нём буква.
    let position = s.index;
    let wordIndex = 0;
    while (position >= s.words[wordIndex].length) {
      position -= s.words[wordIndex].length;
      wordIndex += 1;
    }
    view.word = s.words[wordIndex];
    view.wordPosition = s.pauseUntil ? position + 1 : position;
    view.info = s.type === "word"
      ? `${Math.min(s.index + 1, s.letters.length)} / ${s.letters.length}`
      : `Слово ${wordIndex + 1} / ${s.words.length} · ⏱ ${formatTime(now - s.startedAt)}`;
  }
  ui.renderPlay(view);
}

// ---------- Итоги ----------

function finishSession(now) {
  const s = session;
  session = null;
  playFinish();

  // В тренировке последняя буква могла остаться недоделанной — её не считаем.
  const results = s.results;
  const total = results.length;
  const clean = results.filter((r) => !r.hadMistake).length;
  const accuracy = total ? Math.round((clean / total) * 100) : 0;
  let stars = 1;
  if (accuracy >= STARS_2_ACCURACY) stars = 2;
  if (accuracy >= STARS_3_ACCURACY) stars = 3;
  const timeMs = now - s.startedAt;

  storage.saveLetterStats(results);
  const rows = [["Точность", `${accuracy}%`]];
  let isRecord = false;
  let title = "";

  if (s.type === "lesson") {
    storage.saveLessonResult(s.lesson, stars);
    title = `Урок ${s.lesson} пройден!`;
    rows.push(["Букв", `${total}`], ["Время", formatTime(timeMs)]);
    const next = LESSONS[s.lesson + 1];
    if (next) rows.push(["Открыт урок", `${s.lesson + 1}: ${next.join(" ")}`]);
  }
  if (s.type === "training") {
    const score = results.filter((r) => !r.skipped).length;
    if (total === 0) stars = 0;
    isRecord = score > 0 && storage.saveTrainingResult(score);
    title = "Тренировка окончена!";
    rows.unshift(["Букв за минуту", `${score}`]);
    rows.push(["Лучший результат", `${storage.loadProgress().bestTraining}`]);
  }
  if (s.type === "word" && s.words[0].length === 1) {
    title = `Буква «${s.words[0]}» получилась!`;
    rows.push(["Время", formatTime(timeMs)]);
  } else if (s.type === "word") {
    storage.saveWord(s.words[0], stars);
    title = `Слово «${s.words[0]}» собрано!`;
    rows.push(["Время", formatTime(timeMs)]);
    const collected = Object.keys(storage.loadProgress().words).length;
    rows.push(["В коллекции", `${collected} из ${WORDS.length} слов`]);
  }
  if (s.type === "exam") {
    // Слова разной длины, поэтому для рекорда считаем время на ОДНУ букву — так честно.
    const msPerLetter = Math.round(timeMs / total);
    isRecord = storage.saveExamResult(msPerLetter);
    rows.push(["На одну букву", formatSeconds(msPerLetter)]);
    title = "Экзамен сдан!";
    rows.push(["Слова", s.words.join(", ")], ["Время", formatTime(timeMs)]);
    rows.push(["Лучший результат", formatSeconds(storage.loadProgress().bestExamMs)]);
  }

  ui.renderResults({ title, stars, isRecord, rows, hardText: hardLettersText(results) });
  // Салют в итогах: за три звезды или новый рекорд — побольше.
  const big = stars === 3 || isRecord;
  setTimeout(() => burstConfetti(window.innerWidth / 2, window.innerHeight / 3, big ? 160 : 60), 300);
  ui.showScreen("results");
}

// «Потренируй ещё: Н, Р» — буквы, где было больше всего подсказок.
function hardLettersText(results) {
  const hard = results
    .filter((r) => r.hadMistake)
    .sort((a, b) => b.mistakes - a.mistakes)
    .map((r) => r.letter);
  const unique = [...new Set(hard)].slice(0, 3);
  return unique.length ? `Потренируй ещё: ${unique.join(", ")}` : "Все буквы без ошибок — так держать!";
}

export async function showRecords() {
  const progress = storage.loadProgress();
  const lessonsDone = Object.keys(progress.lessons).length;
  const rows = [
    ["Пройдено уроков", `${lessonsDone} из ${Object.keys(LESSONS).length}`],
    ["Лучшая тренировка", progress.bestTraining ? `${progress.bestTraining} букв/мин` : "—"],
    ["Лучший экзамен", progress.bestExamMs ? formatSeconds(progress.bestExamMs) : "—"],
  ];
  // Самые трудные буквы — по доле попыток с ошибкой.
  const hard = Object.entries(progress.letters)
    .filter(([, stat]) => stat.mistakes > 0)
    .sort(([, a], [, b]) => b.mistakes / b.shown - a.mistakes / a.shown)
    .slice(0, 3)
    .map(([letter, stat]) => `${letter} (${Math.round((stat.mistakes / stat.shown) * 100)}% с ошибкой)`);
  ui.renderRecords(rows, hard.length ? `Самые трудные буквы: ${hard.join(", ")}` : "");
  ui.showScreen("records");
  // Общая таблица всех игроков — из облака (если аккаунты включены).
  const board = await loadLeaderboard();
  const player = getPlayer();
  ui.renderLeaderboard(board, player ? player.username : null, formatSeconds);
}

// ---------- Мелкие помощники ----------

function randomLetter(pool, previous) {
  const choices = pool.filter((l) => l !== previous); // одна и та же буква два раза подряд — скучно
  return choices[Math.floor(Math.random() * choices.length)];
}

// Выбирает слова для экзамена так, чтобы на стыке слов не было одинаковых букв подряд
// (ВАШ → ШАР: вторая «Ш» засчиталась бы сама, без нового жеста). Пробуем несколько раз.
function pickExamWords(available) {
  let words = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    words = shuffle(available).slice(0, EXAM_WORDS_COUNT);
    // Есть ли слово, которое начинается с той же буквы, которой кончается предыдущее?
    const repeats = words.some((word, i) => i > 0 && word[0] === words[i - 1].slice(-1));
    if (!repeats) return words;
  }
  return words;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 1840 мс → «1,8 с на букву»
function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} с на букву`;
}

function formatTime(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
