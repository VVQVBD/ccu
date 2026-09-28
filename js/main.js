// ============================================================
// main.js — точка входа. Отсюда всё запускается.
//
// Путь пользователя: главная (landing.js) → «Начать» → включаем камеру →
// вход или «без входа» (auth.js) → меню → урок / тренировка / экзамен (game.js).
//
// Путь одного кадра (подробно — docs/HOW-IT-WORKS.md):
//   камера (camera.js) → MediaPipe находит 21 точку (hand-tracker.js)
//   → признаки пальцев (hand-features.js) → игра проверяет букву (game.js + mistakes.js)
//   → рисуем скелет (draw.js) и обновляем экран (ui.js).
// Повторяется на каждом кадре через requestAnimationFrame (~30–60 раз в секунду).
// ============================================================

import { startCamera } from "./camera.js";
import { createHandTracker, detectHand } from "./hand-tracker.js";
import { computeFeatures, resetSmoothing, isPointingGesture } from "./hand-features.js";
import { fitCanvas, drawHand, clearCanvas } from "./draw.js";
import * as game from "./game.js";
import * as ui from "./ui.js";
import * as auth from "./auth.js";
import * as storage from "./storage.js";
import { toggleSound } from "./sound.js";
import { initLanding } from "./landing.js";
import * as writing from "./writing.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
// Отладочная панель с числами признаков: открыть сайт с ?debug=1 в конце адреса.
const DEBUG = new URLSearchParams(location.search).has("debug");

let cameraStarted = false;
let handWasVisible = false;

// ---------- Кнопки ----------

ui.onAction((action, button) => {
  const now = performance.now();
  if (action === "start") openApp();
  if (action === "home") ui.showLanding();
  if (action === "lesson") game.start("lesson", now, Number(button.dataset.lesson));
  if (action === "training") game.start("training", now);
  if (action === "exam") game.start("exam", now);
  if (action === "skip") game.skipLetter(now);
  if (action === "again") game.restart(now);
  if (action === "menu") game.showMenu();
  if (action === "records") game.showRecords();
  if (action === "words") game.showWords();
  if (action === "word") game.start("word", now, button.dataset.word);
  if (action === "write") game.startWriting();
  if (action === "write-back") writing.backspace();
  if (action === "write-clear") writing.clearText();
  if (action === "sound") ui.setSoundLabel(toggleSound());
  if (action === "retry") location.reload();
  if (action === "auth-tab") ui.switchAuthTab(button.dataset.tab);
  if (action === "guest") game.showMenu();
  if (action === "logout") logout();
  if (action === "reset" && confirm("Стереть весь прогресс и рекорды?")) {
    storage.resetProgress();
    game.showRecords();
  }
});

// ---------- Вход и регистрация ----------

document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  submitAuth(() => auth.signIn(form.get("email"), form.get("password")));
});

document.getElementById("register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  submitAuth(() => auth.signUp(form.get("username"), form.get("email"), form.get("password")));
});

// Общая часть входа и регистрации: ждём ответ, показываем ошибку или открываем меню.
async function submitAuth(request) {
  ui.setAuthError(null);
  ui.setAuthBusy(true);
  try {
    const cloudProgress = await request();
    onLoggedIn(cloudProgress);
    game.showMenu();
  } catch (error) {
    ui.setAuthError(error.message);
  } finally {
    ui.setAuthBusy(false);
  }
}

function onLoggedIn(cloudProgress) {
  const player = auth.getPlayer();
  if (!player) return;
  storage.setOwner(player.id, cloudProgress); // у каждого игрока свой прогресс
  ui.setUser(player.username);
}

async function logout() {
  game.stop(); // сначала останавливаем текущий урок/тренировку, чтобы результат не записался гостю
  await auth.signOut();
  storage.setOwner(null);
  ui.setUser(null);
  ui.switchAuthTab("login");
  ui.showScreen("auth");
}

// ---------- Запуск ----------

// Главная страница видна сразу. Заодно проверяем, не вошёл ли игрок раньше.
async function init() {
  initLanding();
  try {
    const cloudProgress = await auth.initAuth();
    onLoggedIn(cloudProgress);
  } catch (error) {
    console.warn("Аккаунты недоступны:", error);
  }
}

// «Начать»: показываем приложение и (один раз) включаем камеру.
async function openApp() {
  ui.showApp();
  // Камеру включаем только при первом «Начать» (флаг ставим сразу — на случай двойного нажатия).
  const firstStart = !cameraStarted;
  cameraStarted = true;
  if (firstStart) ui.setStageStatus("Подключаемся…");
  await authReady; // ждём, пока выяснится, вошёл ли игрок раньше, — иначе покажем вход зря
  // Если аккаунты включены и игрок не вошёл — сначала экран входа.
  if (auth.accountsEnabled() && !auth.getPlayer()) ui.showScreen("auth");
  else game.showMenu();

  if (!firstStart) return;
  try {
    ui.setStageStatus("Включаем камеру… Разреши доступ, если браузер спросит.");
    await startCamera(video);
    ui.setStageStatus("Загружаем распознавание руки…");
    await createHandTracker();
    ui.setStageStatus(null);
    requestAnimationFrame(loop);
  } catch (error) {
    console.error(error);
    ui.setStageStatus(error.message, { showRetry: true, spinner: false });
  }
}

// ---------- Главный цикл: один проход = один кадр ----------

function loop() {
  requestAnimationFrame(loop);
  // На главной странице камера не нужна — не тратим силы компьютера.
  if (document.getElementById("app").hidden) return;

  const now = performance.now();
  const hand = detectHand(video);

  let features = null;
  let pointing = false;
  if (hand) {
    features = computeFeatures(hand, video.videoWidth, video.videoHeight);
    pointing = isPointingGesture(features);
    handWasVisible = true;
  } else if (handWasVisible) {
    resetSmoothing(); // рука пропала — забываем старые значения
    handWasVisible = false;
  }

  // Игра проверяет букву и говорит, какие пальцы подсветить.
  const verdict = game.onFrame(features, pointing, now);

  // Рисуем скелет: в игре — зелёный/красный по пальцам, в меню — нейтральный.
  fitCanvas(canvas, video);
  if (hand) {
    drawHand(canvas, hand, {
      colored: Boolean(verdict) && !pointing,
      badFingers: verdict ? verdict.badFingers : [],
      mainFinger: verdict ? verdict.mainFinger : null,
      pointing,
    });
  } else {
    clearCanvas(canvas);
  }

  ui.updateCursor(hand, pointing, now);
  if (DEBUG) ui.showDebug(debugText(features));
}

// Текст для отладочной панели: все числа, по которым принимаются решения.
function debugText(f) {
  if (!f) return "руки нет";
  const lines = [`рука: ${f.isRightHand ? "правая" : "левая"}   ориентация: ${f.orientation} (${f.palmSign.toFixed(2)})`];
  for (const name in f.fingers) {
    lines.push(`${name.padEnd(7)} угол ${f.fingers[name].angle.toFixed(0).padStart(4)}°  ${f.fingers[name].state.padEnd(8)} касание ${f.touch[name].toFixed(2)}`);
  }
  lines.push(`большой: угол ${f.thumbAngle.toFixed(0)}° отведён ${f.thumbToIndexBase.toFixed(2)} вдоль ${f.thumbToIndexMiddle.toFixed(2)}`);
  lines.push(`касается: ${f.touchedFinger || "—"}   просвет ${f.gap.toFixed(2)}   разброс ${f.spread.toFixed(2)}`);
  lines.push(`размер ${f.palmOnScreen.toFixed(2)}   наклон ${f.tilt.toFixed(0)}°   край ${f.atEdge}`);
  return lines.join("\n");
}

// Промис запуска: openApp() ждёт его, прежде чем решить, показать вход или меню.
const authReady = init();
