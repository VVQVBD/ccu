// ============================================================
// writing.js — СВОБОДНОЕ ПИСЬМО: «клавиатура из руки».
//
// Пользователь показывает любые буквы, приложение само узнаёт каждую
// (recognizeLetter из mistakes.js) и печатает её в строку.
// Как только в конце строки сложилось слово из словаря (СОВА, НОС…) —
// праздник, слово попадает в коллекцию (storage.saveWord).
//
// Чтобы одна буква не напечаталась много раз подряд, после каждой буквы
// ждём, пока рука сменит жест («отпустит» букву).
//
// Связь: game.js запускает письмо (startWriting) и на каждом кадре передаёт
// сюда признаки руки; на экран выводит ui.js (renderWrite).
// ============================================================

import { recognizeLetter } from "./mistakes.js";
import { WORDS } from "./letters.js";
import { WRITE_HOLD_MS, WRITE_MAX_LENGTH } from "./config.js";
import * as ui from "./ui.js";
import * as storage from "./storage.js";
import { playSuccess, playFinish } from "./sound.js";
import { burstFromElement, burstConfetti } from "./effects.js";

let text = "";            // напечатанный текст
let candidate = null;     // буква, которую сейчас держат
let candidateSince = 0;   // с какого момента её держат
let lastTyped = null;     // последняя напечатанная буква — ждём, пока рука её «отпустит»
let foundThisTime = [];   // слова, собранные за этот заход
let collected = {};       // вся коллекция слов игрока (читаем один раз при старте, а не каждый кадр)

export function startWriting() {
  text = "";
  candidate = null;
  lastTyped = null;
  foundThisTime = [];
  collected = storage.loadProgress().words || {};
  render(null, 0, "Покажи любую букву и подержи — я её напечатаю");
}

// Каждый кадр. Возвращает подсветку для скелета руки (для draw.js).
export function onFrame(features, pointing, now) {
  if (!features || pointing) {
    candidate = null;
    lastTyped = null; // руку убрали или взяли «указку» — ту же букву можно печатать снова
    render(null, 0, pointing ? "☝️ Указка: нажми кнопку" : "Покажи букву в камеру");
    return null;
  }

  const { letter, problem } = recognizeLetter(features);

  // Ждём, пока рука сменит жест после напечатанной буквы.
  if (lastTyped && letter === lastTyped) {
    render(letter, 1, "Смени жест, чтобы напечатать следующую букву");
    return { badFingers: [], mainFinger: null };
  }
  lastTyped = null;

  if (letter !== candidate) {
    candidate = letter;
    candidateSince = now;
  }

  if (!letter) {
    render(null, 0, problem || "Не узнаю букву — сложи пальцы как на схеме");
    return null;
  }

  const progress = (now - candidateSince) / WRITE_HOLD_MS;
  if (progress >= 1) {
    typeLetter(letter);
    return { badFingers: [], mainFinger: null };
  }
  render(letter, progress, `Вижу «${letter}» — держи`);
  return { badFingers: [], mainFinger: null };
}

function typeLetter(letter) {
  text += letter;
  lastTyped = letter;
  candidate = null;
  playSuccess();
  burstFromElement(document.getElementById("write-now"), 20);

  // Сложилось ли слово? Проверяем последнюю «часть» строки (после пробела).
  const lastPart = text.split(" ").pop();
  const word = WORDS.find((w) => lastPart.endsWith(w) && lastPart.length === w.length);
  if (word) {
    text += " "; // после слова — пробел, следующее слово начнётся с чистого листа
    storage.saveWord(word, 1);
    collected[word] = Math.max(collected[word] || 0, 1);
    if (!foundThisTime.includes(word)) foundThisTime.push(word);
    playFinish();
    burstConfetti(window.innerWidth / 2, window.innerHeight / 3, 140);
    ui.showWriteToast(`Слово «${word}»! 🎉`);
  }

  // Слишком длинную строку обрезаем слева — чтобы помещалась на экране.
  if (text.length > WRITE_MAX_LENGTH) text = text.slice(text.length - WRITE_MAX_LENGTH);
  render(letter, 1, "Смени жест, чтобы напечатать следующую букву");
}

// Кнопка «⌫ Стереть»: убираем последнюю букву (и пробел перед ней, если он в конце).
export function backspace() {
  text = text.trimEnd().slice(0, -1);
  render(null, 0, "Буква стёрта");
}

export function clearText() {
  text = "";
  render(null, 0, "Строка очищена — покажи букву");
}

function render(letter, progress, status) {
  ui.renderWrite({
    text,
    letter,
    progress,
    status,
    found: foundThisTime,
    collected,
  });
}
