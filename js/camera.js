// ============================================================
// camera.js — включает веб-камеру и показывает её в <video>.
//
// Связь: main.js вызывает startCamera() один раз при запуске.
// Видео потом читает hand-tracker.js (ищет руку на каждом кадре).
// Видео с камеры никуда не отправляется — всё обрабатывается в браузере.
// ============================================================

// Разрешение 640×480: MediaPipe этого хватает, а на слабом телефоне так быстрее.
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// Включает камеру. Возвращает Promise, который завершится, когда видео пошло.
// Если камеры нет или доступ запрещён — выбросит ошибку с понятным текстом.
export async function startCamera(videoElement) {
  // Камера в браузере работает только по https:// или на localhost.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Браузер не даёт доступ к камере. Открой сайт по ссылке https:// в Chrome, Safari или Edge.");
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user", // на телефоне — фронтальная камера
        width: { ideal: VIDEO_WIDTH },
        height: { ideal: VIDEO_HEIGHT },
      },
    });
  } catch (error) {
    // Переводим ошибки браузера в подсказку, что сделать.
    if (error.name === "NotAllowedError") {
      throw new Error("Доступ к камере запрещён. Нажми на значок камеры в адресной строке, разреши доступ и обнови страницу.");
    }
    if (error.name === "NotFoundError") {
      throw new Error("Камера не найдена. Подключи веб-камеру и обнови страницу.");
    }
    if (error.name === "NotReadableError") {
      throw new Error("Камера занята другой программой (Zoom, Teams…). Закрой её и обнови страницу.");
    }
    throw new Error("Не удалось включить камеру: " + error.message);
  }

  videoElement.srcObject = stream;
  // playsinline + muted нужны, чтобы iPhone показал видео прямо на странице.
  videoElement.setAttribute("playsinline", "");
  videoElement.muted = true;
  await videoElement.play();
}
