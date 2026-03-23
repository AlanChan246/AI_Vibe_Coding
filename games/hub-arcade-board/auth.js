/**
 * 純前端帳號：資料存於瀏覽器 localStorage（換電腦或清除資料即消失）。
 * 密碼僅以 SHA-256 雜湊儲存，仍不適用於真實敏感場景。
 */
(function () {
  "use strict";

  const USERS_KEY = "arcade-users-v1";
  const SESSION_KEY = "arcade-session-v1";

  /** @returns {object|null} */
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setSession(obj) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(obj));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /** @returns {{ id: string, username: string, passwordHash: string }[]} */
  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function utf8Bytes(str) {
    return new TextEncoder().encode(str);
  }

  async function hashPassword(username, password) {
    const salt = "arcade-v1::" + username.toLowerCase() + "::";
    const data = utf8Bytes(salt + password);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    let h = 0x811c9dc5;
    const s = salt + password;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return "h_" + (h >>> 0).toString(16);
  }

  function validateUsername(name) {
    const t = name.trim();
    if (t.length < 2 || t.length > 20) return { ok: false, msg: "帳號長度需 2～20 字元" };
    if (/[<>\"'&]/.test(t)) return { ok: false, msg: "帳號含不允許的字元" };
    return { ok: true, value: t };
  }

  function validatePassword(pw) {
    if (pw.length < 4) return { ok: false, msg: "密碼至少 4 字元" };
    if (pw.length > 128) return { ok: false, msg: "密碼過長" };
    return { ok: true };
  }

  async function register(username, password) {
    const vu = validateUsername(username);
    if (!vu.ok) return { ok: false, msg: vu.msg };
    const vp = validatePassword(password);
    if (!vp.ok) return { ok: false, msg: vp.msg };

    const users = getUsers();
    const lower = vu.value.toLowerCase();
    if (users.some((u) => u.usernameLower === lower)) {
      return { ok: false, msg: "此帳號已被註冊" };
    }

    const hash = await hashPassword(vu.value, password);
    const id =
      "u_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 10);
    users.push({
      id,
      username: vu.value,
      usernameLower: lower,
      passwordHash: hash,
    });
    saveUsers(users);
    setSession({ type: "user", userId: id, username: vu.value });
    return { ok: true };
  }

  async function login(username, password) {
    const vu = validateUsername(username);
    if (!vu.ok) return { ok: false, msg: vu.msg };
    const users = getUsers();
    const lower = vu.value.toLowerCase();
    const hash = await hashPassword(vu.value, password);
    const u = users.find(
      (x) => x.usernameLower === lower && x.passwordHash === hash
    );
    if (!u) return { ok: false, msg: "帳號或密碼錯誤" };
    setSession({ type: "user", userId: u.id, username: u.username });
    return { ok: true };
  }

  function enterGuest() {
    setSession({
      type: "guest",
      guestId: "browser_guest",
      username: "訪客",
    });
  }

  function logout() {
    clearSession();
  }

  function getStatsKey() {
    const s = getSession();
    if (!s) return "anon";
    if (s.type === "user") return "u_" + s.userId;
    if (s.type === "guest") return "g_" + (s.guestId || "local");
    return "anon";
  }

  function getDisplayName() {
    const s = getSession();
    if (!s) return "未登入";
    if (s.type === "guest") return "訪客";
    return s.username || "玩家";
  }

  /** @returns {'none'|'guest'|'user'} */
  function getSessionMode() {
    const s = getSession();
    if (!s) return "none";
    return s.type === "user" ? "user" : "guest";
  }

  window.ArcadeAuth = {
    getSession,
    register,
    login,
    enterGuest,
    logout,
    getStatsKey,
    getDisplayName,
    getSessionMode,
  };

  window.getArcadeStatsKey = getStatsKey;
  window.getArcadeDisplayName = getDisplayName;
  window.getArcadeSessionMode = getSessionMode;
})();
