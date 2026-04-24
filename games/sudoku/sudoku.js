// sudoku.js — pure logic, no DOM. Exposes window.SudokuLib.
(function () {
  const rcToIdx = (r, c) => r * 9 + c;
  const idxToR = (i) => Math.floor(i / 9);
  const idxToC = (i) => i % 9;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isValid(board, r, c, n) {
    for (let i = 0; i < 9; i++) {
      if (board[rcToIdx(r, i)] === n) return false;
      if (board[rcToIdx(i, c)] === n) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (board[rcToIdx(br + dr, bc + dc)] === n) return false;
      }
    }
    return true;
  }

  function solve(board) {
    let idx = -1;
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) { idx = i; break; }
    }
    if (idx === -1) return true;
    const r = idxToR(idx), c = idxToC(idx);
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const n of nums) {
      if (isValid(board, r, c, n)) {
        board[idx] = n;
        if (solve(board)) return true;
        board[idx] = 0;
      }
    }
    return false;
  }

  // Count solutions, short-circuit at `limit`.
  function countSolutions(board, limit = 2) {
    let count = 0;
    function backtrack() {
      if (count >= limit) return;
      let idx = -1;
      for (let i = 0; i < 81; i++) {
        if (board[i] === 0) { idx = i; break; }
      }
      if (idx === -1) { count++; return; }
      const r = idxToR(idx), c = idxToC(idx);
      for (let n = 1; n <= 9; n++) {
        if (count >= limit) return;
        if (isValid(board, r, c, n)) {
          board[idx] = n;
          backtrack();
          board[idx] = 0;
        }
      }
    }
    backtrack();
    return count;
  }

  function generateSolved() {
    const b = new Array(81).fill(0);
    for (let bi = 0; bi < 3; bi++) {
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let k = 0;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          b[rcToIdx(bi * 3 + dr, bi * 3 + dc)] = nums[k++];
        }
      }
    }
    solve(b);
    return b;
  }

  // 180°-symmetric digging + uniqueness check + 5s timeout fallback.
  function generatePuzzle(difficulty) {
    const targets = { easy: 41, medium: 32, hard: 28, expert: 24 };
    let target = targets[difficulty] || 32;
    const startTime = Date.now();
    let solution, given;
    let attempt = 0;
    while (true) {
      attempt++;
      solution = generateSolved();
      given = solution.slice();
      const indices = shuffle([...Array(81).keys()]);
      const removed = new Set();
      for (const idx of indices) {
        if (removed.has(idx)) continue;
        const r = idxToR(idx), c = idxToC(idx);
        const partner = rcToIdx(8 - r, 8 - c);
        const pairSize = idx === partner ? 1 : 2;
        const cluesAfter = 81 - removed.size - pairSize;
        if (cluesAfter < target) break;
        const v1 = given[idx], v2 = given[partner];
        given[idx] = 0;
        given[partner] = 0;
        const test = given.slice();
        if (countSolutions(test, 2) === 1) {
          removed.add(idx);
          if (idx !== partner) removed.add(partner);
        } else {
          given[idx] = v1;
          given[partner] = v2;
        }
        if (Date.now() - startTime > 5000) break;
      }
      const clueCount = given.reduce((a, v) => a + (v !== 0 ? 1 : 0), 0);
      if (clueCount <= target + 4) break;
      if (Date.now() - startTime > 5000 && attempt < 2) {
        target = Math.min(target + 4, 50);
        continue;
      }
      if (attempt >= 2) break;
    }
    return { given, solution };
  }

  function getConflicts(board, r, c) {
    const v = board[rcToIdx(r, c)];
    const out = new Set();
    if (v === 0) return out;
    for (let i = 0; i < 9; i++) {
      if (i !== c && board[rcToIdx(r, i)] === v) out.add(rcToIdx(r, i));
      if (i !== r && board[rcToIdx(i, c)] === v) out.add(rcToIdx(i, c));
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const rr = br + dr, cc = bc + dc;
        if ((rr !== r || cc !== c) && board[rcToIdx(rr, cc)] === v) {
          out.add(rcToIdx(rr, cc));
        }
      }
    }
    return out;
  }

  function getPeers(r, c) {
    const out = new Set();
    for (let i = 0; i < 9; i++) {
      out.add(rcToIdx(r, i));
      out.add(rcToIdx(i, c));
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        out.add(rcToIdx(br + dr, bc + dc));
      }
    }
    out.delete(rcToIdx(r, c));
    return out;
  }

  window.SudokuLib = {
    rcToIdx, idxToR, idxToC,
    isValid, solve, countSolutions,
    generateSolved, generatePuzzle,
    getConflicts, getPeers,
  };
})();
