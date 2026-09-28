// ============================================================
// storage.js — прогресс и рекорды пользователя.
//
// Храним в localStorage — это память браузера на этом устройстве.
// Сервер и регистрация не нужны: закрыл вкладку, открыл снова — прогресс на месте.
//
// Что храним:
//   lessons      — звёзды за каждый пройденный урок: { 1: 3, 2: 2 }
//   bestTraining — лучший счёт тренировки (сколько букв за минуту)
//   bestExamMs   — лучшее время экзамена в миллисекундах
//   letters      — по каждой букве: сколько раз показали и сколько раз с ошибкой
//
// Связь: game.js сохраняет результаты, ui.js показывает рекорды.
// ============================================================

const STORAGE_KEY = "azbuka-progress-v1";

function emptyProgress() {
  return { lessons: {}, bestTraining: 0, bestExamMs: null, letters: {} };
}

// Читает прогресс. Если данных нет или они испорчены — начинаем с нуля.
export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...emptyProgress(), ...saved } : emptyProgress();
  } catch {
    return emptyProgress(); // например, в режиме инкогнито localStorage может быть недоступен
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Не сохранилось — не страшно, приложение всё равно работает.
  }
}

// Урок пройден: запоминаем лучший результат по звёздам.
export function saveLessonResult(lessonNumber, stars) {
  const progress = loadProgress();
  progress.lessons[lessonNumber] = Math.max(progress.lessons[lessonNumber] || 0, stars);
  saveProgress(progress);
}

// Возвращает true, если это новый рекорд тренировки.
export function saveTrainingResult(score) {
  const progress = loadProgress();
  const isRecord = score > progress.bestTraining;
  if (isRecord) progress.bestTraining = score;
  saveProgress(progress);
  return isRecord;
}

// Возвращает true, если это новый рекорд экзамена (меньше время — лучше).
export function saveExamResult(timeMs) {
  const progress = loadProgress();
  const isRecord = progress.bestExamMs === null || timeMs < progress.bestExamMs;
  if (isRecord) progress.bestExamMs = timeMs;
  saveProgress(progress);
  return isRecord;
}

// Статистика по буквам — чтобы показать «самые трудные буквы».
export function saveLetterStats(letterResults) {
  const progress = loadProgress();
  for (const { letter, hadMistake } of letterResults) {
    const stat = progress.letters[letter] || { shown: 0, mistakes: 0 };
    stat.shown += 1;
    if (hadMistake) stat.mistakes += 1;
    progress.letters[letter] = stat;
  }
  saveProgress(progress);
}

export function resetProgress() {
  saveProgress(emptyProgress());
}
