(function () {
  if (document.querySelector("a.showcase-home-btn")) return;

  var scr = document.currentScript;
  if (!scr || !scr.src) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i];
      if (s.src && /\/showcase\/assets\/showcase-home\.js(\?|#|$)/.test(s.src)) {
        scr = s;
        break;
      }
    }
  }
  if (!scr || !scr.src) return;

  var cssHref = new URL("showcase-home.css", scr.src).href;
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = cssHref;
  document.head.appendChild(link);

  var homeHref = new URL("../index.html", scr.src).href;

  var a = document.createElement("a");
  a.className = "showcase-home-btn";
  a.href = homeHref;
  a.setAttribute("aria-label", "返回作品展示主頁");
  a.textContent = "← 作品展示";
  document.body.appendChild(a);
})();
