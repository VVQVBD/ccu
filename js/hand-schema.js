// ============================================================
// hand-schema.js — рисует схему руки для каждой буквы (картинка SVG).
//
// Зачем: в уроке и на главной странице нужна картинка «как сложить пальцы».
// Рисуем её кодом — не нужны чужие фото и нет проблем с авторскими правами.
//
// Рука нарисована так, как её видит собеседник: правая рука ладонью к нам,
// поэтому мизинец слева, указательный справа, большой палец — справа снизу.
// Каждый палец — толстая линия с закруглёнными концами (как в мультфильме).
//
// Связь: ui.js вставляет схему в урок, landing (главная) — в карточки букв.
// ============================================================

// Как выглядит каждая буква: состояние 4 пальцев и большого пальца.
//   S — прямой, B — согнут (прижат к ладони), H — полусогнут (дуга), T — касается большого пальца
//   thumb: "tucked" прижат к ладони, "along" вдоль указательного, "out" отведён, "c" полукольцо, "touch" касается
const SHAPES = {
  "В": { index: "S", middle: "S", ring: "S", pinky: "S", thumb: "tucked" },
  "А": { index: "B", middle: "B", ring: "B", pinky: "B", thumb: "along" },
  "У": { index: "B", middle: "B", ring: "B", pinky: "S", thumb: "out" },
  "И": { index: "B", middle: "B", ring: "S", pinky: "S", thumb: "tucked" },
  "Ы": { index: "S", middle: "B", ring: "B", pinky: "S", thumb: "tucked" },
  "Ш": { index: "S", middle: "S", ring: "S", pinky: "T", thumb: "touch" },
  "О": { index: "T", middle: "S", ring: "S", pinky: "S", thumb: "touch" },
  "Н": { index: "S", middle: "S", ring: "T", pinky: "S", thumb: "touch" },
  "Р": { index: "S", middle: "T", ring: "S", pinky: "S", thumb: "touch" },
  "С": { index: "H", middle: "H", ring: "H", pinky: "H", thumb: "c" },
};

// Положение и длина пальцев на картинке (viewBox 0 0 100 120).
const FINGER_BASE_Y = 58; // где пальцы выходят из ладони
const FINGER_GEOMETRY = {
  pinky:  { x: 30, length: 28, width: 9 },
  ring:   { x: 41, length: 37, width: 10 },
  middle: { x: 52, length: 41, width: 10 },
  index:  { x: 63, length: 37, width: 10 },
};
const THUMB_BASE = { x: 70, y: 96 }; // откуда растёт большой палец

// Толстая линия с обводкой: сначала тёмная широкая, сверху — цветная.
function stroke(d, width, cls = "") {
  return `<path class="hs-outline ${cls}" d="${d}" stroke-width="${width + 3}"/>` +
         `<path class="hs-skin ${cls}" d="${d}" stroke-width="${width}"/>`;
}

// Где большой палец касается согнутого пальца (для Н, Р, Ш) — у костяшки этого пальца.
function touchPoint(name) {
  return { x: FINGER_GEOMETRY[name].x, y: FINGER_BASE_Y - 4 };
}
// Для «О» указательный и большой образуют колечко — рисуем его отдельно.
const O_RING = { x: 68, y: 44, r: 9 };

function drawFinger(name, state) {
  const g = FINGER_GEOMETRY[name];
  const x = g.x;
  const y0 = FINGER_BASE_Y;
  if (state === "S") return stroke(`M${x} ${y0} L${x} ${y0 - g.length}`, g.width, "hs-finger");
  if (state === "B") return stroke(`M${x} ${y0 + 2} L${x} ${y0 - 6}`, g.width + 1, "hs-folded");
  if (state === "H") {
    // Дуга: палец идёт вверх и загибается к большому пальцу.
    const top = y0 - g.length * 0.62;
    return stroke(`M${x} ${y0} Q${x} ${top} ${x + 9} ${top + 4}`, g.width, "hs-finger");
  }
  // T — палец согнут к ладони, его держит большой палец (рисуется как согнутый).
  if (name === "index") return ""; // у «О» указательный — часть колечка, рисуется в drawThumb
  return stroke(`M${x} ${y0 + 2} L${x} ${y0 - 6}`, g.width + 1, "hs-folded");
}

function drawThumb(shape) {
  const b = THUMB_BASE;
  if (shape.thumb === "tucked") return stroke(`M${b.x + 2} ${b.y - 2} Q${b.x - 4} ${b.y - 18} ${b.x - 24} ${b.y - 22}`, 11, "hs-thumb");
  if (shape.thumb === "along") return stroke(`M${b.x + 2} ${b.y} L${b.x + 3} ${b.y - 36}`, 11, "hs-thumb");
  if (shape.thumb === "out") return stroke(`M${b.x + 2} ${b.y} L${b.x + 22} ${b.y - 26}`, 11, "hs-thumb");
  if (shape.thumb === "c") return stroke(`M${b.x + 2} ${b.y} Q${b.x + 16} ${b.y - 10} ${b.x + 14} ${b.y - 24}`, 11, "hs-thumb");
  // touch: большой палец тянется к пальцу, отмеченному "T".
  const target = Object.keys(FINGER_GEOMETRY).find((n) => shape[n] === "T");
  if (target === "index") {
    // «О»: колечко из указательного и большого пальцев.
    const o = O_RING;
    const ring = `M${o.x} ${o.y - o.r} a${o.r} ${o.r} 0 1 0 0.1 0`;
    return stroke(`M${b.x + 2} ${b.y} Q${b.x + 8} ${b.y - 24} ${o.x + 4} ${o.y + o.r}`, 11, "hs-thumb") +
           stroke(ring, 8, "hs-finger") + `<circle class="hs-ring" cx="${o.x}" cy="${o.y}" r="${o.r + 5}"/>`;
  }
  const p = touchPoint(target);
  return stroke(`M${b.x + 2} ${b.y} Q${b.x - 6} ${p.y + 22} ${p.x + 4} ${p.y + 3}`, 11, "hs-thumb") +
         `<circle class="hs-ring" cx="${p.x}" cy="${p.y}" r="8"/>`;
}

// Возвращает строку SVG со схемой буквы.
export function handSchemaSvg(letter) {
  const shape = SHAPES[letter];
  if (!shape) return "";
  // Сначала прямые пальцы (они «за» ладонью), потом ладонь, потом согнутые и большой — поверх.
  const onTop = (state) => state === "B" || state === "T"; // согнутые пальцы лежат поверх ладони
  const names = ["pinky", "ring", "middle", "index"];
  const behind = names.filter((n) => !onTop(shape[n])).map((n) => drawFinger(n, shape[n]));
  const folded = names.filter((n) => onTop(shape[n])).map((n) => drawFinger(n, shape[n]));
  const palm = `<path class="hs-outline-fill" d="M24 60 Q24 54 30 54 L66 54 Q72 54 73 62 L76 96 Q76 108 64 110 L60 120 L38 120 L34 110 Q24 106 24 96 Z"/>`;
  return `<svg class="hand-schema" viewBox="0 0 100 120" role="img" aria-label="Схема буквы ${letter}">
    ${behind.join("")}${palm}${folded.join("")}${drawThumb(shape)}
  </svg>`;
}
