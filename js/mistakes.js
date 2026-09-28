// ============================================================
// mistakes.js — РЕЖИМ «ОШИБКА»: решает, засчитать букву или что подсказать.
//
// Как работает (подробно — docs/GESTURES.md, раздел 6):
//   1. Общие проверки: видна ли рука, не далеко ли, не у края ли, пальцы вверх, ладонь к камере.
//   2. Проверки текущей буквы по порядку (из letters.js).
//   3. Первая проваленная проверка = ГЛАВНАЯ ошибка. Показываем одну подсказку, а не пять сразу.
//   4. Все проверки пройдены и держатся HOLD_MS → буква засчитана.
//   5. Чтобы текст не мигал: не ругаемся первые GRACE_MS, ошибка должна держаться
//      HINT_DELAY_MS, а показанная подсказка висит минимум HINT_MIN_SHOW_MS.
//   6. Если рука совпала с ДРУГОЙ буквой — пишем «Сейчас похоже на «И»».
//
// Связь: game.js создаёт LetterJudge для каждой буквы, main.js на каждом кадре
// передаёт ему признаки руки (из hand-features.js).
// ============================================================

import { LETTERS } from "./letters.js";
import {
  HOLD_MS, GRACE_MS, HINT_DELAY_MS, HINT_MIN_SHOW_MS, NO_HAND_HINT_MS,
} from "./config.js";

// Общие проблемы с положением руки (G2–G6). Возвращает проблему или null.
// countsAsMistake: ошибки камеры (далеко, край) не считаем ошибкой ученика,
// а неправильный поворот кисти — считаем.
function findGeneralProblem(f, letter) {
  if (f.atEdge) return { text: "Рука выходит за край кадра — сдвинь её к центру", countsAsMistake: false };
  if (f.tooFar) return { text: "Рука слишком далеко — поднеси её ближе к камере", countsAsMistake: false };
  if (f.tooClose) return { text: "Рука слишком близко — отодвинь её немного", countsAsMistake: false };
  if (!f.fingersUp) return { text: "Держи кисть прямо — пальцами вверх", countsAsMistake: true };
  if (!letter.skipPalmCheck) {
    if (f.orientation === "back") {
      return { text: "Камера видит тыльную сторону — разверни ладонь к камере", countsAsMistake: true };
    }
    if (f.orientation === "edge") return { text: "Поверни ладонь к камере", countsAsMistake: true };
  }
  return null;
}

// Все проваленные проверки буквы (по порядку важности).
export function failedChecks(letterKey, f) {
  return LETTERS[letterKey].checks.filter((check) => !check.pass(f));
}

// Какую букву сейчас показывают (для свободного письма). Рука должна быть в порядке
// (общие проверки) и полностью совпадать с одной из 10 букв. Возвращает
// { letter, problem }: букву или null, и текст общей проблемы, если она есть.
export function recognizeLetter(f) {
  for (const key in LETTERS) {
    if (failedChecks(key, f).length === 0) {
      const problem = findGeneralProblem(f, LETTERS[key]);
      return problem ? { letter: null, problem: problem.text } : { letter: key, problem: null };
    }
  }
  const problem = findGeneralProblem(f, {});
  return { letter: null, problem: problem ? problem.text : null };
}

// Ищет другую букву, с которой рука совпадает полностью. Нужна для «Сейчас похоже на…».
export function findLookalike(f, currentKey) {
  for (const key in LETTERS) {
    if (key !== currentKey && failedChecks(key, f).length === 0) return key;
  }
  return null;
}

// «Судья» одной буквы: каждый кадр получает признаки и говорит, что показать.
export class LetterJudge {
  constructor(letterKey, now) {
    this.letterKey = letterKey;
    this.startedAt = now;
    this.holdStartedAt = null;    // когда рука впервые совпала с буквой (для удержания)
    this.noHandSince = now;       // с какого момента руки нет
    this.candidate = null;        // текущая главная ошибка (ещё не показанная)
    this.candidateSince = 0;
    this.shownHint = null;        // подсказка на экране
    this.shownAt = 0;
    this.mistakeCount = 0;        // сколько подсказок по форме руки показали — для точности и «трудных букв»
    this.done = false;
  }

  // features — признаки руки или null (руки нет).
  // pointing — пользователь сейчас держит «указку» (управляет кнопками), не ругаем его.
  // Возвращает: { done, holdProgress, hint, badFingers, mainFinger }.
  update(features, now, pointing = false) {
    if (this.done) return this.result(1, [], null);

    let problem = null;     // главная ошибка этого кадра
    let badFingers = [];    // пальцы, которые подсветить красным

    if (!features) {
      this.holdStartedAt = null;
      if (now - this.noHandSince >= NO_HAND_HINT_MS) {
        problem = { text: "Не вижу руку — покажи ладонь в камеру", countsAsMistake: false, finger: null };
      }
    } else {
      this.noHandSince = now;
      const letter = LETTERS[this.letterKey];
      const general = pointing ? null : findGeneralProblem(features, letter);
      const failed = failedChecks(this.letterKey, features);
      badFingers = failed.map((c) => c.finger).filter(Boolean);

      if (pointing) {
        this.holdStartedAt = null; // пока управляем курсором — букву не засчитываем и не ругаем
      } else if (general) {
        this.holdStartedAt = null;
        problem = { ...general, finger: null };
      } else if (failed.length > 0) {
        this.holdStartedAt = null;
        problem = { text: this.buildLetterHint(failed, features), countsAsMistake: true, finger: failed[0].finger };
      } else {
        // Всё совпало — копим время удержания.
        if (this.holdStartedAt === null) this.holdStartedAt = now;
        const progress = (now - this.holdStartedAt) / HOLD_MS;
        if (progress >= 1) {
          this.done = true;
          this.shownHint = null;
          return this.result(1, [], null);
        }
        this.updateHint(null, now);
        return this.result(progress, [], null);
      }
    }

    this.updateHint(problem, now);
    return this.result(0, badFingers, problem ? problem.finger : null);
  }

  // Текст подсказки по букве: главная ошибка + «Почти!» + «Сейчас похоже на…».
  buildLetterHint(failed, features) {
    let text = failed[0].hint(features);
    const lookalike = findLookalike(features, this.letterKey);
    if (lookalike) text = `Сейчас похоже на «${lookalike}». ${text}`;
    else if (failed.length === 1) text = `Почти! ${text}`;
    return text;
  }

  // Решает, какую подсказку держать на экране, чтобы она не мигала.
  updateHint(problem, now) {
    const text = problem ? problem.text : null;

    // Запоминаем, с какого момента держится эта ошибка.
    if (text !== (this.candidate && this.candidate.text)) {
      this.candidate = problem;
      this.candidateSince = now;
    }

    // Показанную подсказку не убираем раньше HINT_MIN_SHOW_MS.
    const canReplace = !this.shownHint || now - this.shownAt >= HINT_MIN_SHOW_MS;
    if (!canReplace) return;

    if (!problem) {
      this.shownHint = null;
      return;
    }

    const inGrace = now - this.startedAt < GRACE_MS;
    const heldLongEnough = now - this.candidateSince >= HINT_DELAY_MS;
    if (!inGrace && heldLongEnough && this.shownHint !== text) {
      this.shownHint = text;
      this.shownAt = now;
      if (problem.countsAsMistake) this.mistakeCount += 1;
    }
  }

  result(holdProgress, badFingers, mainFinger) {
    return { done: this.done, holdProgress, hint: this.shownHint, badFingers, mainFinger };
  }
}
