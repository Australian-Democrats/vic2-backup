/* Volunteer sign-up → POST /api/volunteer (validated server-side, pushed to
   the party's CRM). Same patterns as checkout-form.js. */
(function () {
  'use strict';

  var form = document.getElementById('volunteerForm');
  if (!form) return;
  var status = document.getElementById('volunteerStatus');
  var submit = document.getElementById('volunteerSubmit');

  function setStatus(msg, kind) {
    status.textContent = msg || '';
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setStatus('', null);
    if (form.querySelector('input[name="website"]').value) return; // honeypot

    var ok = true, first = null;
    form.querySelectorAll('[required]').forEach(function (input) {
      var valid = input.checkValidity();
      var wrap = input.closest('.field');
      if (wrap) wrap.classList.toggle('is-invalid', !valid);
      if (!valid && !first) first = input;
      ok = ok && valid;
    });
    if (!ok) {
      if (first) first.focus();
      setStatus('Please fix the highlighted fields and try again.', 'error');
      return;
    }

    var fields = {};
    new FormData(form).forEach(function (v, k) {
      if (k !== 'website') fields[k] = String(v);
    });

    submit.disabled = true;
    setStatus('Sending your details…', 'busy');
    try {
      var res = await fetch('/api/volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Your details could not be sent.');
      form.reset();
      setStatus("You're on the list — a real person will be in touch soon. Thank you!", 'busy');
    } catch (err) {
      setStatus((err && err.message) || 'Something went wrong. Please try again.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
})();
