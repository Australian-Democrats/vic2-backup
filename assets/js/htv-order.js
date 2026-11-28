/* How to Vote — "choose your own order" (client-side, per-session personalisation).
   The visitor edits the number badges on the card directly: tap a number, type a new
   one, and the whole list auto-resequences to a gapless 1…N. Plus one-tap
   "easy preference" head-to-heads. Nothing is saved server-side; the recommended
   card is untouched. Progressive enhancement — with no JS the recommendation stands. */
(function () {
  'use strict';

  var dataEl = document.getElementById('htvCardData');
  var region = document.getElementById('htvCardRegion');
  var startBtn = document.getElementById('htvCustomStart');
  var editBar = document.getElementById('htvEditBar');
  if (!dataEl || !region || !startBtn || !editBar) return;

  var CFG = {};
  try { CFG = JSON.parse(dataEl.textContent || '{}'); } catch (e) { return; }
  if (CFG.enableCustom === false) { startBtn.hidden = true; return; }

  var resetBtn = document.getElementById('htvResetOrder');
  var doneBtn = document.getElementById('htvDoneOrder');
  var easyEl = document.getElementById('htvEasy');
  var lcBallot = document.getElementById('lcBallot');
  var editing = false;

  function num(box) { return parseInt((box.textContent || '').replace(/\D/g, ''), 10) || 0; }
  function party(box) { return box.getAttribute('data-party') || ''; }

  // ---- Build the editable scopes (single ballot / above-line / below-line). ----
  var scopes = [];
  region.querySelectorAll('[data-order-scope]').forEach(function (el) {
    var boxes = [].slice.call(el.querySelectorAll('.js-obox')).filter(function (b) {
      return (b.textContent || '').trim() !== '';
    });
    if (boxes.length < 2) return;
    var order = boxes.slice().sort(function (a, b) { return num(a) - num(b); });
    scopes.push({ el: el, name: el.getAttribute('data-order-scope'), order: order, original: order.slice(), boxes: boxes });
  });
  if (!scopes.length) { startBtn.hidden = true; return; }

  // ---- Re-sequencing core. ----
  // The owner's box is the "1" — it is always pinned to first and can never be
  // renumbered by the visitor (the Democrat candidate always holds preference 1).
  function ownerBox(scope) {
    for (var i = 0; i < scope.order.length; i++) {
      if (scope.order[i].hasAttribute('data-owner-box')) return scope.order[i];
    }
    return null;
  }
  function pinOwner(scope) {
    var ob = ownerBox(scope);
    if (!ob) return;
    var idx = scope.order.indexOf(ob);
    if (idx > 0) scope.order.unshift(scope.order.splice(idx, 1)[0]);
  }
  function renumber(scope) {
    scope.order.forEach(function (b, i) {
      b.textContent = String(i + 1);
      if (scope.name === 'btl') {
        var li = b.closest('.lc-cand');
        if (li) li.classList.toggle('is-min', i + 1 <= (CFG.btlMin || 0));
      }
    });
  }
  // Reinsert-then-renumber: the item at `old` moves to `newRank`, list stays gapless 1…N.
  function setRank(scope, box, newRank) {
    var n = scope.order.length;
    newRank = Math.max(1, Math.min(n, newRank));
    var old = scope.order.indexOf(box);
    if (old === -1 || old === newRank - 1) return renumber(scope);
    scope.order.splice(old, 1);
    scope.order.splice(newRank - 1, 0, box);
    pinOwner(scope);
    renumber(scope);
  }
  // Easy preference: guarantee every A sits ahead of every B, others keep relative order.
  function prefer(scope, aSlug, bSlug) {
    var lastA = -1, firstB = scope.order.length;
    scope.order.forEach(function (b, i) {
      if (party(b) === aSlug) lastA = i;
      if (party(b) === bSlug && i < firstB) firstB = i;
    });
    if (lastA === -1 || firstB === scope.order.length || lastA < firstB) return;
    var aBoxes = scope.order.filter(function (b) { return party(b) === aSlug; });
    scope.order = scope.order.filter(function (b) { return party(b) !== aSlug; });
    var at = scope.order.length;
    for (var i = 0; i < scope.order.length; i++) { if (party(scope.order[i]) === bSlug) { at = i; break; } }
    scope.order.splice.apply(scope.order, [at, 0].concat(aBoxes));
    pinOwner(scope);
    renumber(scope);
  }
  function preferAll(aSlug, bSlug) { scopes.forEach(function (s) { prefer(s, aSlug, bSlug); }); }

  // ---- Box editing. ----
  function commit(scope, box) {
    var raw = (box.textContent || '').replace(/\D/g, '');
    if (!raw) return renumber(scope); // empty/invalid → revert
    setRank(scope, box, parseInt(raw, 10));
  }
  function selectAll(box) {
    try {
      var r = document.createRange(); r.selectNodeContents(box);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) { /* ignore */ }
  }
  scopes.forEach(function (scope) {
    scope.boxes.forEach(function (box) {
      box.addEventListener('keydown', function (e) {
        if (!editing) return;
        if (e.key === 'Enter') { e.preventDefault(); box.blur(); return; }
        if (e.key === 'Escape') { e.preventDefault(); renumber(scope); box.blur(); return; }
        if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
      });
      box.addEventListener('blur', function () { if (editing) commit(scope, box); });
      box.addEventListener('focus', function () { if (editing) selectAll(box); });
    });
  });

  // ---- Easy-preference buttons. ----
  function mkBtn(text, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'htv-easy-btn'; b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function buildEasy() {
    if (!easyEl || easyEl.childNodes.length) return;
    if (!CFG.pairs || !CFG.pairs.length) return;
    var label = document.createElement('span');
    label.className = 'htv-easy-label'; label.textContent = 'One tap:';
    easyEl.appendChild(label);
    CFG.pairs.forEach(function (pr) {
      easyEl.appendChild(mkBtn(pr.aName + ' over ' + pr.bName, function () { preferAll(pr.aSlug, pr.bSlug); }));
      easyEl.appendChild(mkBtn(pr.bName + ' over ' + pr.aName, function () { preferAll(pr.bSlug, pr.aSlug); }));
    });
  }

  // ---- Edit-mode toggle. ----
  function setLcView(v) {
    if (!lcBallot) return;
    lcBallot.setAttribute('data-view', v);
    document.querySelectorAll('.lc-toggle-btn').forEach(function (b) {
      var on = b.getAttribute('data-view') === v;
      b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
    });
  }
  function setEditable(on) {
    scopes.forEach(function (scope) {
      scope.boxes.forEach(function (box) {
        if (box.hasAttribute('data-owner-box')) return; // the "1" is locked
        if (on) {
          box.setAttribute('contenteditable', 'true');
          box.setAttribute('role', 'spinbutton');
          box.setAttribute('tabindex', '0');
        } else {
          box.removeAttribute('contenteditable');
          box.removeAttribute('role');
          box.removeAttribute('tabindex');
        }
      });
    });
  }
  function enter() {
    editing = true;
    region.classList.add('htv-editing');
    editBar.hidden = false;
    startBtn.hidden = true;
    if (CFG.isGvt) setLcView('btl'); // GVT: above the line is a single "1" — personalise below the line
    setEditable(true);
    buildEasy();
    document.dispatchEvent(new Event('htv:recentre'));
    editBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Focus the first box the visitor can actually change (never the locked "1").
    var first = null;
    if (scopes[0]) { for (var i = 0; i < scopes[0].order.length; i++) { if (!scopes[0].order[i].hasAttribute('data-owner-box')) { first = scopes[0].order[i]; break; } } }
    if (first) first.focus();
  }
  function exit() {
    editing = false;
    region.classList.remove('htv-editing');
    editBar.hidden = true;
    startBtn.hidden = false;
    setEditable(false);
    startBtn.focus();
  }
  function reset() {
    scopes.forEach(function (scope) { scope.order = scope.original.slice(); renumber(scope); });
  }

  startBtn.addEventListener('click', enter);
  if (doneBtn) doneBtn.addEventListener('click', exit);
  if (resetBtn) resetBtn.addEventListener('click', reset);
})();
