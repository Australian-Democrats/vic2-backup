/* /thanks behaviour: pick the variant of the page from the query string and the
 * copy-link button. CSP-safe (script-src 'self'): no libraries, no inline handlers.
 *
 * The page is prerendered with a NEUTRAL thank-you as the no-JS default (blocks whose
 * data-for list contains "neutral"); every variant's copy is already in the markup,
 * tagged data-for="<variant …>", the rest hidden. Arrivals:
 *   /thanks?membership=<tier>        → member   (Stripe return for paid tiers, or the free
 *                                                Supporter tier straight from the join form)
 *   /thanks?donation=1               → donation (ordinary /donate, shared Stripe account)
 *   /thanks?donation=1&fund=1        → fund     (Victorian campaign fund, /donate/campaign)
 * Anything else (no query, a hand-typed URL) resolves to the member copy.
 * A donation is money, not a membership: the donor variants never mention joining,
 * and `&join=1` (src/lib/checkout.ts appends it to Stripe's success_url when the
 * donor ticked "I would also like to join"; the form script opens /join in a new
 * tab at that moment) is deliberately ignored — that request was met by the tab. */
(function () {
  'use strict';
  var params = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }

  var root = document.getElementById('thanksPage');
  if (!root) return;

  var variant = 'member';
  if (params && params.has('donation')) variant = params.has('fund') ? 'fund' : 'donation';

  // ---- show the matching copy, hide the rest --------------------------------------
  root.setAttribute('data-variant', variant);
  var blocks = root.querySelectorAll('[data-for]');
  for (var i = 0; i < blocks.length; i++) {
    var list = (blocks[i].getAttribute('data-for') || '').split(/\s+/);
    var show = list.indexOf(variant) !== -1;
    if (show) blocks[i].removeAttribute('hidden'); else blocks[i].setAttribute('hidden', '');
  }

  // ---- document title + the poster's accessible name --------------------------------
  var TITLES = {
    member: 'Thanks for joining — Australian Democrats (Victoria)',
    donation: 'Thank you for your donation — Australian Democrats (Victoria)',
    fund: 'Thank you for backing the Victorian campaign — Australian Democrats (Victoria)'
  };
  if (TITLES[variant]) document.title = TITLES[variant];
  var poster = document.getElementById('thanksPoster');
  if (poster && variant === 'member') poster.setAttribute('aria-label', 'Welcome aboard — Australian Democrats Victoria');

  // ---- share links: the donate link is rendered; members get the join link ---------
  var copy = document.getElementById('thanksCopy');
  var donateUrl = (copy && copy.getAttribute('data-url')) || (window.location.origin + '/donate');
  var joinUrl = (copy && copy.getAttribute('data-url-join')) || (window.location.origin + '/join');
  var shareUrl = variant === 'member' ? joinUrl : donateUrl;
  if (variant === 'member') {
    var text = 'I just joined the Australian Democrats — help keep the bastards honest and join too:';
    var enc = encodeURIComponent;
    var hrefs = {
      sms: 'sms:?&body=' + enc(text + ' ' + joinUrl),
      whatsapp: 'https://wa.me/?text=' + enc(text + ' ' + joinUrl),
      email: 'mailto:?subject=' + enc('Join the Australian Democrats') + '&body=' + enc(text + ' ' + joinUrl),
      x: 'https://twitter.com/intent/tweet?text=' + enc(text) + '&url=' + enc(joinUrl),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(joinUrl)
    };
    var links = root.querySelectorAll('[data-share]');
    for (var k = 0; k < links.length; k++) {
      var key = links[k].getAttribute('data-share');
      if (hrefs[key]) links[k].setAttribute('href', hrefs[key]);
    }
  }

  // ---- copy the shared link to the clipboard ----------------------------------------
  if (copy) {
    copy.addEventListener('click', function () {
      var status = document.getElementById('thanksCopied');
      var ok = function () { if (status) status.textContent = 'Link copied — thanks for spreading the word!'; };
      var fail = function () { window.prompt('Copy this link:', shareUrl); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(ok, fail);
      } else {
        fail();
      }
    });
  }
})();
