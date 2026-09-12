/* Join form — live completion tracker (top-left panel) + incomplete-field markers.
   Progressive enhancement: the panel starts hidden and is only revealed once this
   script runs, so no-JS visitors never see a broken widget. Counts ONLY required
   fields, grouped by section (fieldset legend). Submission stays owned by
   checkout-form.js; this file only reads state and updates the UI. */
(function () {
  'use strict';

  var form = document.getElementById('joinForm');
  var panel = document.getElementById('joinProgress');
  if (!form || !panel) return;

  var ring = document.getElementById('fpRing');
  var pctEl = document.getElementById('fpPct');
  var doneEl = document.getElementById('fpDone');
  var totalEl = document.getElementById('fpTotal');
  var secList = document.getElementById('fpSections');

  var HONEYPOT = 'website';

  // ---- Build the (static) model of required controls, deduped by radio group.
  function requiredControls() {
    var seen = {};
    var list = [];
    form.querySelectorAll('[required]').forEach(function (el) {
      if (el.name === HONEYPOT) return;
      if (el.type === 'radio') {
        if (seen[el.name]) return;
        seen[el.name] = true;
      }
      list.push(el);
    });
    return list;
  }

  function sectionName(el) {
    var fs = el.closest('fieldset');
    var lg = fs && fs.querySelector('legend');
    return lg ? lg.textContent.trim() : 'Details';
  }

  function isAnswered(el) {
    if (el.type === 'radio') {
      return !!form.querySelector('input[name="' + el.name + '"]:checked');
    }
    if (el.type === 'checkbox') return el.checked;
    if (el.tagName === 'SELECT') return el.value.trim() !== '';
    return el.value.trim() !== '' && el.checkValidity();
  }

  var controls = requiredControls();
  if (controls.length === 0) return;

  // Group controls into sections in DOM order.
  var sections = [];
  var byName = {};
  controls.forEach(function (el) {
    var name = sectionName(el);
    if (!byName[name]) {
      byName[name] = { name: name, ctrls: [] };
      sections.push(byName[name]);
    }
    byName[name].ctrls.push(el);
  });

  // ---- Render section rows once; counts update live.
  sections.forEach(function (sec) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fp-sec';
    btn.dataset.done = 'false';
    btn.innerHTML = '<span class="fp-sec-name"></span><span class="fp-sec-count"></span>';
    btn.querySelector('.fp-sec-name').textContent = sec.name;
    btn.addEventListener('click', function () { jumpTo(sec); });
    li.appendChild(btn);
    secList.appendChild(li);
    sec.btn = btn;
    sec.countEl = btn.querySelector('.fp-sec-count');
  });

  function jumpTo(sec) {
    var target = null;
    for (var i = 0; i < sec.ctrls.length; i++) {
      if (!isAnswered(sec.ctrls[i])) { target = sec.ctrls[i]; break; }
    }
    if (!target) {
      var fs = sec.ctrls[0].closest('fieldset');
      if (fs) fs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var field = target.closest('.field') || target.closest('fieldset') || target;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  // ---- Live update.
  function update() {
    var doneTotal = 0;
    sections.forEach(function (sec) {
      var done = 0;
      sec.ctrls.forEach(function (el) {
        var ok = isAnswered(el);
        if (ok) done++;
        var field = el.closest('.field');
        if (!field) return;
        if (field.classList.contains('is-invalid')) {
          // A red submit-error owns the field; clear it once fixed.
          field.classList.remove('is-incomplete');
          if (ok) field.classList.remove('is-invalid');
        } else {
          field.classList.toggle('is-incomplete', !ok);
        }
      });
      doneTotal += done;
      sec.btn.dataset.done = done === sec.ctrls.length ? 'true' : 'false';
      sec.countEl.textContent = done + '/' + sec.ctrls.length;
    });

    var total = controls.length;
    var pct = total ? Math.round((doneTotal / total) * 100) : 0;
    if (ring) ring.style.setProperty('--p', String(pct));
    pctEl.textContent = String(pct);
    doneEl.textContent = String(doneTotal);
    totalEl.textContent = String(total);
    panel.classList.toggle('is-complete', doneTotal === total);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  // Reveal rules. On desktop the floating pop-up shows straight away. On mobile
  // it stays hidden until the member chooses a tier, then follows them down the
  // page (a click in the tier picker fires even if the checked option is
  // unchanged, so it catches every selection).
  var desktop = window.matchMedia('(min-width: 1080px)');
  var reveal = function () { panel.hidden = false; };
  if (desktop.matches) reveal();
  form.querySelectorAll('input[name="tier"]').forEach(function (r) {
    r.addEventListener('change', reveal);
  });
  var tierPicker = form.querySelector('.tier-choices');
  if (tierPicker) tierPicker.addEventListener('click', reveal);
  if (desktop.addEventListener) {
    desktop.addEventListener('change', function (e) { if (e.matches) reveal(); });
  }
})();
