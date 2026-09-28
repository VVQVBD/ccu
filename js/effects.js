// ============================================================
// effects.js — визуальные эффекты: конфетти, вспышка камеры, «набегающие» числа.
//
// Всё сделано на чистом JavaScript: конфетти — это частицы, которые мы сами
// двигаем и рисуем на <canvas> ~60 раз в секунду.
//
// Связь: game.js вызывает burstConfetti() при засчитанной букве и в итогах,
// flashStage() — зелёная вспышка камеры, countUp() — числа в итогах.
// ============================================================

const COLORS = ["#ffb547", "#ff5ea8", "#7c5cff", "#34d399", "#22d3ee", "#ffffff"];
const GRAVITY = 0.25;        // насколько быстро частицы падают вниз
const AIR_RESISTANCE = 0.985; // частицы постепенно замедляются

let particles = [];
let running = false;

// Взрыв конфетти из точки (x, y) на экране. amount — сколько частиц.
export function burstConfetti(x, y, amount = 60) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5, // немного вверх — красивее
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1, // от 1 до 0 — частица постепенно исчезает
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(animate);
  }
}

// Конфетти из центра элемента (например, из буквы).
export function burstFromElement(element, amount) {
  const rect = element.getBoundingClientRect();
  burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, amount);
}

function animate() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.vx *= AIR_RESISTANCE;
    p.vy = p.vy * AIR_RESISTANCE + GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.life -= 0.012;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); // прямоугольная «бумажка»
    ctx.restore();
  }
  particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 50);

  if (particles.length > 0) {
    requestAnimationFrame(animate);
  } else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Зелёная вспышка по краям камеры.
export function flashStage() {
  const flash = document.getElementById("stage-flash");
  flash.classList.remove("go");
  void flash.offsetWidth; // перезапуск CSS-анимации
  flash.classList.add("go");
}

// Число плавно «набегает» от 0 до значения: 0 → 87%.
// Работает для текста вида «87%», «12», «0:45» — анимируем только первое число.
export function countUp(element, durationMs = 900) {
  const text = element.textContent;
  const match = text.match(/\d+/);
  if (!match || text.includes(":")) return; // время «0:45» не анимируем
  const target = Number(match[0]);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // быстро в начале, плавно в конце
    element.textContent = text.replace(match[0], String(Math.round(target * eased)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
