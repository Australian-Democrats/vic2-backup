/* /donate — reveals the Victorian campaign-fund section (#donateCampaign) where this
   environment has the fund LINKED. The page is prerendered, so it asks the Worker
   (GET /api/campaign-fund, also used by /donate/campaign): `linked` is the /admin
   KV switch `campaign_fund_linked` (default: yes on the preview/UAT Worker, no on
   production) and `configured` says the campaign Stripe account is wired. Both must
   be true; anything else — including a failed request — leaves the section hidden
   (fail closed), so a promotion can never publish the link by itself (ADR-65).
   Also fills [data-fund-cap] with the cap the form currently enforces.
   External file: VIC keeps a strict `script-src 'self'` CSP (no inline scripts). */
(function () {
  'use strict';
  var section = document.getElementById('donateCampaign');
  if (!section) return;
  fetch('/api/campaign-fund', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || d.linked !== true || d.configured !== true) return;
      var cap = Number(d.capCents);
      if (cap > 0) {
        var caps = section.querySelectorAll('[data-fund-cap]');
        for (var i = 0; i < caps.length; i++) caps[i].textContent = '$' + Math.round(cap / 100).toLocaleString('en-AU');
      }
      section.setAttribute('data-fund-linked', 'true');
      section.hidden = false;
    })
    .catch(function () { /* stays hidden */ });
})();
