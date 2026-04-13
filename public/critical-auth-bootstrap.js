/* Render login/register skeleton before React loads. */
(function () {
  try {
    var path = window.location && window.location.pathname ? window.location.pathname : "";
    if (!/\/merchant\/(login|register)\/?$/.test(path)) return;
    var root = document.getElementById("root");
    if (!root) return;
    root.innerHTML =
      '<div class="auth-shell" data-auth-shell>' +
        '<div class="auth-shell__card" role="presentation">' +
          '<div class="auth-shell__logo"></div>' +
          '<div class="auth-shell__title"></div>' +
          '<div class="auth-shell__tabs">' +
            '<div class="auth-shell__tab"></div>' +
            '<div class="auth-shell__tab"></div>' +
          '</div>' +
          '<div class="auth-shell__field"></div>' +
          '<div class="auth-shell__row">' +
            '<div class="auth-shell__field"></div>' +
            '<div class="auth-shell__field"></div>' +
          '</div>' +
          '<div class="auth-shell__cta"></div>' +
        '</div>' +
      '</div>';
  } catch (e) {
    // no-op
  }
})();

/* Render critical auth skeleton + route-aware preloads before React. */
(function () {
  var currentScript = document.currentScript;
  var base = (currentScript && currentScript.dataset && currentScript.dataset.base) || "/merchant/";
  var path = window.location.pathname || "";

  function addPreload(href, media) {
    var l = document.createElement("link");
    l.rel = "preload";
    l.as = "image";
    l.href = base + href;
    l.fetchPriority = "high";
    if (media) l.media = media;
    document.head.appendChild(l);
  }

  // Route-aware image preloads (avoid wasting bandwidth on routes that don't use them).
  if (path === base || path === base.slice(0, -1) || path === "/merchant" || path === "/merchant/") {
    addPreload("banner-desktop.webp", "(min-width: 1025px)");
    addPreload("banner-tablet.webp", "(min-width: 601px) and (max-width: 1024px)");
    addPreload("banner-phone.webp", "(max-width: 600px)");
  }
  if (path.endsWith("/merchant/login") || path.endsWith("/merchant/register")) {
    addPreload("loginbg.webp", "(min-width: 769px)");
    /* Mobile LCP is usually the brand logo — load in parallel with JS. */
    addPreload("logo-bestbbybites-merchant-dark-removebg-preview.png");
  }

  // Critical auth skeleton to avoid blank screen before React.
  if (path.endsWith("/merchant/login") || path.endsWith("/merchant/register")) {
    var root = document.getElementById("root");
    if (!root) return;
    var isRegister = path.endsWith("/merchant/register");
    var title = isRegister ? "Sign Up" : "Log In";
    var font = "font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;";
    root.innerHTML =
      '<div role="presentation" style="' + font + 'min-height:100vh;min-height:100dvh;display:flex;align-items:flex-start;justify-content:flex-start;background:#fff;">' +
        '<div style="width:100%;box-sizing:border-box;padding:16px 20px 20px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
            '<div aria-hidden="true" style="width:36px;height:36px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;"></div>' +
          '</div>' +
          '<div aria-hidden="true" style="margin:10px auto 8px;width:150px;height:150px;border-radius:16px;background:#f3f4f6;"></div>' +
          '<div aria-hidden="true" style="margin:8px auto 10px;height:26px;width:62%;border-radius:999px;background:#e5e7eb;"></div>' +
          '<div aria-hidden="true" style="margin:0 auto 18px;height:14px;width:78%;border-radius:999px;background:#eef2f7;"></div>' +
          '<div aria-hidden="true" style="display:grid;grid-template-columns:1fr;gap:10px;">' +
            '<div style="height:44px;border-radius:12px;background:#f3f4f6;"></div>' +
            (isRegister
              ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
                  '<div style="height:44px;border-radius:12px;background:#f3f4f6;"></div>' +
                  '<div style="height:44px;border-radius:12px;background:#f3f4f6;"></div>' +
                '</div>'
              : '') +
            '<div style="margin-top:12px;height:46px;border-radius:999px;background:#05c65d;"></div>' +
          '</div>' +
          '<div aria-hidden="true" style="margin:14px auto 0;height:12px;width:70%;border-radius:999px;background:#eef2f7;"></div>' +
        '</div>' +
      '</div>';
    root.setAttribute("data-auth-skeleton", title);
  }
})();

