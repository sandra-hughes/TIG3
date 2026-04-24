// main.js — DOM glue for Sudoku. Depends on window.SudokuLib.
(function () {
  const Lib = window.SudokuLib;
  const { rcToIdx, idxToR, idxToC, generatePuzzle, getConflicts, getPeers } = Lib;

  const STORAGE_CURRENT = 'tig3.sudoku.current';
  const STORAGE_STATS = 'tig3.sudoku.stats';
  const bestKey = (d) => 'tig3.sudoku.best.' + d;

  let state = null;
  let selected = -1;
  let notesMode = false;
  let undoStack = [];
  let timerHandle = null;
  const els = {};
  function $(id) { return document.getElementById(id); }

  function init() {
    const ids = [
      'grid', 'digit-pad',
      'hud-time', 'hud-errors', 'hud-hints', 'hud-best',
      'btn-new', 'btn-undo', 'btn-hint', 'btn-notes', 'btn-pause', 'btn-difficulty',
      'overlay', 'overlay-title', 'overlay-text', 'overlay-action',
      'generating-overlay',
    ];
    for (const id of ids) els[id] = $(id);
    buildGrid();
    buildDigitPad();
    bindControls();
    renderHud();
    const saved = loadCurrent();
    if (saved && !saved.completed) {
      state = saved;
      state.paused = true;
      state.startedAt = null;
      els['btn-difficulty'].value = state.difficulty;
      renderAll();
      showOverlay(
        'Welcome back',
        'Difficulty: ' + state.difficulty + ' · ' + formatTime(state.elapsedMs) + ' elapsed.',
        'Resume',
        'resume'
      );
    } else {
      showOverlay('TIG3 Sudoku', 'Pick a difficulty and start a new game.', 'New game', 'newgame');
    }
  }

  function buildGrid() {
    const grid = els['grid'];
    grid.innerHTML = '';
    for (let i = 0; i < 81; i++) {
      const r = idxToR(i), c = idxToC(i);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.idx = i;
      if (c === 2 || c === 5) cell.classList.add('br');
      if (r === 2 || r === 5) cell.classList.add('bb');
      const val = document.createElement('div');
      val.className = 'cell-value';
      cell.appendChild(val);
      const notesEl = document.createElement('div');
      notesEl.className = 'cell-notes';
      for (let n = 1; n <= 9; n++) {
        const s = document.createElement('span');
        s.dataset.n = n;
        notesEl.appendChild(s);
      }
      cell.appendChild(notesEl);
      cell.addEventListener('click', () => selectCell(i));
      grid.appendChild(cell);
    }
  }

  function buildDigitPad() {
    const pad = els['digit-pad'];
    pad.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement('button');
      b.className = 'pad-btn';
      b.textContent = n;
      b.addEventListener('click', () => inputDigit(n));
      pad.appendChild(b);
    }
    const erase = document.createElement('button');
    erase.className = 'pad-btn pad-erase';
    erase.textContent = '⌫';
    erase.addEventListener('click', () => inputDigit(0));
    pad.appendChild(erase);
  }

  function bindControls() {
    els['btn-new'].addEventListener('click', () => promptNewGame());
    els['btn-undo'].addEventListener('click', undo);
    els['btn-hint'].addEventListener('click', useHint);
    els['btn-notes'].addEventListener('click', toggleNotes);
    els['btn-pause'].addEventListener('click', togglePause);
    els['overlay-action'].addEventListener('click', () => {
      const mode = els['overlay'].dataset.mode;
      if (mode === 'resume') { hideOverlay(); resume(); }
      else { promptNewGame(); }
    });
    els['btn-difficulty'].addEventListener('change', (e) => {
      if (state && !state.completed) {
        if (!confirm('Start a new ' + e.target.value + ' game? Current progress will be lost.')) {
          e.target.value = state.difficulty;
          return;
        }
      }
      newGame(e.target.value);
    });
    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (!state) return;
    const k = e.key;
    if (k === 'Escape') { togglePause(); e.preventDefault(); return; }
    if (state.paused || state.completed) return;
    if (/^[1-9]$/.test(k)) { inputDigit(parseInt(k, 10)); e.preventDefault(); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { inputDigit(0); e.preventDefault(); return; }
    if (k === 'n' || k === 'N') { toggleNotes(); e.preventDefault(); return; }
    if (k === 'h' || k === 'H') { useHint(); e.preventDefault(); return; }
    if (k === 'u' || k === 'U') { undo(); e.preventDefault(); return; }
    if (k === 'r' || k === 'R') { promptNewGame(); e.preventDefault(); return; }
    if (k.startsWith('Arrow')) {
      if (selected < 0) { selectCell(40); e.preventDefault(); return; }
      let r = idxToR(selected), c = idxToC(selected);
      if (k === 'ArrowUp') r = (r + 8) % 9;
      if (k === 'ArrowDown') r = (r + 1) % 9;
      if (k === 'ArrowLeft') c = (c + 8) % 9;
      if (k === 'ArrowRight') c = (c + 1) % 9;
      selectCell(rcToIdx(r, c));
      e.preventDefault();
    }
  }

  function promptNewGame() {
    const diff = els['btn-difficulty'].value;
    if (state && !state.completed) {
      if (!confirm('Start a new ' + diff + ' game? Current progress will be lost.')) return;
    }
    newGame(diff);
  }

  async function newGame(difficulty) {
    showGenerating(difficulty);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = Date.now();
    const { given, solution } = generatePuzzle(difficulty);
    const dt = Date.now() - t0;
    console.log('[sudoku] generated', difficulty, 'in', dt, 'ms,', given.filter((v) => v !== 0).length, 'clues');
    hideGenerating();
    state = {
      difficulty,
      given: given.slice(),
      board: given.slice(),
      solution: solution.slice(),
      notes: Array.from({ length: 81 }, () => []),
      errors: 0,
      hints: 0,
      elapsedMs: 0,
      startedAt: Date.now(),
      paused: false,
      completed: false,
    };
    undoStack = [];
    selected = 40;
    bumpStat('started', difficulty);
    saveCurrent();
    startTimer();
    hideOverlay();
    renderAll();
  }

  function selectCell(idx) {
    if (state && state.paused) return;
    selected = idx;
    renderHighlights();
  }

  function inputDigit(n) {
    if (selected < 0 || !state || state.paused || state.completed) return;
    const idx = selected;
    if (state.given[idx] !== 0) return;
    if (notesMode && n !== 0) {
      const before = state.notes[idx].slice();
      let after;
      if (state.notes[idx].includes(n)) {
        after = state.notes[idx].filter((x) => x !== n);
      } else {
        after = [...state.notes[idx], n].sort((a, b) => a - b);
      }
      state.notes[idx] = after;
      pushUndo({ type: 'notes', idx, before, after: after.slice() });
    } else if (n === 0) {
      const before = state.board[idx];
      if (before === 0) return;
      state.board[idx] = 0;
      pushUndo({ type: 'clear', idx, before, after: 0 });
    } else {
      const before = state.board[idx];
      if (before === n) return;
      const r = idxToR(idx), c = idxToC(idx);
      let isError = false;
      for (const p of getPeers(r, c)) {
        if (state.board[p] === n) { isError = true; break; }
      }
      const sideEffects = [];
      if (state.notes[idx].length > 0) {
        sideEffects.push({ idx, before: state.notes[idx].slice(), after: [] });
        state.notes[idx] = [];
      }
      for (const p of getPeers(r, c)) {
        if (state.notes[p].includes(n)) {
          const beforeN = state.notes[p].slice();
          state.notes[p] = state.notes[p].filter((x) => x !== n);
          sideEffects.push({ idx: p, before: beforeN, after: state.notes[p].slice() });
        }
      }
      state.board[idx] = n;
      if (isError) state.errors++;
      pushUndo({ type: 'fill', idx, before, after: n, sideEffects });
    }
    saveCurrent();
    renderAll();
    checkWin();
  }

  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > 200) undoStack.shift();
  }

  function undo() {
    if (!state || state.paused || state.completed) return;
    const e = undoStack.pop();
    if (!e) return;
    if (e.type === 'fill') {
      state.board[e.idx] = e.before;
      if (e.sideEffects) for (const se of e.sideEffects) state.notes[se.idx] = se.before.slice();
    } else if (e.type === 'clear') {
      state.board[e.idx] = e.before;
    } else if (e.type === 'notes') {
      state.notes[e.idx] = e.before.slice();
    }
    saveCurrent();
    renderAll();
  }

  function useHint() {
    if (!state || state.paused || state.completed) return;
    const candidates = [];
    for (let i = 0; i < 81; i++) {
      if (state.given[i] === 0 && state.board[i] !== state.solution[i]) candidates.push(i);
    }
    if (candidates.length === 0) return;
    const target = candidates.includes(selected)
      ? selected
      : candidates[Math.floor(Math.random() * candidates.length)];
    const v = state.solution[target];
    state.board[target] = v;
    state.notes[target] = [];
    state.hints++;
    const r = idxToR(target), c = idxToC(target);
    for (const p of getPeers(r, c)) {
      state.notes[p] = state.notes[p].filter((x) => x !== v);
    }
    selected = target;
    saveCurrent();
    renderAll();
    checkWin();
  }

  function toggleNotes() {
    notesMode = !notesMode;
    els['btn-notes'].classList.toggle('active', notesMode);
    els['btn-notes'].textContent = notesMode ? 'Notes: ON (N)' : 'Notes: OFF (N)';
  }

  function togglePause() {
    if (!state || state.completed) return;
    if (state.paused) resume(); else pause();
  }

  function pause() {
    if (!state || state.paused) return;
    state.elapsedMs += Date.now() - state.startedAt;
    state.paused = true;
    state.startedAt = null;
    stopTimer();
    saveCurrent();
    showOverlay('Paused', 'Time: ' + formatTime(state.elapsedMs), 'Resume', 'resume');
  }

  function resume() {
    if (!state || !state.paused) return;
    state.startedAt = Date.now();
    state.paused = false;
    saveCurrent();
    startTimer();
    hideOverlay();
    renderAll();
  }

  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => { renderHud(); saveCurrent(); }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function currentElapsed() {
    if (!state) return 0;
    if (state.paused) return state.elapsedMs;
    return state.elapsedMs + (Date.now() - state.startedAt);
  }

  function checkWin() {
    if (!state || state.completed) return;
    for (let i = 0; i < 81; i++) if (state.board[i] !== state.solution[i]) return;
    state.completed = true;
    state.elapsedMs = currentElapsed();
    state.paused = true;
    state.startedAt = null;
    stopTimer();
    const elapsed = state.elapsedMs;
    const key = bestKey(state.difficulty);
    const prevBest = parseInt(localStorage.getItem(key) || '0', 10);
    let isBest = false;
    if (!prevBest || elapsed < prevBest) {
      localStorage.setItem(key, String(elapsed));
      isBest = true;
    }
    bumpStat('won', state.difficulty);
    localStorage.removeItem(STORAGE_CURRENT);
    els['grid'].classList.add('won');
    const summary =
      'Time: ' + formatTime(elapsed) +
      (isBest ? ' · NEW BEST 🌟' : '') +
      ' · ' + state.difficulty +
      ' · errors: ' + state.errors +
      ' · hints: ' + state.hints;
    showOverlay('You won!', summary, 'New game', 'newgame');
  }

  function bumpStat(field, difficulty) {
    let stats = {};
    try { stats = JSON.parse(localStorage.getItem(STORAGE_STATS) || '{}'); } catch (e) {}
    if (!stats[difficulty]) stats[difficulty] = { started: 0, won: 0 };
    stats[difficulty][field] = (stats[difficulty][field] || 0) + 1;
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  }

  function saveCurrent() {
    if (!state) return;
    if (!state.paused) {
      const now = Date.now();
      state.elapsedMs += now - state.startedAt;
      state.startedAt = now;
    }
    const snap = {
      difficulty: state.difficulty,
      given: state.given,
      board: state.board,
      solution: state.solution,
      notes: state.notes,
      errors: state.errors,
      hints: state.hints,
      elapsedMs: state.elapsedMs,
      startedAt: state.startedAt,
      paused: state.paused,
      completed: state.completed,
    };
    try { localStorage.setItem(STORAGE_CURRENT, JSON.stringify(snap)); } catch (e) {}
  }

  function loadCurrent() {
    const raw = localStorage.getItem(STORAGE_CURRENT);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function renderAll() { renderGrid(); renderHighlights(); renderHud(); }

  function renderGrid() {
    if (!state) return;
    const cells = els['grid'].children;
    for (let i = 0; i < 81; i++) {
      const cell = cells[i];
      const val = cell.querySelector('.cell-value');
      const v = state.board[i];
      val.textContent = v === 0 ? '' : v;
      cell.classList.toggle('given', state.given[i] !== 0);
      const noteEls = cell.querySelectorAll('.cell-notes span');
      for (let n = 1; n <= 9; n++) {
        noteEls[n - 1].textContent = (v === 0 && state.notes[i].includes(n)) ? n : '';
      }
    }
  }

  function renderHighlights() {
    const cells = els['grid'].children;
    for (let i = 0; i < 81; i++) {
      cells[i].classList.remove('selected', 'peer', 'same-number', 'conflict');
    }
    if (!state) return;
    if (selected >= 0) {
      const r = idxToR(selected), c = idxToC(selected);
      for (const p of getPeers(r, c)) cells[p].classList.add('peer');
      cells[selected].classList.add('selected');
      const v = state.board[selected];
      if (v !== 0) {
        for (let i = 0; i < 81; i++) {
          if (i !== selected && state.board[i] === v) cells[i].classList.add('same-number');
        }
      }
    }
    const conflicts = new Set();
    for (let i = 0; i < 81; i++) {
      const v = state.board[i];
      if (v === 0) continue;
      const r = idxToR(i), c = idxToC(i);
      const conf = getConflicts(state.board, r, c);
      if (conf.size > 0) {
        conflicts.add(i);
        for (const x of conf) conflicts.add(x);
      }
    }
    for (const i of conflicts) cells[i].classList.add('conflict');
  }

  function renderHud() {
    els['hud-time'].textContent = formatTime(currentElapsed());
    els['hud-errors'].textContent = state ? state.errors : 0;
    els['hud-hints'].textContent = state ? state.hints : 0;
    const diff = state ? state.difficulty : els['btn-difficulty'].value;
    const best = parseInt(localStorage.getItem(bestKey(diff)) || '0', 10);
    els['hud-best'].textContent = best ? formatTime(best) : '—';
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function showOverlay(title, text, action, mode) {
    els['overlay-title'].textContent = title;
    els['overlay-text'].textContent = text;
    els['overlay-action'].textContent = action;
    els['overlay'].dataset.mode = mode || 'newgame';
    els['overlay'].classList.add('visible');
  }

  function hideOverlay() {
    els['overlay'].classList.remove('visible');
    if (els['grid']) els['grid'].classList.remove('won');
  }

  function showGenerating(diff) {
    els['generating-overlay'].textContent = 'Generating ' + diff + '…';
    els['generating-overlay'].classList.add('visible');
  }

  function hideGenerating() {
    els['generating-overlay'].classList.remove('visible');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
