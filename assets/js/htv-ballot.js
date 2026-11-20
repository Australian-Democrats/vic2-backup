/* "Your ballot paper" — the ballot-paper replicas on the how-to-vote district
   and region pages (src/components/htv/HtvBallotPaperLA.astro / …LC.astro).
   Loaded from those pages' scripts slot only. Everything it does is an
   enhancement; without it the papers are complete (the Council paper shows
   the above-the-line way, the one the registered card asks for).

   1. The Council paper's two views: "Above the line" / "Below the line"
      (aria-pressed buttons) switch the set's data-way, and the stylesheet
      shows our 1 in that view only — never above AND below at once.
   2. Phones: when the Council paper's columns are wider than its frame, the
      frame becomes a focusable, labelled scroll region and opens centred on
      our column; the coach under it ("Slide to see the whole paper") goes
      once the visitor slides it (its room stays — nothing moves). The coach's
      arrows nudge only without a reduced-motion preference (CSS); centring
      is instant.
   It writes no numeral into a box and no ballot wording of its own. */
(function () {
  'use strict';
  var sets = document.querySelectorAll('.htvb-set--lc');
  if (!sets.length) return;

  function centreOnOurs(scroller) {
    var ours = scroller.querySelector('.htvb-atl.is-ours');
    if (!ours) return;
    var o = ours.getBoundingClientRect();
    var f = scroller.getBoundingClientRect();
    var target = scroller.scrollLeft + (o.left - f.left) + o.width / 2 - scroller.clientWidth / 2;
    scroller.dataset.htvbProgrammatic = '1';
    scroller.scrollLeft = Math.max(0, target);
    // The scroll event this fires is ours, not the visitor's.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { delete scroller.dataset.htvbProgrammatic; });
    });
  }

  function fit(set) {
    var scroller = set.querySelector('[data-htvb-scroll]');
    var coach = set.querySelector('[data-htvb-coach]');
    if (!scroller) return;
    var wide = scroller.scrollWidth > scroller.clientWidth + 12;
    if (wide) {
      // A scroll region a keyboard can reach, named for the paper.
      scroller.setAttribute('tabindex', '0');
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', scroller.getAttribute('data-htvb-label') || 'Ballot paper');
      if (!scroller.dataset.htvbCentred) {
        scroller.dataset.htvbCentred = '1';
        centreOnOurs(scroller);
      }
      // The stylesheet reserves the coach's room below 900px; on a wide
      // screen it shows only for a paper that overflows even there.
      if (coach) coach.setAttribute('data-show', '');
    } else {
      scroller.removeAttribute('tabindex');
      scroller.removeAttribute('role');
      scroller.removeAttribute('aria-label');
      if (coach) {
        coach.removeAttribute('data-show');
        coach.setAttribute('data-done', '');
      }
    }
  }

  Array.prototype.forEach.call(sets, function (set) {
    var scroller = set.querySelector('[data-htvb-scroll]');
    var coach = set.querySelector('[data-htvb-coach]');
    if (scroller && coach) {
      scroller.addEventListener('scroll', function () {
        if (scroller.dataset.htvbProgrammatic) return;
        coach.setAttribute('data-done', '');
      }, { passive: true });
    }
    var buttons = set.querySelectorAll('[data-htvb-way]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var way = btn.getAttribute('data-htvb-way');
        set.setAttribute('data-way', way);
        Array.prototype.forEach.call(buttons, function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
      });
    });
    fit(set);
  });

  var t = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(t);
    t = window.setTimeout(function () { Array.prototype.forEach.call(sets, fit); }, 150);
  }, { passive: true });
})();
