// ============================================================
// draw.js — рисует скелет руки поверх видео.
//
// Это «обратная связь» из кейса: пользователь видит, что система его распознала.
// Правильные пальцы — зелёные, ошибочные — красные, палец из главной ошибки — толще.
//
// Canvas лежит точно поверх <video> и отражён так же, как видео (CSS scaleX(-1)),
// поэтому точки рисуем в координатах кадра без отражения.
// Связь: main.js на каждом кадре вызывает drawHand().
// ============================================================

import { THUMB, FINGERS, WRIST } from "./config.js";

const COLOR_OK = "#22c55e";      // зелёный — палец в порядке
const COLOR_BAD = "#ef4444";     // красный — палец надо поправить
const COLOR_NEUTRAL = "#e2e8f0"; // светлый — ладонь и пальцы, когда буквы нет (меню)
const COLOR_POINTER = "#facc15"; // жёлтый — кончик указательного в режиме «указка»

// Цепочки точек для каждого пальца (от запястья к кончику).
const CHAINS = {
  thumb:  [WRIST, 1, THUMB.mcp, THUMB.ip, THUMB.tip],
  index:  [FINGERS.index.mcp, FINGERS.index.pip, FINGERS.index.dip, FINGERS.index.tip],
  middle: [FINGERS.middle.mcp, FINGERS.middle.pip, FINGERS.middle.dip, FINGERS.middle.tip],
  ring:   [FINGERS.ring.mcp, FINGERS.ring.pip, FINGERS.ring.dip, FINGERS.ring.tip],
  pinky:  [FINGERS.pinky.mcp, FINGERS.pinky.pip, FINGERS.pinky.dip, FINGERS.pinky.tip],
};
// Ладонь: запястье и костяшки пальцев.
const PALM = [WRIST, FINGERS.index.mcp, FINGERS.middle.mcp, FINGERS.ring.mcp, FINGERS.pinky.mcp, WRIST];

// Подгоняет размер canvas под размер кадра камеры.
export function fitCanvas(canvas, video) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

export function clearCanvas(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

// hand — объект из hand-tracker.js.
// options.badFingers — пальцы, которые красить красным; options.mainFinger — палец главной ошибки;
// options.colored — false в меню (без буквы всё рисуем нейтрально); options.pointing — режим «указка».
export function drawHand(canvas, hand, options = {}) {
  const ctx = canvas.getContext("2d");
  const { badFingers = [], mainFinger = null, colored = false, pointing = false } = options;
  const toPx = (i) => [hand.points[i].x * canvas.width, hand.points[i].y * canvas.height];
  const baseWidth = Math.max(3, canvas.width / 160);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ладонь.
  drawLine(ctx, PALM.map(toPx), COLOR_NEUTRAL, baseWidth);

  // Пальцы.
  for (const name in CHAINS) {
    let color = COLOR_NEUTRAL;
    if (colored) color = badFingers.includes(name) ? COLOR_BAD : COLOR_OK;
    const width = name === mainFinger ? baseWidth * 2.2 : baseWidth;
    drawLine(ctx, CHAINS[name].map(toPx), color, width);
  }

  // Точки-суставы.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < hand.points.length; i++) {
    const [x, y] = toPx(i);
    ctx.beginPath();
    ctx.arc(x, y, baseWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // В режиме «указка» выделяем кончик указательного — это курсор.
  if (pointing) {
    const [x, y] = toPx(FINGERS.index.tip);
    ctx.fillStyle = COLOR_POINTER;
    ctx.beginPath();
    ctx.arc(x, y, baseWidth * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLine(ctx, points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}
