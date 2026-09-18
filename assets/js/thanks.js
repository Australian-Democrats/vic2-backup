/* /thanks behaviour: adapt the hero for donations vs joining, and copy-link.
 * CSP-safe (script-src 'self'): no libraries, no inline handlers. */
(function () {
  'use strict';
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }

  // The /thanks page is reached after both a membership join (?membership=…) and a
  // donation (?donation=1). Default copy is the "thanks for joining" flow; swap it
  // for donors and hide the membership-only sections.
  if (params && params.has('donation')) {
    var badge = document.querySelector('.thanks-badge');
    if (badge) badge.innerHTML = '<span aria-hidden="true">💛</span> Thank you';
    var h = document.getElementById('thanksHeading');
    if (h) h.innerHTML = 'Thanks for your <span class="hl">donation</span>!';
    var intro = document.getElementById('thanksIntro');
    if (intro) intro.textContent =
      "Thank you for backing the Australian Democrats. We're powered by people like you — every dollar " +
      'helps raise awareness and fuel our campaigns to bring accountability, integrity and trust back to ' +
      'Australian politics.';
    var note = document.getElementById('thanksMemberNote'); if (note) note.hidden = true;
    var work = document.getElementById('thanksMemberWork'); if (work) work.hidden = true;
    document.title = 'Thank you for your donation — Australian Democrats (Victoria)';
  }

  // Copy the join link to the clipboard.
  var copy = document.getElementById('thanksCopy');
  if (copy) {
    copy.addEventListener('click', function () {
      var url = copy.getAttribute('data-url') || (window.location.origin + '/join');
      var status = document.getElementById('thanksCopied');
      var ok = function () { if (status) status.textContent = 'Link copied — thanks for spreading the word!'; };
      var fail = function () { window.prompt('Copy this link:', url); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok, fail);
      } else {
        fail();
      }
    });
  }
})();
