// Neon Breakout — TIG3
// Pure Canvas 2D, no deps. Keyboard + mouse. localStorage high score.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const elScore = document.getElementById('score');
  const elLives = document.getElementById('lives');
  const elLevel = document.getElementById('level');
  const elBest = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');

  const BEST_KEY = 'tig3.breakout.best';
  const COLORS = ['#00f0ff', '#ff4dd2', '#ffeb3b', '#7cff4d', '#ff9b4d'];

  const state = {
    mode: 'menu', // menu | playing | paused | dead | win
    score: 0,
    lives: 3,
    level: 1,
    best: Number(localStorage.getItem(BEST_KEY) || 0),
    paddle: { x: W / 2 - 60, y: H - 30, w: 120, h: 12, speed: 12 },
    ball: { x: W / 2, y: H - 50, r: 8, vx: 0, vy: 0, stuck: true },
    bricks: [],
    particles: [],
    keys: { left: false, right: false },
    mouseX: null,
  };

  elBest.textContent = state.best;

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

  function startGame() {
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.bricks = buildBricks(state.level);
    state.particles = [];
    resetBall();
    state.mode = 'playing';
    hideOverlay();
    updateHUD();
  }

  function nextLevel() {
    state.level += 1;
    state.bricks = buildBricks(state.level);
    resetBall();
    state.mode = 'playing';
    showOverlay('Level ' + state.level, 'Press <b>Space</b> or click to launch.');
    updateHUD();
  }

  function gameOver() {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, state.best);
      elBest.textContent = state.best;
    }
    state.mode = 'dead';
    showOverlay('Game Over', 'Final score: <b>' + state.score + '</b> · Best: <b>' + state.best + '</b>');
    startBtn.textContent = 'Try Again';
  }

  function winGame() {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, state.best);
      elBest.textContent = state.best;
    }
    state.mode = 'win';
    showOverlay('Cleared!', 'Level ' + state.level + ' done. Press <b>Space</b> for next level.');
  }

  function showOverlay(title, text) {
    overlayTitle.innerHTML = title;
    overlayText.innerHTML = text;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function updateHUD() {
    elScore.textContent = state.score;
    elLives.textContent = state.lives;
    elLevel.textContent = state.level;
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
        state.mode = 'playing';
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

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      if (brick.hp > 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 3);
      }
    }
    ctx.shadowBlur = 0;

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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { state.keys.left = true; state.mouseX = null; }
    if (e.key === 'ArrowRight') { state.keys.right = true; state.mouseX = null; }
    if (e.key === ' ') {
      e.preventDefault();
      if (state.mode === 'menu' || state.mode === 'dead') startGame();
      else if (state.mode === 'win') nextLevel();
      else if (state.mode === 'playing') launchBall();
      else if (state.mode === 'paused') { state.mode = 'playing'; hideOverlay(); }
    }
    if (e.key === 'p' || e.key === 'P') {
      if (state.mode === 'playing') {
        state.mode = 'paused';
        showOverlay('Paused', 'Press <b>P</b> or <b>Space</b> to resume.');
      } else if (state.mode === 'paused') {
        state.mode = 'playing';
        hideOverlay();
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

  canvas.addEventListener('mouseleave', () => { state.mouseX = null; });

  canvas.addEventListener('click', () => {
    if (state.mode === 'playing' && state.ball.stuck) launchBall();
  });

  startBtn.addEventListener('click', () => {
    if (state.mode === 'win') nextLevel();
    else startGame();
  });

  loop();
})();
