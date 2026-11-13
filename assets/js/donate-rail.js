/* /donate + /donate/campaign — the section index in the rail beside the form.
   Built from the form's own <legend>s (the same five words the numbered pills
   carry), so it adds no copy; clicking one scrolls that section into view and
   the current section is marked as the reader moves through the form.
   Read-only over the form: it never touches a field, a value or a testid.
   CSP-safe (script-src 'self'): no libraries, no inline handlers. The rail is
   display:none below 1000px, so on a phone this does nothing visible. */
(function () {
  'use strict';
  var nav = document.getElementById('donateIndex');
  var form = document.getElementById('donateForm');
  if (!nav || !form) return;
  var sets = Array.prototype.slice.call(form.querySelectorAll('fieldset'));
  if (!sets.length) return;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var list = document.createElement('ol');
  list.className = 'donate-index-list';
  var buttons = sets.map(function (fs, i) {
    var legend = fs.querySelector('legend');
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'donate-index-btn';
    var num = document.createElement('span');
    num.className = 'donate-index-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
    var label = document.createElement('span');
    label.className = 'donate-index-label';
    label.textContent = legend ? legend.textContent.trim() : 'Section ' + (i + 1);
    btn.appendChild(num);
    btn.appendChild(label);
    btn.addEventListener('click', function () {
      try { fs.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } catch (e) { fs.scrollIntoView(); }
      setCurrent(i);
    });
    li.appendChild(btn);
    list.appendChild(li);
    return btn;
  });
  nav.appendChild(list);
  nav.hidden = false;

  function setCurrent(i) {
    buttons.forEach(function (b, k) {
      if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }
  setCurrent(0);

  // The current section is the one crossing a band a third of the way down the
  // viewport. Observed, not measured on scroll, so it costs nothing per frame.
  if ('IntersectionObserver' in window) {
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[sets.indexOf(en.target)] = en.isIntersecting; });
      for (var i = 0; i < sets.length; i++) { if (visible[i]) { setCurrent(i); return; } }
    }, { rootMargin: '-28% 0px -60% 0px', threshold: 0 });
    sets.forEach(function (fs) { io.observe(fs); });
  }
})();
