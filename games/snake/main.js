// Neon Snake — TIG3
// Canvas 2D, no deps. Keyboard + touch swipe.
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const CELL = 24;
  const GRID = W / CELL;

  const elScore = document.getElementById('score');
  const elBest = document.getElementById('best');
  const elLevel = document.getElementById('level');
  const elSpeed = document.getElementById('speed');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');

  const BEST_KEY = 'tig3.snake.best';
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const state = {
    mode: 'menu', // menu | playing | paused | dead
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0),
    level: 1,
    speed: 1,
    snake: [],
    food: { x: 0, y: 0 },
    dir: DIRS.right,
    nextDir: DIRS.right,
    lastStep: 0,
    stepMs: 130,
    particles: [],
    touchStart: null,
  };

  elBest.textContent = state.best;

  function reset() {
    state.score = 0;
    state.level = 1;
    state.speed = 1;
    state.stepMs = 130;
    state.dir = DIRS.right;
    state.nextDir = DIRS.right;
    const mid = Math.floor(GRID / 2);
    state.snake = [
      { x: mid + 1, y: mid },
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
    ];
    state.particles = [];
    spawnFood();
    updateHUD();
  }

  function startGame() {
    reset();
    state.mode = 'playing';
    state.lastStep = performance.now();
    hideOverlay();
  }

  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    showOverlay('Paused', 'Press <b>Space</b> to resume.', 'Resume');
  }

  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.lastStep = performance.now();
    hideOverlay();
  }

  function gameOver() {
    state.mode = 'dead';
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, state.best);
      elBest.textContent = state.best;
    }
    showOverlay(
      'Game Over',
      'Score: <b>' + state.score + '</b> · Best: <b>' + state.best + '</b> · Level: <b>' + state.level + '</b>',
      'Retry'
    );
  }

  function updateHUD() {
    elScore.textContent = state.score;
    elBest.textContent = state.best;
    elLevel.textContent = state.level;
    elSpeed.textContent = state.speed.toFixed(1) + '×';
  }

  function showOverlay(title, text, buttonText) {
    overlayTitle.innerHTML = title;
    overlayText.innerHTML = text;
    startBtn.textContent = buttonText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function isOccupied(x, y, ignoreTail = false) {
    const len = ignoreTail ? state.snake.length - 1 : state.snake.length;
    for (let i = 0; i < len; i++) {
      const p = state.snake[i];
      if (p.x === x && p.y === y) return true;
    }
    return false;
  }

  function spawnFood() {
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!isOccupied(x, y)) free.push({ x, y });
      }
    }
    state.food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
  }

  function setDir(dir) {
    if (!dir) return;
    if (dir.x + state.dir.x === 0 && dir.y + state.dir.y === 0) return;
    state.nextDir = dir;
  }

  function step() {
    state.dir = state.nextDir;
    const head = state.snake[0];
    const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    const willEat = next.x === state.food.x && next.y === state.food.y;
    if (next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID || isOccupied(next.x, next.y, !willEat)) {
      burst(head.x, head.y, '#ff4dd2', 28);
      gameOver();
      return;
    }

    state.snake.unshift(next);
    if (willEat) {
      state.score += 10 * state.level;
      burst(next.x, next.y, '#ffeb3b', 18);
      const newLevel = 1 + Math.floor(state.score / 80);
      if (newLevel !== state.level) {
        state.level = newLevel;
        state.speed = Math.min(2.8, 1 + (state.level - 1) * 0.16);
        state.stepMs = Math.max(54, Math.round(130 / state.speed));
      }
      spawnFood();
    } else {
      state.snake.pop();
    }
    updateHUD();
  }

  function burst(x, y, color, count) {
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 28 + Math.random() * 16,
        color,
      });
    }
  }

  function tickParticles() {
    for (const p of state.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= 1;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      const p = i * CELL;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    }
  }

  function drawCell(x, y, color, inset = 3, glow = 12) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    const pulse = 0.6 + Math.sin(performance.now() / 120) * 0.4;
    drawCell(state.food.x, state.food.y, '#ffeb3b', 5 - pulse, 18);

    for (let i = state.snake.length - 1; i >= 0; i--) {
      const p = state.snake[i];
      const isHead = i === 0;
      drawCell(p.x, p.y, isHead ? '#ff4dd2' : '#00f0ff', isHead ? 3 : 4, isHead ? 18 : 10);
    }

    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 36);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function loop(now) {
    if (state.mode === 'playing') {
      if (now - state.lastStep >= state.stepMs) {
        state.lastStep = now;
        step();
      }
      tickParticles();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function handleAction() {
    if (state.mode === 'playing') { pause(); return; }
    if (state.mode === 'paused') { resume(); return; }
    startGame();
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { setDir(DIRS.up); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { setDir(DIRS.down); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { setDir(DIRS.left); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { setDir(DIRS.right); e.preventDefault(); }
    else if (k === ' ') { handleAction(); e.preventDefault(); }
    else if (k === 'r' || k === 'R') { startGame(); e.preventDefault(); }
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.touchStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!state.touchStart) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - state.touchStart.x;
    const dy = (e.clientY - rect.top) - state.touchStart.y;
    state.touchStart = null;
    if (Math.hypot(dx, dy) < 18) { if (state.mode !== 'playing') handleAction(); return; }
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? DIRS.right : DIRS.left);
    else setDir(dy > 0 ? DIRS.down : DIRS.up);
  });

  startBtn.addEventListener('click', handleAction);
  reset();
  showOverlay('Neon Snake', 'Eat glowing orbs, dodge your tail, and ride the speed-up waves. Use <b>arrow keys</b> or <b>WASD</b>.', 'Start');
  requestAnimationFrame(loop);
})();
