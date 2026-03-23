(function () {
  "use strict";

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function paintUserBar() {
    const bar = document.getElementById("user-bar");
    if (!bar) return;

    const name =
      typeof window.getArcadeDisplayName === "function"
        ? window.getArcadeDisplayName()
        : "—";
    const mode =
      typeof window.getArcadeSessionMode === "function"
        ? window.getArcadeSessionMode()
        : "none";

    const next = encodeURIComponent(
      location.pathname.split("/").pop() || "index.html"
    );
    const loginHref =
      mode === "none"
        ? "login.html?next=" + next
        : "login.html?next=" + next;

    const badgeClass =
      mode === "user"
        ? "user-bar__badge user-bar__badge--user"
        : mode === "guest"
          ? "user-bar__badge user-bar__badge--guest"
          : "user-bar__badge user-bar__badge--anon";

    const badgeText =
      mode === "user" ? "會員" : mode === "guest" ? "訪客" : "未登入";

    bar.innerHTML =
      '<span class="' +
      badgeClass +
      '">' +
      escapeHtml(badgeText) +
      "</span>" +
      '<span class="user-bar__name">' +
      escapeHtml(name) +
      "</span>" +
      '<span class="user-bar__actions">' +
      '<a href="' +
      loginHref +
      '" class="user-bar__link">' +
      (mode === "none" ? "登入／註冊" : "切換帳號") +
      "</a>";

    if (mode !== "none") {
      bar.innerHTML +=
        '<button type="button" class="user-bar__btn" id="user-bar-logout">登出</button>';
    }

    bar.innerHTML += "</span>";

    const lo = document.getElementById("user-bar-logout");
    if (lo && window.ArcadeAuth) {
      lo.addEventListener("click", function () {
        window.ArcadeAuth.logout();
        location.reload();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paintUserBar);
  } else {
    paintUserBar();
  }
})();
