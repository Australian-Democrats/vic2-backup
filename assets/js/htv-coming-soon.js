/* /how-to-vote holding page ("Not ready yet" mode) — the stir interaction.

   Progressive enhancement, in the shape the rest of the site uses:
     · the page is finished and readable with this file absent. The scene's
       resting state (five preference numbers jumbled above a simmering pot)
       is plain CSS in src/styles/htv-coming-soon.css, and every ambient
       animation is gated on html.js-motion, which effects.js adds only when
       motion is allowed;
     · the stir control ships with the `hidden` attribute and is revealed
       here, so no-JS visitors never meet a dead button;
     · under prefers-reduced-motion the FUNCTIONAL half still runs — stirring
       becomes a plain settle/unsettle toggle with no swirl and no timers.

   All state lives in two classes on the stage, so the CSS owns every frame:
     .is-stirring  the one-shot spoon sweep + pot rock (1.1s)
     .is-settled   the numbers glide into 1-2-3-4-5, then drift apart again
   See src/components/HtvComingSoon.astro. */
(function () {
  'use strict';

  var stage = document.getElementById('hcsStage');
  var btn = document.getElementById('hcsStir');
  if (!stage || !btn) return;

  var reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  stage.classList.add('hcs-on');
  btn.hidden = false;

  var STIR_MS = 1150; // must match the .is-stirring animations
  var HOLD_MS = 3600; // how long the numbers stay in order before loosening
  var stirTimer = 0;
  var settleTimer = 0;

  function stir() {
    // Reduced motion: no sweep, no timed change the visitor did not ask for
    // — just a toggle between "jumbled" and "in order".
    if (reduced) {
      stage.classList.toggle('is-settled');
      return;
    }

    clearTimeout(stirTimer);
    clearTimeout(settleTimer);

    // Restart the one-shot animation on a repeat press without forcing a
    // synchronous layout: drop the class, let a frame pass, add it back.
    stage.classList.remove('is-stirring');
    stage.classList.add('is-settled');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        stage.classList.add('is-stirring');
      });
    });

    stirTimer = setTimeout(function () {
      stage.classList.remove('is-stirring');
    }, STIR_MS);
    settleTimer = setTimeout(function () {
      stage.classList.remove('is-settled');
    }, HOLD_MS);
  }

  btn.addEventListener('click', stir);
  // Tapping the pot itself is the instinct on a phone. The button above is
  // the real control (focusable, labelled); this is a bonus target only.
  stage.addEventListener('click', stir);
})();
