// ============================================================
// hand-features.js — превращает 21 точку руки в понятные «признаки».
//
// Пример признаков: «указательный палец прямой», «большой палец касается
// безымянного», «ладонь повёрнута к камере», «рука слишком далеко».
// Именно по признакам потом проверяются буквы (letters.js) и ищутся ошибки (mistakes.js).
//
// Формулы и пороги — docs/GESTURES.md, раздел 4.
// Связь: main.js на каждом кадре вызывает computeFeatures(hand).
// ============================================================

import {
  WRIST, THUMB, FINGERS, FINGER_NAMES,
  FINGER_STRAIGHT_MIN_ANGLE, FINGER_BENT_MAX_ANGLE, THUMB_STRAIGHT_MIN_ANGLE,
  THUMB_OUT_MIN_DIST, THUMB_SIDE_MAX_DIST, TOUCH_MAX_DIST, GAP_MIN_DIST,
  FINGERS_TOGETHER_MAX_DIST, PALM_FACING_MIN, FINGERS_UP_MAX_TILT, FINGERS_DOWN_MIN_TILT,
  FINGERS_APART_MIN_DIST, CROSS_MIN,
  HAND_TOO_SMALL, HAND_TOO_BIG, EDGE_MARGIN, SMOOTHING_FRAMES,
} from "./config.js";

// Состояния пальца.
export const STRAIGHT = "straight"; // прямой
export const HALF = "half";         // полусогнут (дуга, как в букве «С»)
export const BENT = "bent";         // согнут к ладони

// ---------- Геометрия ----------

// Расстояние между двумя точками в 3D.
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Угол в точке B между отрезками B→A и B→C, в градусах.
// Прямой палец ≈ 180°, сильно согнутый ≈ 40–70°.
function angleAt(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const lengths = Math.hypot(ba.x, ba.y, ba.z) * Math.hypot(bc.x, bc.y, bc.z);
  if (lengths === 0) return 180;
  // Math.min/max защищают arccos от чисел чуть больше 1 из-за округления.
  const cos = Math.min(1, Math.max(-1, dot / lengths));
  return (Math.acos(cos) * 180) / Math.PI;
}

// ---------- Сглаживание ----------
// Точки MediaPipe немного «дрожат». Храним последние SMOOTHING_FRAMES значений
// каждого числа и берём среднее — тогда состояние пальца не прыгает.

const history = {};

function smooth(name, value) {
  if (!history[name]) history[name] = [];
  const values = history[name];
  values.push(value);
  if (values.length > SMOOTHING_FRAMES) values.shift();
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Когда рука пропала, старые значения выбрасываем, чтобы новая рука не смешалась со старой.
export function resetSmoothing() {
  for (const name in history) delete history[name];
}

// ---------- Главная функция ----------

// hand — объект из hand-tracker.js; videoWidth/videoHeight — размер кадра в пикселях.
export function computeFeatures(hand, videoWidth, videoHeight) {
  const w = hand.worldPoints; // 3D-точки в метрах — для углов и расстояний
  const p = hand.points;      // точки в кадре (0..1) — для положения руки в кадре

  // Размер ладони: запястье → костяшка среднего пальца. На него делим все расстояния.
  const palm = distance(w[WRIST], w[FINGERS.middle.mcp]);
  const rel = (a, b) => distance(w[a], w[b]) / palm; // расстояние в «ладонях»

  // 1. Сгиб каждого пальца: угол в среднем суставе (MCP → PIP → кончик).
  const fingers = {};
  for (const name of FINGER_NAMES) {
    const f = FINGERS[name];
    const angle = smooth(name + "Angle", angleAt(w[f.mcp], w[f.pip], w[f.tip]));
    let state = HALF;
    if (angle >= FINGER_STRAIGHT_MIN_ANGLE) state = STRAIGHT;
    else if (angle <= FINGER_BENT_MAX_ANGLE) state = BENT;
    fingers[name] = { angle, state };
  }

  // 2. Большой палец.
  const thumbAngle = smooth("thumbAngle", angleAt(w[THUMB.mcp], w[THUMB.ip], w[THUMB.tip]));
  const thumbToIndexBase = smooth("thumbOut", rel(THUMB.tip, FINGERS.index.mcp));
  const thumbToIndexMiddle = smooth("thumbSide", rel(THUMB.tip, FINGERS.index.pip));
  const thumbStraight = thumbAngle >= THUMB_STRAIGHT_MIN_ANGLE;
  const thumbOut = thumbToIndexBase >= THUMB_OUT_MIN_DIST;
  const thumbAlongIndex = thumbStraight && thumbToIndexMiddle <= THUMB_SIDE_MAX_DIST;

  // 3. Какой палец касается большого. Берём ближайшую из двух точек пальца
  //    (кончик или верхний сустав): большой палец часто лежит на ногте, а не «кончик в кончик».
  const touch = {};
  let touchedFinger = null;
  let smallestTouch = Infinity;
  for (const name of FINGER_NAMES) {
    const f = FINGERS[name];
    const d = smooth(name + "Touch", Math.min(rel(THUMB.tip, f.tip), rel(THUMB.tip, f.dip)));
    touch[name] = d;
    if (d <= TOUCH_MAX_DIST && d < smallestTouch) {
      smallestTouch = d;
      touchedFinger = name;
    }
  }

  // 4. Просвет между большим и указательным (буква «С»).
  const gap = smooth("gap", rel(THUMB.tip, FINGERS.index.tip));
  const hasGap = gap >= GAP_MIN_DIST;

  // 5. Сомкнуты ли пальцы (буква «В»): соседние кончики близко друг к другу.
  const spread = smooth("spread", Math.max(
    rel(FINGERS.index.tip, FINGERS.middle.tip),
    rel(FINGERS.middle.tip, FINGERS.ring.tip),
    rel(FINGERS.ring.tip, FINGERS.pinky.tip),
  ));
  const fingersTogether = spread <= FINGERS_TOGETHER_MAX_DIST;

  // 5а. Раствор указательного и среднего (буква К — «галочка»).
  const indexMiddleGap = smooth("indexMiddleGap", rel(FINGERS.index.tip, FINGERS.middle.tip));
  const indexMiddleApart = indexMiddleGap >= FINGERS_APART_MIN_DIST;

  // 5б. Скрещены ли указательный и средний (буква Я).
  //     Ось поперёк ладони — от костяшки указательного к костяшке мизинца. У основания средний
  //     всегда дальше по этой оси, чем указательный. Если у КОНЧИКОВ порядок поменялся — пальцы скрещены.
  //     Ось берём из самой руки, поэтому работает и для левой, и для правой.
  const axis = {
    x: w[FINGERS.pinky.mcp].x - w[FINGERS.index.mcp].x,
    y: w[FINGERS.pinky.mcp].y - w[FINGERS.index.mcp].y,
    z: w[FINGERS.pinky.mcp].z - w[FINGERS.index.mcp].z,
  };
  const tipsDelta = {
    x: w[FINGERS.middle.tip].x - w[FINGERS.index.tip].x,
    y: w[FINGERS.middle.tip].y - w[FINGERS.index.tip].y,
    z: w[FINGERS.middle.tip].z - w[FINGERS.index.tip].z,
  };
  const axisLength = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const crossValue = smooth("cross",
    (tipsDelta.x * axis.x + tipsDelta.y * axis.y + tipsDelta.z * axis.z) / (axisLength * palm));
  const fingersCrossed = crossValue <= -CROSS_MIN;

  // ---------- Положение руки в кадре (по точкам кадра, в пикселях) ----------
  const px = (i) => ({ x: p[i].x * videoWidth, y: p[i].y * videoHeight });
  const wrist = px(WRIST);
  const middleBase = px(FINGERS.middle.mcp);
  const palmPx = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);

  // 6. Размер руки в кадре: ладонь в долях высоты кадра (далеко / близко).
  const palmOnScreen = smooth("palmOnScreen", palmPx / videoHeight);
  const tooFar = palmOnScreen < HAND_TOO_SMALL;
  const tooClose = palmOnScreen > HAND_TOO_BIG;

  // 7. Рука у края кадра: хоть одна точка почти на краю.
  const atEdge = p.some((pt) =>
    pt.x < EDGE_MARGIN || pt.x > 1 - EDGE_MARGIN || pt.y < EDGE_MARGIN || pt.y > 1 - EDGE_MARGIN);

  // 8. Пальцы вверх: угол между «запястье → средний палец» и вертикалью.
  //    В кадре ось y направлена вниз, поэтому «вверх» — это минус y.
  const tilt = smooth("tilt",
    (Math.abs(Math.atan2(middleBase.x - wrist.x, wrist.y - middleBase.y)) * 180) / Math.PI);
  const fingersUp = tilt <= FINGERS_UP_MAX_TILT;
  // Направление пальцев: вверх / вниз (буква Г) / вбок.
  let direction = "side";
  if (tilt <= FINGERS_UP_MAX_TILT) direction = "up";
  if (tilt >= FINGERS_DOWN_MIN_TILT) direction = "down";

  // 9. Ориентация ладони. Векторное произведение «запястье→указательный» и
  //    «запястье→мизинец»: его знак показывает, какой стороной рука к камере.
  //    Для правой руки ладонью к камере оно отрицательное, для левой — положительное.
  const indexBase = px(FINGERS.index.mcp);
  const pinkyBase = px(FINGERS.pinky.mcp);
  const cross = (indexBase.x - wrist.x) * (pinkyBase.y - wrist.y)
              - (indexBase.y - wrist.y) * (pinkyBase.x - wrist.x);
  const palmFacingRaw = palmPx > 0 ? cross / (palmPx * palmPx) : 0;
  const palmSign = smooth("palmSign", hand.isRightHand ? -palmFacingRaw : palmFacingRaw);
  let orientation = "edge";                          // ребром
  if (palmSign >= PALM_FACING_MIN) orientation = "palm";   // ладонью к камере
  if (palmSign <= -PALM_FACING_MIN) orientation = "back";  // тыльной стороной

  return {
    fingers, thumbAngle, thumbStraight, thumbOut, thumbAlongIndex,
    thumbToIndexBase, thumbToIndexMiddle,
    touch, touchedFinger, gap, hasGap, spread, fingersTogether,
    indexMiddleGap, indexMiddleApart, crossValue, fingersCrossed,
    palmOnScreen, tooFar, tooClose, atEdge, tilt, fingersUp, direction,
    palmSign, orientation, isRightHand: hand.isRightHand,
  };
}

// «Указка» — прямой только указательный палец, направленный ВВЕРХ. Этим жестом управляем
// курсором (кнопки меню). Та же форма пальцами ВНИЗ — это буква «Г», поэтому проверяем направление.
export function isPointingGesture(features) {
  const f = features.fingers;
  return features.direction === "up"
    && f.index.state === STRAIGHT
    && f.middle.state === BENT && f.ring.state === BENT && f.pinky.state === BENT;
}
