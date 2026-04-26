// Neon Breakout — TIG3
// Pure Canvas 2D, no deps. Keyboard + mouse.
// localStorage keys:
//   tig3.breakout.best     — high score (int)
//   tig3.breakout.maxLevel — highest cleared level (int). 0 = none.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const elScore = document.getElementById('score');
  const elLives = document.getElementById('lives');
  const elLevel = document.getElementById('level');
  const elBest = document.getElementById('best');
  const elBestLv = document.getElementById('best-lv');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');
  const levelPicker = document.getElementById('level-picker');
  const lvDown = document.getElementById('lv-down');
  const lvUp = document.getElementById('lv-up');
  const lvPick = document.getElementById('lv-pick');
  const progressNote = document.getElementById('progress-note');

  const Auth = window.TIG3Auth;
  Auth.requireLogin();
  const BEST_KEY = 'breakout.best';
  const MAX_LEVEL_KEY = 'breakout.maxLevel';
  const COLORS = ['#00f0ff', '#ff4dd2', '#ffeb3b', '#7cff4d', '#ff9b4d'];
  const SNAPSHOT_SAVE_INTERVAL_MS = 1000;
  let lastSnapshotSaveAt = 0;

  const state = {
    mode: 'menu', // menu | playing | paused | dead | win
    score: 0,
    lives: 3,
    level: 1,
    best: Auth.getNumber(BEST_KEY, 0),
    maxCleared: Auth.getNumber(MAX_LEVEL_KEY, 0),
    selectedStart: 1,
    paddle: { x: W / 2 - 60, y: H - 30, w: 120, h: 12, speed: 12 },
    ball: { x: W / 2, y: H - 50, r: 8, vx: 0, vy: 0, stuck: true },
    bricks: [],
    particles: [],
    keys: { left: false, right: false },
    mouseX: null,
  };

  // Default selection: resume at next unplayed level (or 1 if nothing cleared)
  state.selectedStart = Math.max(1, state.maxCleared + 1);

  elBest.textContent = state.best;
  elBestLv.textContent = state.maxCleared;

  function maxStartLevel() { return state.maxCleared + 1; }

  function renderMenuControls() {
    const hasProgress = state.maxCleared >= 1;
    levelPicker.hidden = !hasProgress;
    progressNote.hidden = false;
    if (hasProgress) {
      const cap = maxStartLevel();
      if (state.selectedStart < 1) state.selectedStart = 1;
      if (state.selectedStart > cap) state.selectedStart = cap;
      lvPick.textContent = 'Lv ' + state.selectedStart;
      lvDown.disabled = state.selectedStart <= 1;
      lvUp.disabled = state.selectedStart >= cap;
      startBtn.textContent = (state.mode === 'dead' ? 'Retry' : 'Start') + ' · Lv ' + state.selectedStart;
    } else {
      startBtn.textContent = state.mode === 'dead' ? 'Try Again' : 'Start';
    }
  }

  function hideMenuControls() {
    levelPicker.hidden = true;
    progressNote.hidden = true;
  }

  function buildBricks(level) {
    const cols = 10;
    const rows = Math.min(4 + level, 8);
    const padX = 40;
    const padTop = 70;
    const gap = 4;
    const bw = (W - padX * 2 - gap * (cols - 1)) / cols;
    const bh = 22;
    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: padX + c * (bw + gap),
          y: padTop + r * (bh + gap),
          w: bw,
          h: bh,
          color: COLORS[r % COLORS.length],
          hp: 1 + Math.floor(r / 3),
          alive: true,
        });
      }
    }
    return bricks;
  }

  function resetBall() {
    state.ball.x = state.paddle.x + state.paddle.w / 2;
    state.ball.y = state.paddle.y - state.ball.r - 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.stuck = true;
  }

  function launchBall() {
    if (!state.ball.stuck) return;
    const baseSpeed = 6 + (state.level - 1) * 0.5;
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6;
    state.ball.vx = Math.cos(angle) * baseSpeed;
    state.ball.vy = Math.sin(angle) * baseSpeed;
    state.ball.stuck = false;
  }

  function startGame(startLevel) {
    state.score = 0;
    state.lives = 3;
    state.level = Math.max(1, startLevel || 1);
    state.bricks = buildBricks(state.level);
    state.particles = [];
    resetBall();
    state.mode = 'playing';
    Auth.appendRecord('breakout', 'start', { level: state.level });
    saveSnapshotNow();
    hideOverlay();
    updateHUD();
  }

  function nextLevel() {
    state.level += 1;
    state.bricks = buildBricks(state.level);
    resetBall();
    state.mode = 'playing';
    showIntroOverlay('Level ' + state.level, 'Press <b>Space</b> or click to launch.');
    updateHUD();
  }

  function gameOver() {
    if (state.score > state.best) {
      state.best = state.score;
      Auth.setNumber(BEST_KEY, state.best);
      elBest.textContent = state.best;
    }
    state.mode = 'dead';
    state.selectedStart = Math.max(1, state.maxCleared + 1);
    const progressLine = state.maxCleared >= 1
      ? ' · Cleared up to <b>Lv ' + state.maxCleared + '</b>'
      : '';
    Auth.appendRecord('breakout', 'game_over', { score: state.score, level: state.level, best: state.best });
    Auth.clearSnapshot('breakout');
    showMenuOverlay(
      'Game Over',
      'Final score: <b>' + state.score + '</b> · Best: <b>' + state.best + '</b>' + progressLine,
    );
  }

  function winGame() {
    if (state.score > state.best) {
      state.best = state.score;
      Auth.setNumber(BEST_KEY, state.best);
      elBest.textContent = state.best;
    }
    if (state.level > state.maxCleared) {
      state.maxCleared = state.level;
      Auth.setNumber(MAX_LEVEL_KEY, state.maxCleared);
      elBestLv.textContent = state.maxCleared;
    }
    state.mode = 'win';
    Auth.appendRecord('breakout', 'level_clear', { score: state.score, level: state.level, maxCleared: state.maxCleared });
    saveSnapshotNow();
    showIntroOverlay(
      'Level ' + state.level + ' Cleared!',
      'Press <b>Space</b> for next level. Progress saved.',
    );
  }

  // Overlay with full menu (start/retry + level picker + progress note).
  function showMenuOverlay(title, text) {
    overlayTitle.innerHTML = title;
    overlayText.innerHTML = text;
    overlay.classList.remove('hidden');
    renderMenuControls();
  }

  // Overlay with only Space-to-continue message (pause/win/level-intro).
  function showIntroOverlay(title, text) {
    overlayTitle.innerHTML = title;
    overlayText.innerHTML = text;
    overlay.classList.remove('hidden');
    hideMenuControls();
    startBtn.textContent = 'Continue';
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function updateHUD() {
    elScore.textContent = state.score;
    elLives.textContent = state.lives;
    elLevel.textContent = state.level;
  }

  function snapshotData() {
    return {
      mode: state.mode === 'dead' ? 'menu' : state.mode,
      score: state.score, lives: state.lives, level: state.level, best: state.best,
      maxCleared: state.maxCleared, selectedStart: state.selectedStart,
      paddle: state.paddle, ball: state.ball, bricks: state.bricks, particles: state.particles,
    };
  }

  function saveSnapshot(force = false) {
    if (state.mode === 'dead' || state.mode === 'menu') return;
    const now = performance.now();
    if (!force && now - lastSnapshotSaveAt < SNAPSHOT_SAVE_INTERVAL_MS) return;
    lastSnapshotSaveAt = now;
    Auth.saveSnapshot('breakout', snapshotData());
  }

  function saveSnapshotNow() { saveSnapshot(true); }

  function isFiniteNumber(value, min = -Infinity, max = Infinity) {
    return Number.isFinite(value) && value >= min && value <= max;
  }

  function isValidPaddle(paddle) {
    return paddle &&
      isFiniteNumber(paddle.x, -state.paddle.w, W) &&
      isFiniteNumber(paddle.y, 0, H) &&
      isFiniteNumber(paddle.w, 40, W) &&
      isFiniteNumber(paddle.h, 6, 40) &&
      isFiniteNumber(paddle.speed, 1, 40);
  }

  function isValidBall(ball) {
    return ball &&
      isFiniteNumber(ball.x, -50, W + 50) &&
      isFiniteNumber(ball.y, -50, H + 50) &&
      isFiniteNumber(ball.r, 2, 30) &&
      isFiniteNumber(ball.vx, -50, 50) &&
      isFiniteNumber(ball.vy, -50, 50) &&
      typeof ball.stuck === 'boolean';
  }

  function isValidBrick(brick) {
    return brick &&
      isFiniteNumber(brick.x, -10, W + 10) &&
      isFiniteNumber(brick.y, -10, H + 10) &&
      isFiniteNumber(brick.w, 1, W) &&
      isFiniteNumber(brick.h, 1, 80) &&
      isFiniteNumber(brick.hp, 0, 10) &&
      typeof brick.color === 'string' && brick.color.length <= 32 &&
      typeof brick.alive === 'boolean';
  }

  function isValidParticle(particle) {
    return particle &&
      isFiniteNumber(particle.x, -100, W + 100) &&
      isFiniteNumber(particle.y, -100, H + 100) &&
      isFiniteNumber(particle.vx, -20, 20) &&
      isFiniteNumber(particle.vy, -20, 20) &&
      isFiniteNumber(particle.life, 0, 100) &&
      typeof particle.color === 'string' && particle.color.length <= 32;
  }

  function isValidSnapshot(data) {
    return data && typeof data === 'object' &&
      isFiniteNumber(data.score, 0, 100000000) &&
      isFiniteNumber(data.lives, 0, 10) &&
      isFiniteNumber(data.level, 1, 999) &&
      isFiniteNumber(data.best, 0, 100000000) &&
      isFiniteNumber(data.maxCleared, 0, 999) &&
      isFiniteNumber(data.selectedStart, 1, 1000) &&
      isValidPaddle(data.paddle) &&
      isValidBall(data.ball) &&
      Array.isArray(data.bricks) && data.bricks.length <= 120 && data.bricks.every(isValidBrick) &&
      Array.isArray(data.particles) && data.particles.length <= 300 && data.particles.every(isValidParticle);
  }

  function restoreSnapshot(data) {
    if (!isValidSnapshot(data)) return false;
    state.score = data.score;
    state.lives = data.lives;
    state.level = data.level;
    state.best = data.best;
    state.maxCleared = data.maxCleared;
    state.selectedStart = data.selectedStart;
    state.paddle = data.paddle;
    state.ball = data.ball;
    state.bricks = data.bricks;
    state.particles = data.particles;
    state.mode = 'paused';
    updateHUD();
    elBest.textContent = state.best;
    elBestLv.textContent = state.maxCleared;
    return true;
  }

  function showRestorePrompt() {
    state.mode = 'restore';
    showIntroOverlay('Saved game found', 'Click <b>Continue</b> to restore. A 3-second countdown will start first.');
  }

  function resumeCountdown() {
    let n = 3;
    showIntroOverlay('Restoring save', 'Resuming in <b>' + n + '</b>…');
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        state.mode = 'playing';
        hideOverlay();
        saveSnapshotNow();
      } else {
        overlayText.innerHTML = 'Resuming in <b>' + n + '</b>…';
      }
    }, 1000);
  }

  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30,
        color,
      });
    }
  }

  function tickParticles() {
    for (const p of state.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 1;
    }
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function movePaddle() {
    const p = state.paddle;
    if (state.mouseX != null) {
      p.x = state.mouseX - p.w / 2;
    } else {
      if (state.keys.left) p.x -= p.speed;
      if (state.keys.right) p.x += p.speed;
    }
    p.x = Math.max(0, Math.min(W - p.w, p.x));
  }

  function updateBall() {
    const b = state.ball;
    const p = state.paddle;

    if (b.stuck) {
      b.x = p.x + p.w / 2;
      b.y = p.y - b.r - 2;
      return;
    }

    b.x += b.vx;
    b.y += b.vy;

    if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -1; }
    if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }

    if (b.y + b.r >= p.y && b.y - b.r < p.y + p.h &&
        b.x >= p.x && b.x <= p.x + p.w && b.vy > 0) {
      const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2);
      const angle = hit * (Math.PI / 3);
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(angle) * speed;
      b.vy = -Math.abs(Math.cos(angle) * speed);
      b.y = p.y - b.r - 1;
    }

    if (b.y - b.r > H) {
      state.lives -= 1;
      updateHUD();
      if (state.lives <= 0) {
        gameOver();
      } else {
        resetBall();
        saveSnapshotNow();
      }
    }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (b.x + b.r > brick.x && b.x - b.r < brick.x + brick.w &&
          b.y + b.r > brick.y && b.y - b.r < brick.y + brick.h) {
        const overlapX = Math.min(b.x + b.r - brick.x, brick.x + brick.w - (b.x - b.r));
        const overlapY = Math.min(b.y + b.r - brick.y, brick.y + brick.h - (b.y - b.r));
        if (overlapX < overlapY) b.vx *= -1;
        else b.vy *= -1;
        brick.hp -= 1;
        if (brick.hp <= 0) {
          brick.alive = false;
          state.score += 10 * state.level;
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 12);
          updateHUD();
        } else {
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 4);
        }
        break;
      }
    }

    if (state.bricks.every(br => !br.alive)) {
      winGame();
    } else {
      saveSnapshot();
    }
  }

  function draw() {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }

    // Bricks: group by color so we change shadowColor/fillStyle less often.
    const byColor = {};
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (!byColor[brick.color]) byColor[brick.color] = [];
      byColor[brick.color].push(brick);
    }
    ctx.shadowBlur = 12;
    for (const color in byColor) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      for (const brick of byColor[color]) {
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (const brick of state.bricks) {
      if (brick.alive && brick.hp > 1) {
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 3);
      }
    }

    const p = state.paddle;
    ctx.fillStyle = '#ff4dd2';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff4dd2';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.shadowBlur = 0;

    const b = state.ball;
    ctx.fillStyle = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    for (const pt of state.particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / 30);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (state.mode === 'playing') {
      movePaddle();
      updateBall();
      tickParticles();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function adjustSelectedStart(delta) {
    if (state.mode !== 'menu' && state.mode !== 'dead') return;
    if (state.maxCleared < 1) return;
    state.selectedStart = Math.min(maxStartLevel(), Math.max(1, state.selectedStart + delta));
    renderMenuControls();
  }

  function startFromOverlay() {
    if (state.mode === 'restore') { resumeCountdown(); return; }
    if (state.mode === 'win') { nextLevel(); return; }
    if (state.mode === 'paused') { state.mode = 'playing'; hideOverlay(); saveSnapshotNow(); return; }
    if (state.mode === 'menu' || state.mode === 'dead') {
      startGame(state.selectedStart);
      return;
    }
    if (state.mode === 'playing') {
      hideOverlay();
      launchBall();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      if (state.mode === 'menu' || state.mode === 'dead') {
        e.preventDefault();
        adjustSelectedStart(-1);
        return;
      }
      state.keys.left = true;
      state.mouseX = null;
    }
    if (e.key === 'ArrowRight') {
      if (state.mode === 'menu' || state.mode === 'dead') {
        e.preventDefault();
        adjustSelectedStart(1);
        return;
      }
      state.keys.right = true;
      state.mouseX = null;
    }
    if (e.key === ' ') {
      e.preventDefault();
      startFromOverlay();
    }
    if (e.key === 'p' || e.key === 'P') {
      if (state.mode === 'playing') {
        state.mode = 'paused';
        saveSnapshotNow();
        showIntroOverlay('Paused', 'Press <b>P</b> or <b>Space</b> to resume.');
      } else if (state.mode === 'paused') {
        state.mode = 'playing';
        hideOverlay();
        saveSnapshotNow();
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      if (state.mode === 'menu' || state.mode === 'dead') {
        if (state.maxCleared === 0) return;
        if (!confirm('Reset cleared-level progress?')) return;
        state.maxCleared = 0;
        Auth.remove(MAX_LEVEL_KEY);
        elBestLv.textContent = 0;
        state.selectedStart = 1;
        renderMenuControls();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') state.keys.left = false;
    if (e.key === 'ArrowRight') state.keys.right = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - rect.left) / rect.width) * W;
  });

  canvas.addEventListener('mouseleave', () => {
    state.mouseX = null;
    state.keys.left = false;
    state.keys.right = false;
    if (state.mode === 'playing') {
      state.mode = 'paused';
      saveSnapshotNow();
      showIntroOverlay('Paused', 'Mouse left the game area. Click <b>Continue</b> to resume.');
    }
  });

  canvas.addEventListener('click', () => {
    if (state.mode === 'playing' && state.ball.stuck) launchBall();
  });

  startBtn.addEventListener('click', startFromOverlay);
  lvDown.addEventListener('click', () => adjustSelectedStart(-1));
  lvUp.addEventListener('click', () => adjustSelectedStart(1));

  // Initial menu render / save restore
  const savedRun = Auth.loadSnapshot('breakout');
  if (savedRun && restoreSnapshot(savedRun.data)) {
    showRestorePrompt();
  } else {
    if (savedRun) Auth.clearSnapshot('breakout');
    renderMenuControls();
  }
  window.addEventListener('beforeunload', saveSnapshotNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveSnapshotNow();
  });

  loop();
})();
