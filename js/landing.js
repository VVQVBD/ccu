// ============================================================
// landing.js — главная страница (рассказ о проекте).
//
// Что делает:
//   1. Плавное появление блоков при прокрутке (класс .visible для .reveal).
//   2. Живая демонстрация в первом экране: буквы сменяют друг друга с подсказками.
//   3. Карточки 10 букв со схемами рук.
//
// Связь: main.js вызывает initLanding() при загрузке страницы.
// Схемы рук рисует hand-schema.js, описания букв берём из letters.js.
// ============================================================

import { LETTERS } from "./letters.js";
import { handSchemaSvg } from "./hand-schema.js";

const DEMO_INTERVAL_MS = 2600; // как часто меняется буква в демонстрации

// Пары «буква — пример подсказки» для демонстрации в первом экране.
const DEMO = [
  ["В", "💡 Сомкни пальцы — между ними не должно быть щелей"],
  ["А", "✅ Отлично! Буква засчитана"],
  ["Ы", "💡 Сейчас похоже на «И». Выпрями указательный палец"],
  ["Н", "💡 Большой палец касается среднего, а нужно — безымянного"],
  ["У", "✅ Точно! Следующая буква"],
  ["С", "💡 Оставь просвет между большим и указательным"],
];

export function initLanding() {
  observeReveal();
  renderLetterCards();
  startDemo();
}

// Блоки .reveal появляются, когда попадают на экран. IntersectionObserver
// сам сообщает, какой элемент стал виден, — не нужно проверять прокрутку вручную.
export function observeReveal() {
  const elements = document.querySelectorAll(".reveal:not(.visible)");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target); // показали один раз — больше не следим
      }
    }
  }, { threshold: 0.15 });
  elements.forEach((el) => observer.observe(el));
}

function renderLetterCards() {
  const grid = document.getElementById("letters-grid");
  grid.innerHTML = Object.entries(LETTERS).map(([letter, info], i) => `
    <article class="letter-card reveal" style="--i:${i % 5}">
      <span class="lc-lesson">Урок ${info.lesson}</span>
      ${handSchemaSvg(letter)}
      <div class="lc-letter">${letter}</div>
      <p>${info.description}</p>
    </article>`).join("");
  observeReveal();
}

function startDemo() {
  const hand = document.getElementById("demo-hand");
  const letter = document.getElementById("demo-letter");
  const hint = document.getElementById("demo-hint");
  let index = 0;

  const show = () => {
    const [demoLetter, demoHint] = DEMO[index];
    hand.innerHTML = handSchemaSvg(demoLetter);
    letter.textContent = demoLetter;
    hint.textContent = demoHint;
    // Перезапускаем анимацию появления: убрать класс → дать браузеру заметить → вернуть.
    for (const el of [hand, letter, hint]) {
      el.classList.remove("demo-swap");
      void el.offsetWidth;
      el.classList.add("demo-swap");
    }
    index = (index + 1) % DEMO.length;
  };

  show();
  // Меняем букву, только пока главная видна: в приложении это лишняя работа.
  setInterval(() => {
    if (!document.getElementById("landing").hidden) show();
  }, DEMO_INTERVAL_MS);
}
