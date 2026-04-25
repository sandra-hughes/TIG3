// TIG3 local profile + per-user storage. No backend, no password, no network.
(function () {
  const CURRENT_KEY = 'tig3.auth.currentUser';
  const USER_PREFIX = 'tig3.user.';
  const PROFILE_PREFIX = 'tig3.profile.';

  function slug(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'player';
  }

  function nowIso() { return new Date().toISOString(); }
  function currentId() { return localStorage.getItem(CURRENT_KEY) || ''; }
  function profileKey(id) { return PROFILE_PREFIX + id; }
  function scopedKey(key, id = currentId()) { return USER_PREFIX + id + '.' + key; }

  function getProfile(id = currentId()) {
    if (!id) return null;
    try { return JSON.parse(localStorage.getItem(profileKey(id)) || 'null'); }
    catch (e) { return null; }
  }

  function login(name) {
    const cleanName = String(name || '').trim().slice(0, 32) || 'Player';
    const id = slug(cleanName);
    const existing = getProfile(id) || { id, name: cleanName, createdAt: nowIso(), games: {} };
    existing.name = cleanName;
    existing.lastLoginAt = nowIso();
    localStorage.setItem(profileKey(id), JSON.stringify(existing));
    localStorage.setItem(CURRENT_KEY, id);
    return existing;
  }

  function logout() {
    localStorage.removeItem(CURRENT_KEY);
    location.href = location.pathname.includes('/games/') ? '../../' : './';
  }

  function read(key, fallback = null) {
    const id = currentId();
    if (!id) return fallback;
    try {
      const raw = localStorage.getItem(scopedKey(key, id));
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    const id = currentId();
    if (!id) return;
    localStorage.setItem(scopedKey(key, id), JSON.stringify(value));
  }

  function remove(key) {
    const id = currentId();
    if (!id) return;
    localStorage.removeItem(scopedKey(key, id));
  }

  function getNumber(key, fallback = 0) {
    const v = read(key, fallback);
    return Number.isFinite(Number(v)) ? Number(v) : fallback;
  }

  function setNumber(key, value) { write(key, Number(value) || 0); }

  function appendRecord(game, type, data = {}) {
    const key = 'records.' + game;
    const list = read(key, []);
    list.push({ type, at: nowIso(), ...data });
    while (list.length > 200) list.shift();
    write(key, list);
  }

  function saveSnapshot(game, data) {
    write('snapshot.' + game, { savedAt: nowIso(), data });
  }

  function loadSnapshot(game) { return read('snapshot.' + game, null); }
  function clearSnapshot(game) { remove('snapshot.' + game); }

  function showLoginGate() {
    if (document.getElementById('auth-gate')) return;
    const gate = document.createElement('div');
    gate.id = 'auth-gate';
    gate.className = 'auth-gate';
    gate.innerHTML = `
      <form class="auth-card" id="auth-form">
        <div class="auth-kicker">TIG3 PROFILE</div>
        <h2>Log in locally</h2>
        <p>Pick a player name. Scores, saves, records, and level progress stay in this browser.</p>
        <input id="auth-name" maxlength="32" autocomplete="nickname" placeholder="Player name" />
        <button type="submit">Enter TIG3</button>
      </form>`;
    document.body.appendChild(gate);
    const input = gate.querySelector('#auth-name');
    input.focus();
    gate.querySelector('#auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      login(input.value);
      gate.remove();
      renderProfileBar();
      location.reload();
    });
  }

  function renderProfileBar() {
    let bar = document.getElementById('profile-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'profile-bar';
      bar.className = 'profile-bar';
      document.body.appendChild(bar);
    }
    const p = getProfile();
    if (!p) {
      bar.innerHTML = `<button type="button" id="profile-login">Log in</button>`;
      bar.querySelector('#profile-login').addEventListener('click', showLoginGate);
      return;
    }
    bar.innerHTML = `<span>Player: <b>${escapeHtml(p.name)}</b></span><button type="button" id="profile-logout">Switch</button>`;
    bar.querySelector('#profile-logout').addEventListener('click', logout);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function requireLogin() {
    renderProfileBar();
    if (!getProfile()) showLoginGate();
    return !!getProfile();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', requireLogin);
  } else {
    requireLogin();
  }

  window.TIG3Auth = {
    currentId, getProfile, login, logout, requireLogin,
    read, write, remove, getNumber, setNumber,
    appendRecord, saveSnapshot, loadSnapshot, clearSnapshot,
    scopedKey, showLoginGate, renderProfileBar,
  };
})();
