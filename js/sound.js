// ============================================================
// sound.js — короткие звуки без аудиофайлов (Web Audio API).
//
// Звук генерируется прямо в браузере: задаём частоту ноты и длительность.
// Поэтому не нужны файлы и нет проблем с авторскими правами.
//
// Связь: game.js вызывает playSuccess / playHint / playFinish,
// ui.js — playClick и кнопку «звук вкл/выкл».
// ============================================================

let audioContext = null;
let soundOn = true;

// Браузер разрешает звук только после действия пользователя, поэтому
// создаём AudioContext при первом звуке, а не при загрузке страницы.
function getContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

// Одна нота: частота в герцах, начало через delay секунд, длительность duration секунд.
function playNote(frequency, delay, duration, volume = 0.15) {
  if (!soundOn) return;
  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Плавно затухаем, чтобы не было щелчка в конце.
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

// Буква засчитана — две ноты вверх (до → соль).
export function playSuccess() {
  playNote(523, 0, 0.15);
  playNote(784, 0.1, 0.25);
}

// Появилась подсказка — тихая низкая нота, чтобы не раздражать.
export function playHint() {
  playNote(330, 0, 0.2, 0.08);
}

// Нажата кнопка.
export function playClick() {
  playNote(660, 0, 0.08, 0.1);
}

// Режим закончен — короткая мелодия (до-ми-соль-до).
export function playFinish() {
  [523, 659, 784, 1047].forEach((f, i) => playNote(f, i * 0.12, 0.3));
}

export function toggleSound() {
  soundOn = !soundOn;
  return soundOn;
}

export function isSoundOn() {
  return soundOn;
}
