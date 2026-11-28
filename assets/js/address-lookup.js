/* Address autocomplete for the /join and /donate forms, over the Worker proxy at
   GET /api/address-lookup (Geoscape Predictive API; the key never reaches the
   browser — see src/lib/address-lookup.ts for the spend cap and alerts).

   Progressive enhancement over the existing manual fields: each `.addr-search`
   block names its target inputs in data-addr-* attributes. On load the block is
   shown and the target fields are collapsed; picking a suggestion fills them and
   reveals them for checking/editing, and "enter it manually" reveals them as-is.
   If the proxy reports it is not armed (no key), capped, or failing, the block
   steps aside and the plain fields are exactly what they were before. Without JS
   the block stays `hidden` and nothing changes at all.

   The lookup input has no `name`, so it is never part of the submitted field set
   (CLAUDE.md: the field set mirrors the approved form 1:1), and no `required`, so
   join-progress.js never counts it. Every programmatic fill dispatches `input` +
   `change` so join-progress.js and checkout-form.js react exactly as to typing.
   Ported from the national site (public/assets/js/address-lookup.js), adapted to
   VIC's `.field` wrappers and single-input postcode. */
(function () {
  'use strict';
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.addr-search[data-addr-line1]'));
  if (!blocks.length) return;
  var ENDPOINT = '/api/address-lookup', MIN = 4, MAX = 50, DEBOUNCE = 250; // Geoscape: 4–50 character query
  var MSG_UNAVAILABLE = 'Address lookup isn’t available right now — please enter your address below.';

  function byId(id) { return id ? document.getElementById(id) : null; }
  function fire(el, type) { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch (e) { /* ignore */ } }
  function setValue(el, v) { if (!el) return; el.value = (v == null ? '' : String(v)); fire(el, 'input'); fire(el, 'change'); }
  function setState(sel, v) {
    if (!sel) return;
    var want = (v || '').toUpperCase(), hit = '';
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.value.toUpperCase() === want || o.text.trim().toUpperCase() === want) { hit = o.value; break; }
    }
    sel.value = hit; fire(sel, 'input'); fire(sel, 'change');
  }

  // One availability probe per page (an empty query never reaches Geoscape).
  var probe = null;
  function available() {
    if (!probe) {
      probe = fetch(ENDPOINT + '?q=', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) { return !!(j && j.ok && j.available); })
        .catch(function () { return false; });
    }
    return probe;
  }

  function setup(block) {
    var input = block.querySelector('input[role="combobox"]'), list = block.querySelector('.addr-results'),
        manual = block.querySelector('[data-addr-manual]'), help = block.querySelector('[data-addr-help]');
    if (!input || !list || !manual || !help) return;
    var f = {
      line1: byId(block.getAttribute('data-addr-line1')), line2: byId(block.getAttribute('data-addr-line2')),
      city: byId(block.getAttribute('data-addr-city')), postcode: byId(block.getAttribute('data-addr-postcode')),
      state: byId(block.getAttribute('data-addr-state')), extra: byId(block.getAttribute('data-addr-extra'))
    };
    var wraps = [];
    Object.keys(f).forEach(function (k) { var w = f[k] && f[k].closest('.field'); if (w && wraps.indexOf(w) < 0) wraps.push(w); });
    var items = [], active = -1, timer = null, ctrl = null;

    function collapse() { wraps.forEach(function (w) { w.classList.add('addr-collapsed'); }); }
    function reveal() { wraps.forEach(function (w) { w.classList.remove('addr-collapsed'); }); manual.hidden = true; }
    function close() { list.hidden = true; list.innerHTML = ''; items = []; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function offline(hideBlock) {
      block.setAttribute('data-addr-state', 'manual'); close(); input.disabled = true; reveal();
      if (hideBlock) block.hidden = true; else help.textContent = MSG_UNAVAILABLE;
    }
    function setActive(i) {
      active = i;
      var lis = list.querySelectorAll('[role="option"]');
      for (var k = 0; k < lis.length; k++) { var on = (k === i); lis[k].classList.toggle('is-active', on); lis[k].setAttribute('aria-selected', on ? 'true' : 'false'); }
      if (i >= 0 && lis[i]) { input.setAttribute('aria-activedescendant', lis[i].id); if (lis[i].scrollIntoView) lis[i].scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      list.innerHTML = '';
      if (!items.length) {
        var e = document.createElement('li'); e.className = 'addr-empty'; e.setAttribute('role', 'presentation');
        e.textContent = 'No matching address found — you can enter it manually below.'; list.appendChild(e);
      }
      items.forEach(function (it, i) {
        var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = list.id + '-' + i; li.setAttribute('aria-selected', 'false');
        li.textContent = it.label;
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); }); // keep focus in the input so blur doesn't close first
        li.addEventListener('click', function () { choose(i); });
        list.appendChild(li);
      });
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); setActive(-1);
    }
    function choose(i) {
      var it = items[i]; if (!it) return;
      setValue(f.line1, it.line1 || it.label); setValue(f.line2, ''); setValue(f.city, it.city || '');
      setValue(f.postcode, (it.postcode || '').replace(/\D/g, '').slice(0, 4)); setState(f.state, it.state || '');
      input.value = it.label; close(); reveal();
      if (it.city && it.postcode && it.state) { help.textContent = 'Address filled in below — check it and edit anything that isn’t right.'; }
      else { help.textContent = 'We couldn’t split that address into its parts — please check the fields below.'; if (f.city) { try { f.city.focus(); } catch (e) { /* ignore */ } } }
    }
    function search(q) {
      if (ctrl) { try { ctrl.abort(); } catch (e) { /* ignore */ } }
      ctrl = window.AbortController ? new AbortController() : null;
      var mine = ctrl;
      fetch(ENDPOINT + '?q=' + encodeURIComponent(q), { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: mine ? mine.signal : undefined })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (mine !== ctrl) return; // superseded by a newer keystroke
          if (!j || !j.ok || !j.available) { offline(false); return; }
          if (j.throttled) { close(); return; } // upstream rate limit: no answer for this keystroke, lookup stays on
          if (input.value.replace(/\s+/g, ' ').trim().slice(0, MAX) !== q) return;
          items = Array.isArray(j.results) ? j.results.filter(function (x) { return x && typeof x.label === 'string' && x.label; }) : [];
          render();
        })
        .catch(function (e) { if (e && e.name === 'AbortError') return; close(); });
    }

    input.addEventListener('input', function () {
      var q = input.value.replace(/\s+/g, ' ').trim().slice(0, MAX);
      clearTimeout(timer);
      if (q.length < MIN) { close(); return; }
      timer = setTimeout(function () { search(q); }, DEBOUNCE);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); if (!list.hidden && items.length) choose(active >= 0 ? active : 0); return; } // a search box never submits the form
      if (list.hidden) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (items.length) setActive((active + 1) % items.length); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (items.length) setActive((active - 1 + items.length) % items.length); }
      else if (ev.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    manual.addEventListener('click', function () { reveal(); help.textContent = 'Enter your address below.'; if (f.line1) { try { f.line1.focus(); } catch (e) { /* ignore */ } } });

    block.hidden = false; block.setAttribute('data-addr-state', 'pending'); collapse();
    available().then(function (ok) { if (ok) block.setAttribute('data-addr-state', 'lookup'); else offline(true); });
  }

  blocks.forEach(setup);
})();
