// ============================================================
// ui.js — всё, что видно на экране: экраны, кнопки, буква, подсказка, итоги.
// А ещё — управление без мыши: курсор-палец и нажатие «наведи и подержи».
//
// Сам ui.js ничего не решает: что показывать, говорит game.js,
// где рука — говорит main.js. Так логику легче проверять и объяснять.
// ============================================================

import { LETTERS } from "./letters.js";
import { DWELL_MS, CURSOR_ZONE_MIN, CURSOR_ZONE_MAX, FINGERS } from "./config.js";
import { playClick } from "./sound.js";

const $ = (id) => document.getElementById(id);

// Имена файлов эталонных фото латиницей (кириллица в адресах иногда ломается).
const PHOTO_FILES = { "В": "v", "А": "a", "У": "u", "И": "i", "Ы": "y", "Ш": "sh", "О": "o", "Н": "n", "Р": "r", "С": "s" };

// ---------- Экраны ----------

export function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  $("menu-button").hidden = name === "menu";
}

// Все кнопки с data-action нажимаются одинаково (мышью, пальцем по экрану или курсором-пальцем).
// handler(action, button) решает, что делать (см. main.js).
export function onAction(handler) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    playClick();
    handler(button.dataset.action, button);
  });
}

// ---------- Меню ----------

// menuItems — список кнопок из game.js: { action, lesson?, title, sub, locked, primary }
export function renderMenu(menuItems) {
  $("menu-grid").innerHTML = menuItems.map((item) => `
    <button class="btn ${item.primary ? "btn-primary" : ""} ${item.wide ? "btn-wide" : ""}"
            data-action="${item.action}" ${item.lesson ? `data-lesson="${item.lesson}"` : ""}
            ${item.locked ? "disabled" : ""}>
      ${item.locked ? "🔒 " : ""}${item.title}
      <span class="sub">${item.sub}</span>
    </button>`).join("");
}

// ---------- Экран игры ----------

// view — что показать, собирает game.js.
export function renderPlay(view) {
  $("play-mode").textContent = view.modeTitle;
  $("play-info").textContent = view.info;
  $("target-letter").textContent = view.letter;

  // Слово в экзамене: пройденные буквы зелёные, текущая подсвечена.
  const word = $("play-word");
  word.hidden = !view.word;
  if (view.word) {
    word.innerHTML = [...view.word].map((ch, i) => {
      const cls = i < view.wordPosition ? "done" : i === view.wordPosition ? "current" : "";
      return `<span class="${cls}">${ch}</span>`;
    }).join("");
  }

  // Эталон: фото + описание словами.
  const reference = $("reference");
  reference.hidden = !view.showReference;
  if (view.showReference) {
    const image = $("reference-image");
    const src = `assets/letters/${PHOTO_FILES[view.letter]}.jpg`;
    if (image.dataset.src !== src) {
      image.dataset.src = src;
      image.hidden = false;
      image.onerror = () => { image.hidden = true; }; // фото ещё нет — показываем только текст
      image.src = src;
      image.alt = `Буква «${view.letter}» на дактиле`;
    }
    $("reference-text").textContent = LETTERS[view.letter].description;
  }

  $("skip-button").hidden = !view.showSkip;
}

// Кольцо удержания вокруг буквы: progress от 0 до 1.
const RING_LENGTH = 339.3;
export function setHoldProgress(progress) {
  $("hold-ring-fill").style.strokeDashoffset = RING_LENGTH * (1 - Math.min(1, progress));
}

export function setHint(text) {
  const hint = $("hint");
  if (text) {
    if (hint.textContent !== text) hint.textContent = text;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
}

// Похвала после засчитанной буквы («Отлично!») + анимация.
export function showPraise(text) {
  $("praise").textContent = text;
  $("praise").hidden = false;
  $("target-letter").parentElement.classList.add("success");
}

export function hidePraise() {
  $("praise").hidden = true;
  $("target-letter").parentElement.classList.remove("success");
}

// ---------- Итоги и рекорды ----------

function starsHtml(stars) {
  return "★".repeat(stars) + `<span class="off">${"★".repeat(3 - stars)}</span>`;
}

function statsHtml(rows) {
  return rows.map(([name, value]) => `<dt>${name}</dt><dd>${value}</dd>`).join("");
}

// result — объект из game.js: { title, stars, isRecord, rows: [[название, значение]], hardText }
export function renderResults(result) {
  $("results-title").textContent = result.title;
  $("results-stars").innerHTML = starsHtml(result.stars);
  $("results-record").hidden = !result.isRecord;
  $("results-stats").innerHTML = statsHtml(result.rows);
  $("results-hard").textContent = result.hardText;
}

export function renderRecords(rows, hardText) {
  $("records-stats").innerHTML = statsHtml(rows);
  $("records-hard").textContent = hardText;
}

// ---------- Камера: загрузка и ошибки ----------

export function setStageStatus(text, { showRetry = false, spinner = true } = {}) {
  const status = $("stage-status");
  if (!text) {
    status.hidden = true;
    return;
  }
  status.hidden = false;
  $("stage-status-text").textContent = text;
  $("retry-button").hidden = !showRetry;
  status.querySelector(".spinner").hidden = !spinner;
}

export function setSoundLabel(on) {
  $("sound-button").textContent = on ? "🔊 Звук" : "🔇 Без звука";
}

// ---------- Курсор-палец и нажатие «наведи и подержи» ----------

let dwellButton = null;   // кнопка под курсором
let dwellStart = 0;       // когда курсор на неё попал
let dwellLocked = false;  // после нажатия ждём, пока курсор уйдёт, чтобы не нажать дважды

// hand — рука из hand-tracker.js или null; pointing — показан ли жест «указка».
export function updateCursor(hand, pointing, now) {
  const cursor = $("cursor");
  $("pointer-tip").classList.toggle("visible", Boolean(hand) && pointing);

  if (!hand || !pointing) {
    cursor.hidden = true;
    resetDwell();
    return;
  }

  // Кончик указательного → точка на экране. Видео отражено, поэтому x переворачиваем.
  // Центральную зону кадра растягиваем на весь экран — не надо тянуть руку к краю.
  const tip = hand.points[FINGERS.index.tip];
  const zone = CURSOR_ZONE_MAX - CURSOR_ZONE_MIN;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const x = clamp((1 - tip.x - CURSOR_ZONE_MIN) / zone) * window.innerWidth;
  const y = clamp((tip.y - CURSOR_ZONE_MIN) / zone) * window.innerHeight;

  cursor.hidden = false;
  cursor.style.transform = `translate(${x}px, ${y}px)`;

  const element = document.elementFromPoint(x, y);
  const button = element ? element.closest("button:not([disabled])") : null;

  if (button !== dwellButton) {
    resetDwell();
    dwellButton = button;
    dwellStart = now;
    if (button) button.classList.add("pointed");
    return;
  }
  if (!button || dwellLocked) return;

  const progress = (now - dwellStart) / DWELL_MS;
  button.style.setProperty("--dwell", Math.min(1, progress));
  if (progress >= 1) {
    dwellLocked = true;
    button.style.setProperty("--dwell", 0);
    button.click();
  }
}

function resetDwell() {
  if (dwellButton) {
    dwellButton.classList.remove("pointed");
    dwellButton.style.setProperty("--dwell", 0);
  }
  dwellButton = null;
  dwellLocked = false;
}

// ---------- Отладка ----------

export function showDebug(text) {
  const debug = $("debug");
  debug.hidden = false;
  debug.textContent = text;
}
