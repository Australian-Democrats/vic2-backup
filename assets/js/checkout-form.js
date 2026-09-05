/* Join & Donate → the `checkout` Astro Action (via the window.adCheckout bridge
   wired in each page's scripts slot), falling back to POST /api/checkout.
   Paid flows redirect to Stripe hosted Checkout; the free Supporter tier is
   submitted directly (no payment) and lands on /thanks.
   Progressive enhancement with honeypot + light client checks;
   server-side validation in src/lib/checkout-request.ts is authoritative. */
(function () {
  'use strict';

  // Turnstile token bridge — turnstile-init.js calls these on solve/expire; the token
  // is sent with the checkout POST and verified server-side (src/lib/checkout.ts).
  window.__turnstileToken = window.__turnstileToken || '';
  window.adTurnstileOk = function (t) { window.__turnstileToken = t || ''; };
  window.adTurnstileReset = function () { window.__turnstileToken = ''; };
  // A widget is "configured" only once the runtime sitekey has been injected — until
  // then (or when Turnstile is unconfigured on this Worker) we don't block submission.
  function turnstileConfigured() {
    var w = document.querySelector('.cf-turnstile');
    return !!(w && w.getAttribute('data-sitekey'));
  }

  // Fundraising-drive attribution: a ?campaign= query param on the page URL rides
  // the checkout POST and is sanitised server-side into Stripe metadata.
  function qp(n) { try { return new URLSearchParams(location.search).get(n) || ''; } catch (e) { return ''; } }

  function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  function fieldWrap(input) { return input.closest('.field'); }

  function validateRequired(form) {
    var ok = true, first = null;
    form.querySelectorAll('[required]').forEach(function (input) {
      var valid = input.checkValidity();
      var wrap = fieldWrap(input);
      if (wrap) wrap.classList.toggle('is-invalid', !valid);
      if (!valid && !first) first = input;
      ok = ok && valid;
    });
    if (first) first.focus();
    return ok;
  }

  function collect(form) {
    var fields = {};
    new FormData(form).forEach(function (v, k) {
      if (k !== 'website') fields[k] = String(v);
    });
    return fields;
  }

  // Prefer the `checkout` Astro Action (window.adCheckout, wired in the page's
  // scripts slot — see src/pages/join.astro / donate.astro); fall back to the
  // legacy /api/checkout endpoint if the bridge has not loaded. Both doors hit
  // the same server-side handler (src/lib/checkout-request.ts) and resolve to
  // { ok, redirect?, free?, error? }.
  async function submitCheckout(payload) {
    if (window.adCheckout) {
      var out = await window.adCheckout(payload).catch(function () { return null; });
      return out || { ok: false, error: 'Something went wrong — please try again.' };
    }
    var res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, redirect: data.url, free: !!data.free };
  }

  // ---- Join ---------------------------------------------------------------
  var joinForm = document.getElementById('joinForm');
  if (joinForm) {
    var joinStatus = document.getElementById('joinStatus');
    var joinSubmit = document.getElementById('joinSubmit');

    // Tier/renewal sync, scrolling, the which-party reveal and the ?tier=
    // deep-link all live in join-enhance.js — this file only owns submission.

    joinForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setStatus(joinStatus, '', null);
      if (joinForm.querySelector('input[name="website"]').value) return; // honeypot
      if (!validateRequired(joinForm)) {
        setStatus(joinStatus, 'Please fix the highlighted fields and try again.', 'error');
        return;
      }
      if (turnstileConfigured() && !window.__turnstileToken) {
        setStatus(joinStatus, 'Please complete the verification challenge and try again.', 'error');
        return;
      }
      joinSubmit.disabled = true;
      setStatus(joinStatus, 'Submitting your membership application…', 'busy');
      try {
        var out = await submitCheckout({ kind: 'membership', fields: collect(joinForm), campaign: qp('campaign'), turnstileToken: window.__turnstileToken || '' });
        if (!out.ok) throw new Error(out.error || 'Your application could not be submitted.');
        if (out.free) { window.location.assign('/thanks?membership=supporter'); return; }
        if (!out.redirect) throw new Error('Checkout could not be started.');
        window.location.assign(out.redirect);
      } catch (err) {
        joinSubmit.disabled = false;
        setStatus(joinStatus, (err && err.message) || 'Something went wrong. Please try again.', 'error');
      }
    });
  }

  // ---- Donate -------------------------------------------------------------
  var donateForm = document.getElementById('donateForm');
  if (donateForm) {
    var donateStatus = document.getElementById('donateStatus');
    var donateSubmit = document.getElementById('donateSubmit');
    var custom = document.getElementById('d-custom');

    // typing a custom amount deselects presets; picking a preset clears custom
    if (custom) {
      custom.addEventListener('input', function () {
        if (custom.value) donateForm.querySelectorAll('input[name="amount_preset"]').forEach(function (r) { r.checked = false; });
      });
      donateForm.querySelectorAll('input[name="amount_preset"]').forEach(function (r) {
        r.addEventListener('change', function () { custom.value = ''; fieldWrap(custom).classList.remove('is-invalid'); });
      });
    }

    donateForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setStatus(donateStatus, '', null);
      if (donateForm.querySelector('input[name="website"]').value) return; // honeypot
      if (!validateRequired(donateForm)) {
        setStatus(donateStatus, 'Please fix the highlighted fields and try again.', 'error');
        return;
      }
      var preset = donateForm.querySelector('input[name="amount_preset"]:checked');
      var amount = custom && custom.value ? Number(custom.value) : (preset ? Number(preset.value) : NaN);
      if (!Number.isFinite(amount) || amount < 2) {
        fieldWrap(custom).classList.add('is-invalid');
        setStatus(donateStatus, 'Pick an amount or enter a custom amount of $2 or more.', 'error');
        return;
      }
      if (turnstileConfigured() && !window.__turnstileToken) {
        setStatus(donateStatus, 'Please complete the verification challenge and try again.', 'error');
        return;
      }

      donateSubmit.disabled = true;
      setStatus(donateStatus, 'Taking you to our secure payment page…', 'busy');
      try {
        var out = await submitCheckout({
          kind: 'donation',
          amount: Math.round(amount * 100),
          fields: collect(donateForm),
          campaign: qp('campaign'),
          turnstileToken: window.__turnstileToken || '',
        });
        if (!out.ok || !out.redirect) throw new Error(out.error || 'Checkout could not be started.');
        // "I would also like to join the party" → open the join form alongside checkout
        var alsoJoin = document.getElementById('d-also-join');
        if (alsoJoin && alsoJoin.checked) window.open('/join', '_blank', 'noopener');
        window.location.assign(out.redirect);
      } catch (err) {
        donateSubmit.disabled = false;
        setStatus(donateStatus, (err && err.message) || 'Something went wrong. Please try again.', 'error');
      }
    });
  }
})();

/* Donation impact display — examples are the party's own copy from the previous
   form; indicative only (disclaimer shown beneath the amounts). */
(function () {
  'use strict';
  var amountEl = document.getElementById('impactAmount');
  var textEl = document.getElementById('impactText');
  var form = document.getElementById('donateForm');
  if (!amountEl || !textEl || !form) return;
  var IMPACTS = [
    { min: 1, label: 'A campaign coffee for a hard-working volunteer.' },
    { min: 10, label: 'A pack of campaign flyers for a Saturday morning door-knock.' },
    { min: 25, label: 'A targeted social-media ad reaching around 1,000 Australians.' },
    { min: 50, label: '100 letterbox leaflets printed and posted in a key suburb.' },
    { min: 100, label: 'A focused social-media blitz in a marginal seat for a week.' },
    { min: 250, label: 'A community stall at a weekend market — bunting, brochures, the lot.' },
    { min: 500, label: 'A corflute campaign sign at a busy intersection for an entire campaign.' },
    { min: 1000, label: 'A week of digital advertising in a marginal electorate, all platforms.' },
    { min: 2500, label: 'A regional billboard seen by tens of thousands of commuters.' },
    { min: 5000, label: 'A statewide social-media push in the lead-up to an election.' }
  ];
  function impactFor(a) {
    var hit = IMPACTS[0];
    IMPACTS.forEach(function (i) { if (a >= i.min) hit = i; });
    return hit.label;
  }
  function fmt(a) { return '$' + a.toLocaleString('en-AU'); }
  function update() {
    var custom = document.getElementById('d-custom');
    var preset = form.querySelector('input[name="amount_preset"]:checked');
    var a = custom && custom.value ? Number(custom.value) : preset ? Number(preset.value) : NaN;
    if (!Number.isFinite(a) || a < 1) { amountEl.textContent = '$—'; textEl.textContent = 'Pick an amount to see what it could do.'; return; }
    amountEl.textContent = fmt(a);
    textEl.textContent = impactFor(a);
  }
  form.querySelectorAll('input[name="amount_preset"]').forEach(function (r) { r.addEventListener('change', update); });
  var c = document.getElementById('d-custom');
  if (c) c.addEventListener('input', update);
  update();
})();

/* Live correction bubbles — once a member leaves a required field invalid, its
   speech bubble shows straight away (not only on submit) and clears the moment
   the field is fixed. Radios/checkboxes stay calm until submit. */
(function () {
  'use strict';
  var form = document.getElementById('joinForm') || document.getElementById('donateForm');
  if (!form) return;
  form.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!el || !el.matches || !el.matches('[required]')) return;
    if (el.type === 'radio' || el.type === 'checkbox') return;
    var wrap = el.closest('.field');
    if (!wrap) return;
    var touched = (el.value || '').trim() !== '' || wrap.classList.contains('is-invalid');
    if (!el.checkValidity() && touched) wrap.classList.add('is-invalid');
  });
  form.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.matches || !el.matches('[required]')) return;
    var wrap = el.closest('.field');
    if (wrap && wrap.classList.contains('is-invalid') && el.checkValidity()) wrap.classList.remove('is-invalid');
  });
})();
