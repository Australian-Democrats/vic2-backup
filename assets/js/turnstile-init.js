/* Turnstile bootstrap — explicit render with a runtime-provided sitekey.
 *
 * The /join, /donate and homepage forms are static HTML, so the sitekey can't be
 * baked in server-side. Instead the Cloudflare api.js is loaded with
 * `?render=explicit&onload=onloadTurnstile`; when the library is ready it calls
 * window.onloadTurnstile (defined here), which fetches the environment's sitekey
 * from GET /api/turnstile and renders every `.cf-turnstile` widget on the page.
 *
 * Kept deliberately dumb: no sitekey lives in source. If the Worker has no
 * TURNSTILE_SITEKEY configured, the fetch returns an empty string, no widget
 * renders, and the forms stay usable — the server-side gate is likewise skipped
 * when unconfigured (except real production, which fails closed).
 *
 * Callbacks bridge to the globals the form scripts already define:
 *   window.adTurnstileOk(token)  — join.js / donate.js capture the token
 *   window.adTurnstileReset()    — clear it on expiry/error
 * The homepage forms (home.js) instead read the auto-created hidden
 * `cf-turnstile-response` input, which explicit render still populates.
 */
(function () {
  function renderAll(sitekey) {
    if (!sitekey || !window.turnstile || typeof window.turnstile.render !== 'function') return;
    var widgets = document.querySelectorAll('.cf-turnstile');
    for (var i = 0; i < widgets.length; i++) {
      var el = widgets[i];
      if (el.getAttribute('data-rendered')) continue;
      el.setAttribute('data-sitekey', sitekey);
      try {
        window.turnstile.render(el, {
          sitekey: sitekey,
          action: el.getAttribute('data-action') || undefined,
          theme: el.getAttribute('data-theme') || 'light',
          callback: function (token) {
            if (typeof window.adTurnstileOk === 'function') window.adTurnstileOk(token);
          },
          'expired-callback': function () {
            if (typeof window.adTurnstileReset === 'function') window.adTurnstileReset();
          },
          'error-callback': function () {
            if (typeof window.adTurnstileReset === 'function') window.adTurnstileReset();
          },
        });
        el.setAttribute('data-rendered', '1');
      } catch (e) {
        /* leave inert on render failure — form stays usable */
      }
    }
  }

  window.onloadTurnstile = function () {
    fetch('/api/turnstile', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { renderAll(d && d.sitekey); })
      .catch(function () { /* network hiccup — widget stays inert, server still gates */ });
  };

  // If the library somehow loaded before this script (cached), kick off now.
  if (window.turnstile && typeof window.turnstile.render === 'function') {
    window.onloadTurnstile();
  }
})();
