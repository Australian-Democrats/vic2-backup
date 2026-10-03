/* Form UX enhancements (join): free-flow date-of-birth typing and precise
   No/Yes toggle pills. CSP-safe, no libraries; the field contract (names,
   values, required flags) is untouched — this only improves input ergonomics. */
(function () {
  'use strict';

  // ---- Date of birth: type digits continuously, we insert the slashes. -----
  // The input is plain text (name/id unchanged); the server only needs a
  // non-empty value, and the pattern + custom validity keep it a real date.
  var dob = document.getElementById('j-dob');
  if (dob) {
    var prev = dob.value;
    var format = function (e) {
      var raw = dob.value;
      // Backspacing over a slash should also eat the digit before it,
      // otherwise reformatting immediately puts the slash back.
      if (e && e.inputType === 'deleteContentBackward' &&
          prev.length - raw.length === 1 && prev.charAt(raw.length) === '/') {
        raw = raw.slice(0, -1);
      }
      var d = raw.replace(/\D/g, '').slice(0, 8);
      var out = d;
      if (d.length > 4) out = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
      else if (d.length > 2) out = d.slice(0, 2) + '/' + d.slice(2);
      dob.value = out;
      prev = out;

      if (d.length === 8) {
        var day = +d.slice(0, 2), mon = +d.slice(2, 4), yr = +d.slice(4);
        var dt = new Date(yr, mon - 1, day);
        var real = dt.getFullYear() === yr && dt.getMonth() === mon - 1 && dt.getDate() === day;
        // Same age rule as the original date field (max 2010-12-31).
        dob.setCustomValidity(real && yr >= 1900 && yr <= 2010 ? '' : 'Enter a real date of birth (DD/MM/YYYY).');
      } else {
        dob.setCustomValidity('');
      }
    };
    dob.addEventListener('input', format);
    format();
  }

  // ---- No/Yes toggles: make each pill select its own state precisely. ------
  document.querySelectorAll('.tog').forEach(function (tog) {
    var box = tog.querySelector('input[type="checkbox"]');
    var no = tog.querySelector('.tog-opt--no');
    var yes = tog.querySelector('.tog-opt--yes');
    if (!box || !no || !yes) return;
    var set = function (v, e) {
      e.preventDefault(); // stop the wrapping label's default toggle
      if (box.checked !== v) {
        box.checked = v;
        box.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try { box.focus({ preventScroll: true }); } catch (err) {}
    };
    no.addEventListener('click', function (e) { set(false, e); });
    yes.addEventListener('click', function (e) { set(true, e); });
  });
})();
