// ============================================================
// ui.js — всё, что видно на экране: главная/приложение, экраны, кнопки,
// буква, подсказка, итоги, рекорды, вход.
// А ещё — управление без мыши: курсор-палец и нажатие «наведи и подержи».
//
// Сам ui.js ничего не решает: что показывать, говорит game.js,
// где рука — говорит main.js. Так логику легче проверять и объяснять.
// ============================================================

import { LETTERS } from "./letters.js";
import { handSchemaSvg } from "./hand-schema.js";
import { DWELL_MS, CURSOR_ZONE_MIN, CURSOR_ZONE_MAX, FINGERS } from "./config.js";
import { playClick } from "./sound.js";
import { countUp } from "./effects.js";

const $ = (id) => document.getElementById(id);

// ---------- Главная ↔ приложение ----------

export function showLanding() {
  $("app").hidden = true;
  $("landing").hidden = false;
}

export function showApp() {
  $("landing").hidden = true;
  $("app").hidden = false;
  window.scrollTo(0, 0);
}

// ---------- Экраны приложения ----------

export function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  $("menu-button").hidden = name === "menu" || name === "auth";
}

// Все кнопки с data-action нажимаются одинаково (мышью, пальцем по экрану или курсором-пальцем).
// handler(action, button) решает, что делать (см. main.js).
export function onAction(handler) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    playClick();
    addRipple(button, event);
    handler(button.dataset.action, button);
  });
}

// Волна от точки нажатия внутри кнопки.
function addRipple(button, event) {
  if (!button.classList.contains("btn")) return;
  const rect = button.getBoundingClientRect();
  // У нажатия курсором-пальцем нет координат мыши — берём центр кнопки.
  const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
  const y = event.clientY ? event.clientY - rect.top : rect.height / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = x + "px";
  ripple.style.top = y + "px";
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ---------- Вход и пользователь ----------

export function setUser(name) {
  const chip = $("user-chip");
  chip.hidden = !name;
  chip.textContent = name ? `👤 ${name}` : "";
  $("logout-button").hidden = !name;
}

export function switchAuthTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  $("login-form").hidden = tab !== "login";
  $("register-form").hidden = tab !== "register";
  setAuthError(null);
}

export function setAuthError(text) {
  const error = $("auth-error");
  error.hidden = !text;
  error.textContent = text || "";
}

// Блокируем кнопки формы, пока ждём ответ сервера, — чтобы не нажать дважды.
export function setAuthBusy(busy) {
  document.querySelectorAll(".auth-form button").forEach((b) => {
    b.disabled = busy;
  });
}

// ---------- Меню ----------

// menuItems — список кнопок из game.js: { action, lesson?, title, sub, locked, primary, wide }
export function renderMenu(menuItems, title) {
  $("menu-title").textContent = title;
  $("menu-grid").innerHTML = menuItems.map((item) => `
    <button class="btn ${item.primary ? "btn-primary" : ""} ${item.wide ? "btn-wide" : ""}"
            data-action="${item.action}" ${item.lesson ? `data-lesson="${item.lesson}"` : ""}
            ${item.locked ? "disabled" : ""}>
      <span>${item.locked ? "🔒 " : ""}${item.title}</span>
      <span class="sub">${item.sub}</span>
    </button>`).join("");
}

// ---------- Экран игры ----------

let shownLetter = null;
let shownReferenceLetter = null;

// view — что показать, собирает game.js.
export function renderPlay(view) {
  $("play-mode").textContent = view.modeTitle;
  $("play-info").textContent = view.info;

  // Новая буква «влетает» с анимацией.
  const letter = $("target-letter");
  if (view.letter !== shownLetter) {
    shownLetter = view.letter;
    letter.textContent = view.letter;
    letter.classList.remove("swap");
    void letter.offsetWidth; // перезапуск CSS-анимации
    letter.classList.add("swap");
  }

  // Слово в экзамене: пройденные буквы зелёные, текущая подсвечена.
  const word = $("play-word");
  word.hidden = !view.word;
  if (view.word) {
    word.innerHTML = [...view.word].map((ch, i) => {
      const cls = i < view.wordPosition ? "done" : i === view.wordPosition ? "current" : "";
      return `<span class="${cls}">${ch}</span>`;
    }).join("");
  }

  // Эталон: схема руки + описание словами.
  const reference = $("reference");
  reference.hidden = !view.showReference;
  if (view.showReference && shownReferenceLetter !== view.letter) {
    shownReferenceLetter = view.letter;
    $("reference-hand").innerHTML = handSchemaSvg(view.letter);
    $("reference-text").textContent = LETTERS[view.letter].description;
  }
  if (!view.showReference) shownReferenceLetter = null;

  $("skip-button").hidden = !view.showSkip;
}

// Кольцо удержания вокруг буквы: progress от 0 до 1.
const RING_LENGTH = 339.3;
export function setHoldProgress(progress) {
  $("hold-ring-fill").style.strokeDashoffset = RING_LENGTH * (1 - Math.min(1, progress));
}

export function setHint(text) {
  const hint = $("hint");
  if (!text) {
    hint.hidden = true;
    return;
  }
  if (hint.textContent !== text || hint.hidden) {
    hint.textContent = text;
    hint.classList.remove("new");
    void hint.offsetWidth; // новая подсказка появляется с лёгкой встряской
    hint.classList.add("new");
  }
  hint.hidden = false;
}

// Похвала после засчитанной буквы («Отлично!») + анимация.
export function showPraise(text) {
  $("praise").textContent = text;
  $("praise").hidden = false;
  $("target").classList.add("success");
}

export function hidePraise() {
  $("praise").hidden = true;
  $("target").classList.remove("success");
}

export function getTargetElement() {
  return $("target");
}

// ---------- Итоги и рекорды ----------

function statsHtml(rows) {
  return rows.map(([name, value]) => `<dt>${name}</dt><dd>${value}</dd>`).join("");
}

// result — объект из game.js: { title, stars, isRecord, rows: [[название, значение]], hardText }
export function renderResults(result) {
  $("results-title").textContent = result.title;
  // Звёзды загораются по очереди (задержки — в CSS).
  $("results-stars").innerHTML = [1, 2, 3].map((n) => `<span class="${n <= result.stars ? "on" : ""}">★</span>`).join("");
  $("results-record").hidden = !result.isRecord;
  $("results-stats").innerHTML = statsHtml(result.rows);
  $("results-stats").querySelectorAll("dd").forEach((dd) => countUp(dd));
  $("results-hard").textContent = result.hardText;
}

export function renderRecords(rows, hardText) {
  $("records-stats").innerHTML = statsHtml(rows);
  $("records-hard").textContent = hardText;
}

// Общая таблица рекордов. board — из auth.js, myName — имя текущего игрока.
export function renderLeaderboard(board, myName, formatTime) {
  const box = $("leaderboard");
  if (!board) {
    box.hidden = true;
    return;
  }
  const list = (rows, value) => rows.length
    ? `<ol>${rows.map((r, i) => `<li class="${r.username === myName ? "me" : ""}" style="animation-delay:${i * 50}ms">
        <span>${i + 1}. ${escapeHtml(r.username)}</span><b>${value(r)}</b></li>`).join("")}</ol>`
    : `<p class="lb-empty">Пока никого — стань первым!</p>`;
  box.innerHTML = `
    <div class="lb-col"><h3>⚡ Тренировка</h3>${list(board.training, (r) => `${r.best_training} букв`)}</div>
    <div class="lb-col"><h3>🎓 Экзамен</h3>${list(board.exam, (r) => formatTime(r.best_exam_ms))}</div>`;
  box.hidden = false;
}

// Имена вводят пользователи — экранируем, чтобы нельзя было вставить свой HTML.
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
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
  $("sound-button").textContent = on ? "🔊" : "🔇";
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
