// TIG3 local profile + per-user storage. No backend, no password, no network.
(function () {
  const CURRENT_KEY = 'tig3.auth.currentUser';
  const USER_PREFIX = 'tig3.user.';
  const PROFILE_PREFIX = 'tig3.profile.';
  const PROFILE_NAME_PREFIX = 'tig3.profileName.';

  const SafeStorage = {
    get(key) {
      try { return localStorage.getItem(key); }
      catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (e) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); }
      catch (e) {}
    },
  };

  // Legacy only: old builds derived profile IDs from display names.
  function legacySlug(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'player';
  }

  function makeProfileId() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return 'p_' + cryptoApi.randomUUID();
    const bytes = new Uint8Array(16);
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return 'p_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function nowIso() { return new Date().toISOString(); }
  function normalizeName(name) { return String(name || '').trim().slice(0, 32) || 'Player'; }
  function nameIndexKey(name) { return PROFILE_NAME_PREFIX + encodeURIComponent(name.toLocaleLowerCase()); }
  function currentId() { return SafeStorage.get(CURRENT_KEY) || ''; }
  function profileKey(id) { return PROFILE_PREFIX + id; }
  function scopedKey(key, id = currentId()) { return USER_PREFIX + id + '.' + key; }

  function readJson(key, fallback = null) {
    try {
      const raw = SafeStorage.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function writeJson(key, value) {
    return SafeStorage.set(key, JSON.stringify(value));
  }

  function getProfile(id = currentId()) {
    if (!id) return null;
    return readJson(profileKey(id), null);
  }

  function findProfileIdByName(cleanName) {
    const indexed = SafeStorage.get(nameIndexKey(cleanName));
    if (indexed && getProfile(indexed)) return indexed;

    // Compatibility with profiles created before random IDs existed.
    const legacyId = legacySlug(cleanName);
    const legacyProfile = getProfile(legacyId);
    if (legacyProfile && legacyProfile.name === cleanName) {
      SafeStorage.set(nameIndexKey(cleanName), legacyId);
      return legacyId;
    }
    return '';
  }

  function login(name) {
    const cleanName = normalizeName(name);
    const id = findProfileIdByName(cleanName) || makeProfileId();
    const existing = getProfile(id) || { id, name: cleanName, createdAt: nowIso(), games: {} };
    existing.id = id;
    existing.name = cleanName;
    existing.lastLoginAt = nowIso();
    writeJson(profileKey(id), existing);
    SafeStorage.set(nameIndexKey(cleanName), id);
    SafeStorage.set(CURRENT_KEY, id);
    return existing;
  }

  function logout() {
    SafeStorage.remove(CURRENT_KEY);
    location.href = location.pathname.includes('/games/') ? '../../' : './';
  }

  function read(key, fallback = null) {
    const id = currentId();
    if (!id) return fallback;
    return readJson(scopedKey(key, id), fallback);
  }

  function write(key, value) {
    const id = currentId();
    if (!id) return false;
    return writeJson(scopedKey(key, id), value);
  }

  function remove(key) {
    const id = currentId();
    if (!id) return;
    SafeStorage.remove(scopedKey(key, id));
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
