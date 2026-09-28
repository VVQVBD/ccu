// ============================================================
// hand-schema.js — рисует схему руки для каждой буквы (картинка SVG).
//
// Зачем: в уроке, в «Алфавите» и на главной нужна картинка «как сложить пальцы».
// Рисуем её кодом — не нужны чужие фото и нет проблем с авторскими правами.
//
// Рука нарисована так, как её видит собеседник: правая рука ладонью к нам,
// поэтому мизинец слева, указательный справа, большой палец — справа снизу.
// Каждый палец — толстая линия с закруглёнными концами (как в мультфильме).
// Формы всех 33 букв — docs/ALPHABET.md, раздел 8.
//
// Связь: ui.js вставляет схему в урок и «Алфавит», landing.js — в карточки на главной.
// ============================================================

// Как выглядит каждая буква.
//   Пальцы: S — прямой, B — согнут к ладони, H — полусогнут (дуга), T — касается большого,
//           F — согнут в костяшке и «смотрит» на собеседника, X — крючок.
//   thumb: "tucked" прижат к ладони, "along" вдоль указательного, "out" отведён, "c" полукольцо,
//          "touch" касается пальца T, "pinch" щепоть (касается нескольких T), "under" под пальцами.
//   direction: "down" — кисть пальцами вниз; spread — пальцы разведены; crossed — скрещены;
//   motion — у буквы есть движение (стрелка на схеме).
const SHAPES = {
  "А": { index: "B", middle: "B", ring: "B", pinky: "B", thumb: "along" },
  "Б": { index: "S", middle: "H", ring: "B", pinky: "B", thumb: "tucked" },
  "В": { index: "S", middle: "S", ring: "S", pinky: "S", thumb: "tucked" },
  "Г": { index: "S", middle: "B", ring: "B", pinky: "B", thumb: "out", direction: "down" },
  "Д": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", motion: "draw" },
  "Е": { index: "H", middle: "H", ring: "H", pinky: "H", thumb: "under" },
  "Ё": { index: "H", middle: "H", ring: "H", pinky: "H", thumb: "under", motion: "turn" },
  "Ж": { index: "F", middle: "F", ring: "F", pinky: "F", thumb: "under" },
  "З": { index: "S", middle: "B", ring: "B", pinky: "B", thumb: "tucked", motion: "draw" },
  "И": { index: "B", middle: "B", ring: "S", pinky: "S", thumb: "tucked" },
  "Й": { index: "B", middle: "B", ring: "S", pinky: "S", thumb: "tucked", motion: "turn" },
  "К": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", spread: true },
  "Л": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", direction: "down", spread: true },
  "М": { index: "S", middle: "S", ring: "S", pinky: "T", thumb: "touch", direction: "down", spread: true },
  "Н": { index: "S", middle: "S", ring: "T", pinky: "S", thumb: "touch" },
  "О": { index: "T", middle: "S", ring: "S", pinky: "S", thumb: "touch" },
  "П": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", direction: "down" },
  "Р": { index: "S", middle: "T", ring: "S", pinky: "S", thumb: "touch" },
  "С": { index: "H", middle: "H", ring: "H", pinky: "H", thumb: "c" },
  "Т": { index: "S", middle: "S", ring: "S", pinky: "T", thumb: "touch", direction: "down" },
  "У": { index: "B", middle: "B", ring: "B", pinky: "S", thumb: "out" },
  "Ф": { index: "F", middle: "F", ring: "F", pinky: "F", thumb: "along" },
  "Х": { index: "X", middle: "B", ring: "B", pinky: "B", thumb: "tucked" },
  "Ц": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", motion: "down" },
  "Ч": { index: "T", middle: "T", ring: "B", pinky: "B", thumb: "pinch" },
  "Ш": { index: "S", middle: "S", ring: "S", pinky: "T", thumb: "touch" },
  "Щ": { index: "S", middle: "S", ring: "S", pinky: "T", thumb: "touch", motion: "down" },
  "Ъ": { index: "S", middle: "B", ring: "B", pinky: "B", thumb: "out", motion: "tilt" },
  "Ы": { index: "S", middle: "B", ring: "B", pinky: "S", thumb: "tucked" },
  "Ь": { index: "S", middle: "B", ring: "B", pinky: "B", thumb: "out", motion: "tilt-back" },
  "Э": { index: "H", middle: "B", ring: "B", pinky: "B", thumb: "c" },
  "Ю": { index: "F", middle: "F", ring: "F", pinky: "S", thumb: "under" },
  "Я": { index: "S", middle: "S", ring: "B", pinky: "B", thumb: "tucked", crossed: true },
};

// Положение и длина пальцев на картинке (viewBox 0 0 100 120).
const FINGER_BASE_Y = 58; // где пальцы выходят из ладони
const FINGER_GEOMETRY = {
  pinky:  { x: 30, length: 28, width: 9,  spreadX: -7 },
  ring:   { x: 41, length: 37, width: 10, spreadX: -4 },
  middle: { x: 52, length: 41, width: 10, spreadX: -2 },
  index:  { x: 63, length: 37, width: 10, spreadX: 7 },
};
const THUMB_BASE = { x: 70, y: 96 }; // откуда растёт большой палец
const FINGER_NAMES = ["pinky", "ring", "middle", "index"];

// Значок движения в углу схемы.
const MOTION_ICONS = { draw: "✎", turn: "↻", down: "↓", tilt: "↷", "tilt-back": "↶" };

// Толстая линия с обводкой: сначала тёмная широкая, сверху — цветная.
function stroke(d, width, cls = "") {
  return `<path class="hs-outline ${cls}" d="${d}" stroke-width="${width + 3}"/>` +
         `<path class="hs-skin ${cls}" d="${d}" stroke-width="${width}"/>`;
}

// Где большой палец касается согнутого пальца (для Н, Р, Ш, М, Т) — у костяшки этого пальца.
function touchPoint(name) {
  return { x: FINGER_GEOMETRY[name].x, y: FINGER_BASE_Y - 4 };
}
// Для «О» указательный и большой образуют колечко — рисуем его отдельно.
const O_RING = { x: 68, y: 44, r: 9 };
// Точка щепоти «Ч» — между кончиками пальцев, «смотрящих» на собеседника.
const PINCH_POINT = { x: 60, y: 50 };

function drawFinger(name, state, shape) {
  const g = FINGER_GEOMETRY[name];
  const x = g.x;
  const y0 = FINGER_BASE_Y;
  if (state === "S") {
    // Разведённые пальцы (К, Л, М) — кончики наклонены наружу.
    const tipX = shape.spread ? x + g.spreadX : x;
    return stroke(`M${x} ${y0} L${tipX} ${y0 - g.length}`, g.width, "hs-finger");
  }
  if (state === "B") return stroke(`M${x} ${y0 + 2} L${x} ${y0 - 6}`, g.width + 1, "hs-folded");
  if (state === "H") {
    // Дуга: палец идёт вверх и загибается к большому пальцу.
    const top = y0 - g.length * 0.62;
    return stroke(`M${x} ${y0} Q${x} ${top} ${x + 9} ${top + 4}`, g.width, "hs-finger");
  }
  if (state === "F") {
    // Палец «смотрит» на собеседника: короткий, с кружком-кончиком (вид с торца).
    return stroke(`M${x} ${y0} L${x} ${y0 - 9}`, g.width + 1, "hs-finger") +
           `<circle class="hs-tip" cx="${x}" cy="${y0 - 11}" r="${g.width / 2 + 1}"/>`;
  }
  if (state === "X") {
    // Крючок: палец поднят и загнут вниз.
    return stroke(`M${x} ${y0} L${x} ${y0 - 18} Q${x} ${y0 - 27} ${x - 7} ${y0 - 20}`, g.width, "hs-finger");
  }
  // T — палец согнут к ладони, его держит большой палец.
  if (name === "index" && shape.thumb === "touch") return ""; // у «О» указательный — часть колечка
  if (shape.thumb === "pinch") {
    // Щепоть: палец тянется к общей точке с большим.
    return stroke(`M${x} ${y0} Q${x} ${PINCH_POINT.y - 4} ${PINCH_POINT.x} ${PINCH_POINT.y}`, g.width, "hs-finger");
  }
  return stroke(`M${x} ${y0 + 2} L${x} ${y0 - 6}`, g.width + 1, "hs-folded");
}

function drawThumb(shape) {
  const b = THUMB_BASE;
  if (shape.thumb === "tucked") return stroke(`M${b.x + 2} ${b.y - 2} Q${b.x - 4} ${b.y - 18} ${b.x - 24} ${b.y - 22}`, 11, "hs-thumb");
  if (shape.thumb === "along") return stroke(`M${b.x + 2} ${b.y} L${b.x + 3} ${b.y - 36}`, 11, "hs-thumb");
  if (shape.thumb === "out") return stroke(`M${b.x + 2} ${b.y} L${b.x + 22} ${b.y - 26}`, 11, "hs-thumb");
  if (shape.thumb === "c") return stroke(`M${b.x + 2} ${b.y} Q${b.x + 16} ${b.y - 10} ${b.x + 14} ${b.y - 24}`, 11, "hs-thumb");
  if (shape.thumb === "under") return stroke(`M${b.x + 2} ${b.y} Q${b.x - 2} ${b.y - 30} ${b.x - 30} ${b.y - 34}`, 11, "hs-thumb");
  if (shape.thumb === "pinch") {
    const p = PINCH_POINT;
    return stroke(`M${b.x + 2} ${b.y} Q${b.x + 12} ${p.y + 20} ${p.x + 2} ${p.y + 2}`, 11, "hs-thumb") +
           `<circle class="hs-ring" cx="${p.x}" cy="${p.y}" r="9"/>`;
  }
  // touch: большой палец тянется к пальцу, отмеченному "T".
  const target = FINGER_NAMES.find((n) => shape[n] === "T");
  if (target === "index") {
    // «О»: колечко из указательного и большого пальцев.
    const o = O_RING;
    const ring = `M${o.x} ${o.y - o.r} a${o.r} ${o.r} 0 1 0 0.1 0`;
    return stroke(`M${b.x + 2} ${b.y} Q${b.x + 8} ${b.y - 24} ${o.x + 4} ${o.y + o.r}`, 11, "hs-thumb") +
           stroke(ring, 8, "hs-finger") + `<circle class="hs-ring" cx="${o.x}" cy="${o.y}" r="${o.r + 3}"/>`;
  }
  const p = touchPoint(target);
  return stroke(`M${b.x + 2} ${b.y} Q${b.x - 6} ${p.y + 22} ${p.x + 4} ${p.y + 3}`, 11, "hs-thumb") +
         `<circle class="hs-ring" cx="${p.x}" cy="${p.y}" r="8"/>`;
}

// Скрещённые пальцы «Я»: средний поверх указательного, кончики поменялись местами.
function drawCrossed() {
  const i = FINGER_GEOMETRY.index;
  const m = FINGER_GEOMETRY.middle;
  const y0 = FINGER_BASE_Y;
  return stroke(`M${i.x} ${y0} L${m.x + 1} ${y0 - i.length}`, i.width, "hs-finger") +
         stroke(`M${m.x} ${y0} L${i.x + 1} ${y0 - m.length + 2}`, m.width, "hs-finger");
}

// Возвращает строку SVG со схемой буквы.
export function handSchemaSvg(letter) {
  const shape = SHAPES[letter];
  if (!shape) return "";
  // Сначала прямые пальцы (они «за» ладонью), потом ладонь, потом согнутые и большой — поверх.
  const onTop = (state) => state === "B" || state === "T" || state === "F";
  const skipForCross = (n) => shape.crossed && (n === "index" || n === "middle");
  const behind = FINGER_NAMES.filter((n) => !onTop(shape[n]) && !skipForCross(n)).map((n) => drawFinger(n, shape[n], shape));
  const folded = FINGER_NAMES.filter((n) => onTop(shape[n])).map((n) => drawFinger(n, shape[n], shape));
  const palm = `<path class="hs-outline-fill" d="M24 60 Q24 54 30 54 L66 54 Q72 54 73 62 L76 96 Q76 108 64 110 L60 120 L38 120 L34 110 Q24 106 24 96 Z"/>`;
  const hand = `${shape.crossed ? drawCrossed() : ""}${behind.join("")}${palm}${folded.join("")}${drawThumb(shape)}`;
  // Буквы пальцами вниз — поворачиваем всю руку на 180°.
  const body = shape.direction === "down" ? `<g transform="rotate(180 50 62)">${hand}</g>` : hand;
  const motion = shape.motion
    ? `<circle class="hs-motion-bg" cx="86" cy="14" r="11"/><text class="hs-motion" x="86" y="19" text-anchor="middle">${MOTION_ICONS[shape.motion]}</text>`
    : "";
  return `<svg class="hand-schema" viewBox="0 0 100 124" role="img" aria-label="Схема буквы ${letter}">${body}${motion}</svg>`;
}
