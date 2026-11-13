/* /donate/campaign — the Victorian state campaign fund page's runtime state.
   The page is prerendered, so it asks the Worker (GET /api/campaign-fund) two things it
   cannot know at build time: is the campaign Stripe account wired on this environment,
   and what is the current per-donor cap (a /admin setting that changes on the day the
   party joins the VEC's new-entrant register). Both are UX only — the server enforces
   them again in src/lib/checkout-request.ts / checkout.ts. External file: VIC keeps a
   strict `script-src 'self'` CSP (no inline scripts). Loads BEFORE checkout-form.js,
   which reads the data-* it sets on the form. */
(function () {
  'use strict';
  var form = document.getElementById('donateForm');
  if (!form || !form.hasAttribute('data-fund')) return;

  var status = document.getElementById('donateStatus');
  var submit = document.getElementById('donateSubmit');
  var custom = document.getElementById('d-custom');
  var capEls = document.querySelectorAll('[data-fund-cap]');

  function fmt(cents) { return '$' + Math.round(cents / 100).toLocaleString('en-AU'); }

  function applyCap(capCents) {
    if (!(capCents > 0)) return;
    form.setAttribute('data-cap-cents', String(capCents));
    // Presets above the cap cannot be chosen; the custom field is bounded.
    form.querySelectorAll('input[name="amount_preset"]').forEach(function (r) {
      var over = Number(r.value) * 100 > capCents;
      r.disabled = over;
      var label = form.querySelector('label[for="' + r.id + '"]');
      if (label) label.classList.toggle('is-disabled', over);
      if (over && r.checked) r.checked = false;
    });
    if (custom) custom.max = String(Math.floor(capCents / 100));
    capEls.forEach(function (el) { el.textContent = fmt(capCents); });
  }

  function notOpen() {
    form.setAttribute('data-fund-open', 'false');
    if (submit) submit.disabled = true;
    if (status) {
      status.textContent = 'Campaign donations are not open yet — please check back soon.';
      status.className = 'form-status is-error';
      status.style.display = 'block';
    }
  }

  fetch('/api/campaign-fund', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || d.configured !== true) { notOpen(); return; }
      form.setAttribute('data-fund-open', 'true');
      applyCap(Number(d.capCents));
    })
    .catch(function () { notOpen(); });
})();
