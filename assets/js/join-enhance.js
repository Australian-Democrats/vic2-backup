/* Join page enhancements (progressive — the form works without this file):
   · picking a tier scrolls to renewal (paid) or member details (supporter)
   · segmented renewal control (Automatic | Manual radio pair), hidden for the
     free Supporter tier — the server ignores auto_renew for supporters anyway
   · ?tier= deep-link from the home page sets the tier and scrolls
   · "member of another party?" reveals the which-party field
   · submit button label reflects free vs paid
   The live completion tracker lives in join-progress.js (floating panel);
   submission stays owned by checkout-form.js. */
(function () {
  'use strict';

  var form = document.getElementById('joinForm');
  if (!form) return;

  var submitBtn = document.getElementById('joinSubmit');
  var renewalStep = document.getElementById('step-renewal');
  var detailsStep = document.getElementById('memberDetails');
  var autoRenew = document.getElementById('renew-auto');
  var manualRenew = document.getElementById('renew-manual');
  var renewExplainer = document.getElementById('renewExplainer');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renewUserSet = false;

  function scrollToStep(el) {
    if (!el) return;
    var header = document.getElementById('site-header');
    var offset = (header ? header.offsetHeight : 0) + 16;
    var y = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Nudge focus to the step for keyboard/AT users without a visible jump.
    var focusable = el.querySelector('input, select, button, [tabindex]');
    if (focusable) {
      window.setTimeout(function () { focusable.focus({ preventScroll: true }); }, reduceMotion ? 0 : 420);
    }
  }

  function selectedTier() {
    var t = form.querySelector('input[name="tier"]:checked');
    return t ? t.value : 'supporter';
  }

  // ---- Renewal segment + tier-driven layout --------------------------------
  function autoRenewOn() {
    return !!(autoRenew && autoRenew.checked);
  }

  function syncTier() {
    var tier = selectedTier();
    var free = tier === 'supporter';
    if (submitBtn) submitBtn.textContent = free ? 'Continue — it’s free' : 'Continue to secure payment';
    if (renewalStep) renewalStep.hidden = free;
    // Paid tiers default to automatic until the member chooses otherwise.
    // (Supporter has nothing to renew; the server ignores auto_renew for it.)
    if (!free && autoRenew && !renewUserSet) autoRenew.checked = true;
    updateRenewExplainer();
  }

  function updateRenewExplainer() {
    if (!renewExplainer) return;
    renewExplainer.textContent = autoRenewOn()
      ? 'Your membership will renew automatically each year — no need to remember. Cancel anytime.'
      : 'You’ll renew manually each year. We’ll send you a friendly reminder when it’s due.';
  }

  form.querySelectorAll('input[name="tier"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      syncTier();
      // Paid tiers → decide renewal next; Supporter → straight to details.
      scrollToStep(selectedTier() === 'supporter' ? detailsStep : renewalStep);
    });
  });

  [autoRenew, manualRenew].forEach(function (r) {
    if (!r) return;
    r.addEventListener('change', function () {
      renewUserSet = true;
      updateRenewExplainer();
    });
  });

  // ---- Which-party reveal -------------------------------------------------
  var whichWrap = document.getElementById('j-which-wrap');
  form.querySelectorAll('input[name="other_party"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var yes = form.querySelector('input[name="other_party"]:checked');
      if (whichWrap) whichWrap.hidden = !(yes && yes.value === 'Yes');
    });
  });

  // ---- Deep link: /join?tier=ordinary|concession|supporter ----------------
  function applyTierFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var wanted = (params.get('tier') || '').toLowerCase();
    if (['supporter', 'ordinary', 'concession'].indexOf(wanted) === -1) return false;
    var radio = form.querySelector('input[name="tier"][value="' + wanted + '"]');
    if (!radio) return false;
    radio.checked = true;
    syncTier();
    // Let layout settle (renewal step show/hide) before scrolling.
    window.setTimeout(function () {
      scrollToStep(wanted === 'supporter' ? detailsStep : renewalStep);
    }, 60);
    return true;
  }

  // Init
  syncTier();
  applyTierFromQuery();
})();
