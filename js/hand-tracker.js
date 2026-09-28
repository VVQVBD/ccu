// ============================================================
// hand-tracker.js — находит руку на кадре с камеры с помощью MediaPipe.
//
// Что даёт MediaPipe: 21 точку руки (координаты) и какая это рука.
// Больше ничего из MediaPipe мы не берём: какая это буква и что в ней
// неправильно — решает наша логика (hand-features.js, letters.js, mistakes.js).
//
// Связь: main.js создаёт трекер (createHandTracker) и на каждом кадре
// вызывает detectHand(video) → получает руку или null.
// ============================================================

import { MEDIAPIPE_URL, HAND_MODEL_URL, HANDEDNESS_SWAPPED } from "./config.js";

let handLandmarker = null;
let lastVideoTime = -1;
let lastResult = null;

// Загружает библиотеку и модель. Сначала пробуем видеокарту (GPU) — это быстро.
// Если на компьютере не получилось — повторяем на процессоре (CPU).
export async function createHandTracker() {
  // Библиотеку грузим с CDN прямо в браузере — ничего устанавливать не нужно.
  const vision = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
    runningMode: "VIDEO", // режим видео: MediaPipe следит за рукой от кадра к кадру
    numHands: 1,          // азбука показывается одной рукой
  });

  try {
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch (error) {
    console.warn("GPU не запустился, пробуем CPU:", error);
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

// Ищет руку на текущем кадре видео.
// Возвращает объект руки или null, если руки нет:
//   points      — 21 точка в кадре (x, y от 0 до 1) — для рисования и положения в кадре
//   worldPoints — 21 точка в метрах — для углов и расстояний между пальцами
//   isRightHand — true, если правая рука
export function detectHand(video) {
  if (!handLandmarker || video.readyState < 2) return null;

  // Один и тот же кадр второй раз не обрабатываем (экран может обновляться чаще камеры).
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    lastResult = handLandmarker.detectForVideo(video, performance.now());
  }

  const result = lastResult;
  if (!result || result.landmarks.length === 0) return null;

  const label = result.handedness[0][0].categoryName; // "Left" или "Right"
  const isRightHand = HANDEDNESS_SWAPPED ? label === "Left" : label === "Right";

  return {
    points: result.landmarks[0],
    worldPoints: result.worldLandmarks[0],
    isRightHand,
  };
}
