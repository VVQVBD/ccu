// ============================================================
// letters.js — эталоны 10 букв русской дактильной азбуки.
//
// Каждая буква — это СПИСОК ПРОВЕРОК в порядке важности.
// Проверка = условие по признакам руки + подсказка, что делать, если условие не выполнено.
// Первая проваленная проверка — это «главная ошибка», её и показываем пользователю.
//
// Откуда формы букв и почему именно эти 10 — docs/GESTURES.md, разделы 2 и 5.
// Связь: признаки считает hand-features.js, проверки запускает mistakes.js,
// уроки и слова берёт game.js.
// ============================================================

import { STRAIGHT, BENT } from "./hand-features.js";
import { TOUCH_MAX_DIST } from "./config.js";

// Названия пальцев для подсказок (в двух падежах).
export const FINGER_TEXT = {
  index:  { what: "указательный палец", whose: "указательного" },
  middle: { what: "средний палец",      whose: "среднего" },
  ring:   { what: "безымянный палец",   whose: "безымянного" },
  pinky:  { what: "мизинец",            whose: "мизинца" },
};

// ---------- Кирпичики для проверок ----------
// Каждая функция возвращает объект проверки:
//   finger — какой палец подсветить красным на скелете (или null)
//   pass(f) — true, если проверка пройдена (f — признаки руки)
//   hint(f) — текст подсказки, если не пройдена

// Палец должен быть прямым.
function straight(finger) {
  return {
    finger,
    pass: (f) => f.fingers[finger].state === STRAIGHT,
    hint: () => `Выпрями ${FINGER_TEXT[finger].what}`,
  };
}

// Палец должен быть согнут к ладони.
function bent(finger, hintText) {
  return {
    finger,
    pass: (f) => f.fingers[finger].state === BENT,
    hint: () => hintText || `Согни ${FINGER_TEXT[finger].what} к ладони`,
  };
}

// Большой палец должен касаться пальца target (колечко: О, Н, Р, Ш).
function thumbTouches(target, hintWhenNothing) {
  return {
    finger: target,
    pass: (f) => f.touchedFinger === target,
    hint: (f) => {
      if (f.touchedFinger) {
        return `Большой палец касается ${FINGER_TEXT[f.touchedFinger].whose}, а нужно — ${FINGER_TEXT[target].whose}`;
      }
      return hintWhenNothing;
    },
  };
}

// Сводная проверка: если неправильных пальцев 2 и больше — одна общая подсказка
// («Выпрями все пальцы»), а не четыре по очереди. Если неправильный только один —
// проверка проходит, и дальше сработает точная подсказка про этот палец.
function mostFingers(state, hintText) {
  return {
    finger: null,
    pass: (f) => Object.values(f.fingers).filter((x) => x.state !== state).length <= 1,
    hint: () => hintText,
  };
}

// Палец НЕ согнут в кулак (для щепоти «Ч» и дуги «Э»).
function notBent(finger, hintText) {
  return { finger, pass: (f) => f.fingers[finger].state !== BENT, hint: () => hintText };
}

// Большой палец НЕ отведён в сторону.
function thumbNotOut(hintText) {
  return { finger: "thumb", pass: (f) => !f.thumbOut, hint: () => hintText };
}

// ---------- Сами буквы ----------

export const LETTERS = {
  "В": {
    lesson: 1,
    description: "Ладонь раскрыта, все пальцы прямые и сомкнуты, большой палец прижат к ладони.",
    checks: [
      mostFingers(STRAIGHT, "Раскрой ладонь — выпрями все пальцы"),
      straight("index"), straight("middle"), straight("ring"), straight("pinky"),
      thumbNotOut("Прижми большой палец к ладони"),
      { finger: null, pass: (f) => f.fingersTogether, hint: () => "Сомкни пальцы — между ними не должно быть щелей" },
    ],
  },

  "А": {
    lesson: 1,
    description: "Кулак. Большой палец выпрямлен и прижат сбоку к указательному.",
    checks: [
      mostFingers(BENT, "Сожми пальцы в кулак"),
      bent("index"), bent("middle"), bent("ring"), bent("pinky"),
      { finger: "thumb", pass: (f) => f.thumbStraight, hint: () => "Не клади большой палец на пальцы — выпрями его" },
      { finger: "thumb", pass: (f) => f.thumbAlongIndex, hint: () => "Прижми большой палец сбоку к указательному" },
    ],
  },

  "У": {
    lesson: 1,
    description: "Кулак. Мизинец выпрямлен вверх, большой палец отведён в сторону.",
    checks: [
      straight("pinky"),
      bent("index"), bent("middle"), bent("ring"),
      { finger: "thumb", pass: (f) => f.thumbOut, hint: () => "Отведи большой палец в сторону" },
    ],
  },

  "И": {
    lesson: 2,
    description: "Кулак. Безымянный палец и мизинец выпрямлены вверх.",
    checks: [
      straight("ring"), straight("pinky"),
      bent("index"), bent("middle"),
      thumbNotOut("Прижми большой палец к согнутым пальцам"),
    ],
  },

  "Ы": {
    lesson: 2,
    description: "Кулак. Указательный палец и мизинец выпрямлены вверх.",
    checks: [
      straight("index"), straight("pinky"),
      bent("middle"), bent("ring"),
      thumbNotOut("Прижми большой палец к согнутым пальцам"),
    ],
  },

  "Ш": {
    lesson: 2,
    description: "Три пальца вверх (как буква «Ш»). Мизинец согнут, большой палец его придерживает.",
    checks: [
      straight("index"), straight("middle"), straight("ring"),
      thumbTouches("pinky", "Согни мизинец и прижми его большим пальцем"),
    ],
  },

  "О": {
    lesson: 3,
    description: "Указательный и большой пальцы образуют колечко, остальные пальцы прямые.",
    checks: [
      thumbTouches("index", "Соедини кончики большого и указательного — получится колечко"),
      straight("middle"), straight("ring"), straight("pinky"),
    ],
  },

  "Н": {
    lesson: 3,
    description: "Безымянный и большой пальцы образуют колечко, остальные пальцы прямые.",
    checks: [
      thumbTouches("ring", "Соедини кончики большого и безымянного пальцев"),
      straight("index"), straight("middle"), straight("pinky"),
    ],
  },

  "Р": {
    lesson: 3,
    description: "Средний и большой пальцы образуют колечко, остальные пальцы прямые.",
    checks: [
      thumbTouches("middle", "Соедини кончики большого и среднего пальцев"),
      straight("index"), straight("ring"), straight("pinky"),
    ],
  },

  "С": {
    lesson: 3,
    description: "Пальцы согнуты полукругом, как будто держишь стакан. Между большим и указательным — просвет.",
    skipPalmCheck: true, // полукольцо лучше видно, когда кисть стоит ребром — ориентацию не проверяем
    checks: [
      { finger: null, pass: (f) => !Object.values(f.fingers).some((x) => x.state === BENT),
        hint: () => "Не сжимай кулак — раскрой пальцы полукругом" },
      { finger: null, pass: (f) => !Object.values(f.fingers).some((x) => x.state === STRAIGHT),
        hint: () => "Слегка согни пальцы полукругом, как будто держишь стакан" },
      { finger: "index", pass: (f) => f.hasGap,
        hint: () => "Оставь просвет между большим и указательным — иначе получится «О»" },
    ],
  },

  // ---------- Урок 4 и 5: новые буквы (docs/ALPHABET.md, раздел 6) ----------

  "К": {
    lesson: 4,
    description: "Указательный и средний пальцы выпрямлены вверх и слегка разведены, как галочка. Безымянный и мизинец согнуты.",
    checks: [
      straight("index"), straight("middle"),
      bent("ring"), bent("pinky"),
      { finger: "middle", pass: (f) => !f.fingersCrossed, hint: () => "Не скрещивай пальцы — разведи их галочкой" },
      { finger: "middle", pass: (f) => f.indexMiddleApart, hint: () => "Разведи указательный и средний пальцы — получится галочка" },
      thumbNotOut("Прижми большим пальцем безымянный и мизинец"),
    ],
  },

  "Я": {
    lesson: 4,
    description: "Указательный и средний пальцы выпрямлены, средний лежит поверх указательного — пальцы скрещены. Безымянный и мизинец согнуты.",
    checks: [
      straight("index"), straight("middle"),
      bent("ring"), bent("pinky"),
      { finger: "middle", pass: (f) => f.fingersCrossed, hint: () => "Положи средний палец поверх указательного — скрести их" },
      thumbNotOut("Прижми большим пальцем безымянный и мизинец"),
    ],
  },

  "Г": {
    lesson: 4,
    direction: "down",   // единственная наша буква пальцами вниз (общая проверка направления — в mistakes.js)
    skipPalmCheck: true, // какой стороной ладонь к собеседнику, источники не говорят
    description: "Опусти кисть пальцами вниз. Указательный палец выпрямлен вниз, большой отведён в сторону. Остальные пальцы согнуты.",
    checks: [
      // Направление повторяем и здесь: иначе «указка» пальцем вверх в свободном письме узналась бы как «Г».
      { finger: null, pass: (f) => f.direction === "down", hint: () => "Опусти кисть — пальцами вниз" },
      { finger: "index", pass: (f) => f.fingers.index.state === STRAIGHT, hint: () => "Выпрями указательный палец — он смотрит вниз" },
      bent("middle"), bent("ring"), bent("pinky"),
      { finger: "thumb", pass: (f) => f.thumbOut, hint: () => "Отведи большой палец в сторону — получится «Г»" },
    ],
  },

  "Ч": {
    lesson: 5,
    skipPalmCheck: true, // щепоть направлена к собеседнику, ладонь видна плохо
    description: "Соедини кончики большого, указательного и среднего пальцев — получится щепоть. Безымянный и мизинец прижаты к ладони.",
    checks: [
      bent("ring"), bent("pinky"),
      notBent("index", "Не прячь указательный в кулак — вытяни его к большому пальцу"),
      notBent("middle", "Не прячь средний в кулак — вытяни его к большому пальцу"),
      { finger: "index", pass: (f) => f.touch.index <= TOUCH_MAX_DIST, hint: () => "Соедини кончики большого и указательного" },
      { finger: "middle", pass: (f) => f.touch.middle <= TOUCH_MAX_DIST, hint: () => "Добавь в щепоть средний палец — он тоже касается большого" },
    ],
  },

  "Э": {
    lesson: 5,
    skipPalmCheck: true, // полукольцо лучше видно, когда кисть чуть повёрнута — как у «С»
    description: "Средний, безымянный и мизинец прижаты к ладони. Указательный и большой изогнуты дугой навстречу друг другу, но не касаются.",
    checks: [
      bent("middle"), bent("ring"), bent("pinky"),
      { finger: "index", pass: (f) => f.fingers.index.state !== STRAIGHT, hint: () => "Согни указательный палец дугой, как половинку «О»" },
      notBent("index", "Не прячь указательный в кулак — оставь его дугой"),
      { finger: "index", pass: (f) => f.hasGap, hint: () => "Оставь просвет между большим и указательным — кончики не касаются" },
      { finger: "thumb", pass: (f) => f.touch.middle > TOUCH_MAX_DIST, hint: () => "Отведи большой палец от кулака — он образует вторую половинку дуги" },
    ],
  },
};

// Уроки: от простых и непохожих букв к сложным.
export const LESSONS = {
  1: ["В", "А", "У"],
  2: ["И", "Ы", "Ш"],
  3: ["О", "Н", "Р", "С"],
  4: ["К", "Я", "Г"],
  5: ["Ч", "Э"],
};

// Слова для экзамена. Без двух одинаковых букв подряд — иначе непонятно,
// когда засчитывать вторую. Экзамен берёт только слова из пройденных букв.
export const WORDS = [
  "УШИ", "ВАШ", "ВЫ",
  "СЫР", "НОС", "СОН", "ШАР", "РИС", "ОСА", "УСЫ", "ВАС", "НАШ", "ШОВ",
  "СОВА", "НОРА", "ШИНА", "РОСА",
  // после урока 4 (+ К, Я, Г)
  "РАК", "СОК", "ЯК", "РОГ", "ИКРА", "РУКА", "КОРА", "КОСА", "КАША", "КИНО", "ОКНО", "КРАН", "КУРС",
  "НОГА", "ГОРА", "ИГРА", "ВРАГ", "ГУСИ", "ЯРУС", "ЯСНО", "КНИГА", "ВАГОН", "ГОРКА", "РЫНОК", "ЯГУАР",
  // после урока 5 (+ Ч, Э)
  "ЧАС", "ЧАСЫ", "ЧАША", "ВРАЧ", "ГРАЧ", "ОЧКИ", "ОЧАГ", "ЭРА", "РУЧКА", "ЭКРАН",
];
