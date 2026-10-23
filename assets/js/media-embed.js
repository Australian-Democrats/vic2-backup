/* Click-to-load YouTube facade (src/components/MediaEmbed.astro).

   Progressive enhancement only. With JavaScript off the facade stays a real
   link to the video on youtube.com, so nothing is broken or blank. Nothing
   third-party is requested and no cookie is set until the visitor presses
   play. Uploaded videos are native <video controls> and never need this file,
   so it is only emitted on pages that actually contain a facade. */
(function () {
  'use strict';
  var links = document.querySelectorAll('a.me-facade[data-me-yt]');
  if (!links.length) return;
  var live = null;

  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.id = 'meLive';
      live.className = 'visually-hidden';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = msg;
  }

  function play(btn) {
    var id = btn.getAttribute('data-me-yt') || '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return; // belt and braces
    var start = parseInt(btn.getAttribute('data-me-start') || '0', 10) || 0;
    var title = btn.getAttribute('data-me-title') || 'Video';
    var f = document.createElement('iframe');
    f.className = 'me-iframe';
    f.src =
      'https://www.youtube-nocookie.com/embed/' +
      id +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1' +
      (start > 0 ? '&start=' + start : '');
    f.title = title;
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    btn.parentNode.replaceChild(f, btn);
    f.focus();
    announce(title + ' — video player loaded.');
  }

  Array.prototype.forEach.call(links, function (a) {
    /* Swap the link for a button. With JS the control plays IN PLACE, so it
       must announce and behave as a button (Space as well as Enter), not as a
       link that navigates away. */
    var b = document.createElement('button');
    var title = a.getAttribute('data-me-title') || 'video';
    b.type = 'button';
    b.className = a.className;
    b.setAttribute('data-me-yt', a.getAttribute('data-me-yt'));
    if (a.getAttribute('data-me-start')) b.setAttribute('data-me-start', a.getAttribute('data-me-start'));
    b.setAttribute('data-me-title', title);
    b.setAttribute('aria-label', 'Play “' + title + '”');
    var t = a.getAttribute('data-testid');
    if (t) b.setAttribute('data-testid', t);
    while (a.firstChild) b.appendChild(a.firstChild);
    a.parentNode.replaceChild(b, a);
    b.addEventListener('click', function () {
      play(b);
    });
  });
})();
