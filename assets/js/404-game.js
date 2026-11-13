/* "Keep 'em Honest" — the Australian Democrats (Victoria) 404 mini-game.
 * Loads ONLY on the 404 page (guards on #khGame). Vanilla JS, CSP-safe
 * (script-src 'self'): no libraries, no eval, no inline handlers, no network.
 * Canvas 2D, DPR-aware, fixed-timestep loop, object-pooled particles.
 * Progressive enhancement: if this never runs, the 404 page is still a proper
 * page (headline + navigation buttons live in the HTML). */
(function () {
  'use strict';

  var root = document.getElementById('khGame');
  if (!root) return;
  var canvas = document.getElementById('khCanvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('khStage');

  // ---- DOM refs -----------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var elScore = $('khScore'), elTime = $('khTime'),
      elComboWrap = $('khComboWrap'), elCombo = $('khCombo'),
      elStart = $('khStart'), elPlay = $('khPlay'),
      elBestLine = $('khBestLine'), elBest = $('khBest'),
      elOver = $('khOver'), elVerdict = $('khVerdict'), elFinal = $('khFinal'),
      elOverMsg = $('khOverMsg'), elAgain = $('khAgain'), elLive = $('khLive'),
      elPause = $('khPause'), elPaused = $('khPaused'), elResume = $('khResume');

  // ---- brand tokens (read from :root so they never drift) ------------------
  var cs = getComputedStyle(document.documentElement);
  var tok = function (name, fb) { var x = cs.getPropertyValue(name).trim(); return x || fb; };
  var C = {
    paper: tok('--paper', '#fffdf7'), sand: tok('--sand', '#f5f0e2'),
    ink: tok('--ink', '#1c2b29'), inkSoft: tok('--ink-soft', '#46514f'),
    yellow: tok('--yellow', '#fcd666'), yellowSoft: tok('--yellow-soft', '#fdeab3'),
    teal: tok('--teal', '#29a895'), tealDeep: tok('--teal-deep', '#147065'),
    tealInk: tok('--teal-ink', '#0d4a43'), line: tok('--line', '#e2dcc9')
  };
  var DISPLAY = "800 %spx 'Bricolage Grotesque Variable','Public Sans Variable',system-ui,sans-serif";
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---- helpers ------------------------------------------------------------
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var chance = function (p) { return Math.random() < p; };
  var TAU = Math.PI * 2;

  // ---- official Australian Democrats icon ---------------------------------
  // Same-origin PNG (CSP img-src 'self'); falls as a catchable item + brands the HUD.
  var adImg = new Image();
  var adReady = false;
  adImg.decoding = 'async';
  adImg.onload = function () { adReady = true; };
  adImg.src = '/assets/img/ad-icon.png';

  // ---- localStorage best --------------------------------------------------
  var BEST_KEY = 'khHonestBest';
  var best = 0;
  try { best = parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
  function saveBest(v) { try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) {} }

  // ---- state --------------------------------------------------------------
  var DURATION = 45;                 // one "term" in seconds
  var W = 0, H = 0, dpr = 1;
  var state = 'attract';             // 'attract' | 'playing' | 'paused' | 'over'
  var timeLeft = DURATION;
  var score = 0, displayScore = 0, combo = 0, mult = 1;
  var shake = 0, flash = 0, flashColor = C.yellow;
  var items = [], particles = [], ambient = [], banner = null;
  var spawnTimer = 0;
  var raf = 0, running = false, lastT = 0, acc = 0;
  var onscreen = true;

  var player = { x: 0, y: 0, tx: 0, w: 90, hw: 45, tilt: 0, vx: 0 };
  var trail = [];                    // {x, y, a} highlighter sweep trail
  var keyDir = 0;                    // -1 / 0 / 1 from keyboard
  var pointerActive = false;

  // ---- sizing -------------------------------------------------------------
  function fit() {
    var r = stage.getBoundingClientRect();
    W = Math.max(280, Math.round(r.width));
    H = Math.max(320, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.w = clamp(W * 0.17, 68, 120);
    player.hw = player.w / 2;
    player.y = H - clamp(H * 0.12, 40, 74);
    if (player.x === 0) { player.x = W / 2; player.tx = W / 2; }
    player.x = clamp(player.x, player.hw, W - player.hw);
    player.tx = clamp(player.tx, player.hw, W - player.hw);
  }

  // ---- input --------------------------------------------------------------
  function pointerX(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    return clamp(cx - r.left, player.hw, W - player.hw);
  }
  function onPointerMove(e) {
    if (state !== 'playing') return;
    pointerActive = true; keyDir = 0;
    player.tx = pointerX(e);
    if (e.cancelable) e.preventDefault();
  }
  stage.addEventListener('pointermove', onPointerMove, { passive: false });
  stage.addEventListener('pointerdown', function (e) {
    if (state === 'playing') { pointerActive = true; keyDir = 0; player.tx = pointerX(e); }
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (state === 'playing') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keyDir = -1; pointerActive = false; e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keyDir = 1; pointerActive = false; e.preventDefault(); }
      else if (k === ' ' || k === 'p' || k === 'P') { togglePause(); e.preventDefault(); }
    } else if (state === 'paused') {
      if (k === ' ' || k === 'p' || k === 'P') { togglePause(); e.preventDefault(); }
    } else if (state === 'attract' || state === 'over') {
      if ((k === ' ' || k === 'Enter') && document.activeElement === document.body) { start(); e.preventDefault(); }
    }
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if ((k === 'ArrowLeft' || k === 'a' || k === 'A') && keyDir === -1) keyDir = 0;
    if ((k === 'ArrowRight' || k === 'd' || k === 'D') && keyDir === 1) keyDir = 0;
  });

  if (elPlay) elPlay.addEventListener('click', start);
  if (elAgain) elAgain.addEventListener('click', start);
  if (elPause) elPause.addEventListener('click', togglePause);
  if (elResume) elResume.addEventListener('click', togglePause);

  // ---- particles (pooled) -------------------------------------------------
  var SHAPES = ['sq', 'ci', 'ti'];
  function burst(x, y, colors, n) {
    if (reduceMotion) n = Math.min(n, 6);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 260);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 140),
        life: 0, max: rand(0.5, 1.05), size: rand(4, 9),
        rot: rand(0, TAU), vr: rand(-8, 8),
        color: colors[(Math.random() * colors.length) | 0],
        shape: SHAPES[(Math.random() * SHAPES.length) | 0]
      });
      if (particles.length > 360) particles.shift();
    }
  }

  // ---- spawning -----------------------------------------------------------
  var TYPES = { VOTE: 0, INTEGRITY: 1, GOLD: 2, RORT: 3, PAGE: 4, ADICON: 5 };
  function spawn() {
    var p = 1 - timeLeft / DURATION;              // 0 -> 1 over the term
    var roll = Math.random();
    var rortW = lerp(0.14, 0.34, p);
    var type;
    if (roll < 0.05) type = TYPES.GOLD;
    else if (roll < 0.09) type = TYPES.PAGE;
    else if (roll < 0.19 && adReady) type = TYPES.ADICON;   // official AD icon (once loaded)
    else if (roll < 0.33) type = TYPES.INTEGRITY;
    else if (roll < 0.33 + rortW) type = TYPES.RORT;
    else type = TYPES.VOTE;

    var speed = rand(lerp(110, 150, p), lerp(180, 300, p));
    var x = rand(40, W - 40);
    var it = { type: type, x: x, y: -40, vy: speed, vx: 0, rot: rand(-0.3, 0.3),
               vr: rand(-1.2, 1.2), t: 0, phase: rand(0, TAU), done: false };
    if (type === TYPES.VOTE) { it.w = 42; it.h = 54; it.catchR = 26; it.vr = rand(-0.8, 0.8); }
    else if (type === TYPES.INTEGRITY) { it.catchR = 21; }
    else if (type === TYPES.ADICON) { it.w = 48; it.h = 48; it.catchR = 26; it.vr = rand(-1.0, 1.0); }
    else if (type === TYPES.GOLD) { it.w = 46; it.h = 46; it.catchR = 26; }
    else if (type === TYPES.RORT) { it.catchR = 22; it.vx = rand(-30, 30); }
    else if (type === TYPES.PAGE) { it.w = 44; it.h = 56; it.catchR = 27; it.vy = rand(70, 110); it.amp = rand(40, 90); }
    items.push(it);
  }

  // ---- ambient (drifting cards behind the start/over screens) -------------
  function seedAmbient() {
    ambient = [];
    var n = reduceMotion ? 5 : 9;
    for (var i = 0; i < n; i++) {
      ambient.push({ x: rand(0, W), y: rand(0, H), vy: reduceMotion ? 0 : rand(10, 26),
        rot: rand(0, TAU), vr: rand(-0.4, 0.4), s: rand(0.6, 1.1),
        kind: chance(0.5) ? 'vote' : (chance(0.5) ? 'tick' : 'dot') });
    }
  }

  // ---- catch resolution ---------------------------------------------------
  function announce(msg) { if (elLive) elLive.textContent = msg; }
  function popScore() {
    if (!elScore) return;
    elScore.classList.remove('kh-pop'); void elScore.offsetWidth; elScore.classList.add('kh-pop');
  }
  function showBanner(text, color) {
    banner = { text: text, color: color || C.yellow, t: 0, dur: reduceMotion ? 1.1 : 1.4 };
  }
  function setCombo(c) {
    combo = c;
    mult = 1 + Math.min(5, Math.floor(combo / 4));
    if (mult > 1) {
      if (elComboWrap) elComboWrap.hidden = false;
      if (elCombo) {
        elCombo.textContent = 'x' + mult;
        elCombo.classList.remove('kh-pop'); void elCombo.offsetWidth; elCombo.classList.add('kh-pop');
      }
    } else if (elComboWrap) { elComboWrap.hidden = true; }
  }
  function addScore(base) {
    var gained = base * mult;
    score += gained; popScore();
    return gained;
  }

  function catchItem(it) {
    it.done = true;
    if (it.type === TYPES.RORT) {
      // Caught a rort — combo breaks, small penalty, ink smudge.
      score = Math.max(0, score - 5);
      setCombo(0);
      flash = 0.5; flashColor = C.ink; if (!reduceMotion) shake = 9;
      burst(it.x, it.y, [C.ink, C.inkSoft, C.tealInk], 12);
      announce('Rort caught — combo lost.');
      return;
    }
    setCombo(combo + 1);
    if (it.type === TYPES.VOTE) {
      addScore(10);
      burst(it.x, it.y, [C.yellow, C.teal, C.ink], 12);
    } else if (it.type === TYPES.INTEGRITY) {
      addScore(15);
      burst(it.x, it.y, [C.teal, C.tealDeep, C.yellow], 14);
    } else if (it.type === TYPES.ADICON) {
      addScore(25);
      flash = 0.35; flashColor = C.teal;
      burst(it.x, it.y, [C.teal, C.yellow, C.paper, C.ink], reduceMotion ? 10 : 22);
      announce('Democrats icon — nice.');
    } else if (it.type === TYPES.GOLD) {
      addScore(50);
      flash = 0.6; flashColor = C.yellow;
      burst(it.x, it.y, [C.yellow, C.yellowSoft, C.teal, C.ink], reduceMotion ? 10 : 34);
      showBanner('PUT US #1!', C.yellow);
      announce('Golden number one!');
    } else if (it.type === TYPES.PAGE) {
      timeLeft = Math.min(DURATION, timeLeft + 2);
      addScore(20);
      burst(it.x, it.y, [C.teal, C.yellow, C.ink], 16);
      showBanner('Page found! +2s', C.teal);
      announce('Lost page found — two seconds added.');
    }
  }

  // ---- update -------------------------------------------------------------
  function update(dt) {
    // player movement
    if (state === 'playing') {
      if (keyDir !== 0 && !pointerActive) player.tx = clamp(player.tx + keyDir * 620 * dt, player.hw, W - player.hw);
      var nx = lerp(player.x, player.tx, Math.min(1, dt * 14));
      player.vx = (nx - player.x) / Math.max(dt, 0.001);
      player.x = nx;
      player.tilt = clamp(-player.vx * 0.0011, -0.28, 0.28);
      // trail
      trail.push({ x: player.x, y: player.y, a: 1 });
      if (trail.length > 22) trail.shift();
    }
    for (var t = 0; t < trail.length; t++) trail[t].a *= (1 - dt * 3.2);

    // timer / spawns
    if (state === 'playing') {
      timeLeft -= dt;
      if (elTime) elTime.textContent = Math.max(0, Math.ceil(timeLeft));
      if (timeLeft <= 10) stage.classList.add('kh-urgent'); else stage.classList.remove('kh-urgent');
      if (timeLeft <= 0) { gameOver(); return; }
      spawnTimer -= dt;
      var p = 1 - timeLeft / DURATION;
      var interval = lerp(0.72, 0.32, p);
      if (spawnTimer <= 0 && items.length < 14) { spawn(); spawnTimer = interval * rand(0.75, 1.15); }
    }

    // items
    var catchTop = player.y - 10, catchBot = player.y + 24;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.t += dt;
      if (it.type === TYPES.RORT) { it.x += Math.sin(it.t * 6 + it.phase) * 26 * dt; it.rot += it.vr * dt * 2; }
      else if (it.type === TYPES.PAGE) { it.x += Math.sin(it.t * 2.2 + it.phase) * it.amp * dt; it.rot = Math.sin(it.t * 3) * 0.4; }
      else it.rot += it.vr * dt;
      it.y += it.vy * dt;

      if (!it.done && state === 'playing' && it.y + it.catchR >= catchTop && it.y - it.catchR <= catchBot) {
        if (Math.abs(it.x - player.x) <= player.hw + it.catchR * 0.55) { catchItem(it); }
      }
      if (it.done || it.y - (it.catchR || 24) > H + 30) items.splice(i, 1);
    }

    // particles
    for (var j = particles.length - 1; j >= 0; j--) {
      var pt = particles[j];
      pt.life += dt;
      if (pt.life >= pt.max) { particles.splice(j, 1); continue; }
      pt.vy += 520 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.vr * dt;
    }

    // ambient drift (attract / over)
    if (state === 'attract' || state === 'over') {
      for (var a = 0; a < ambient.length; a++) {
        var am = ambient[a];
        am.y += am.vy * dt; am.rot += am.vr * dt;
        if (am.y > H + 30) { am.y = -30; am.x = rand(0, W); }
      }
    }

    // fx decay
    if (shake > 0) shake = Math.max(0, shake - dt * 34);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (banner) { banner.t += dt; if (banner.t >= banner.dur) banner = null; }

    // eased HUD score
    if (displayScore !== score) {
      displayScore += (score - displayScore) * Math.min(1, dt * 12);
      if (Math.abs(score - displayScore) < 0.6) displayScore = score;
      if (elScore) elScore.textContent = Math.round(displayScore);
    }
  }

  // ---- drawing ------------------------------------------------------------
  function bg() {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    // faint dotted grid — editorial "paper"
    ctx.fillStyle = C.line;
    var gap = 26, r = 1.1;
    ctx.globalAlpha = 0.55;
    for (var y = gap; y < H; y += gap) for (var x = gap; x < W; x += gap) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, rad) {
    var r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawVoteCard(w, h, dogEar) {
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.paper;
    roundRect(-w / 2, -h / 2, w, h, 5); ctx.fill(); ctx.stroke();
    // yellow dog-ear
    if (dogEar) {
      ctx.fillStyle = C.yellow;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 13, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2 + 13);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // ballot lines
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    for (var k = 0; k < 3; k++) {
      var yy = -h / 2 + 14 + k * 10;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 7, yy); ctx.lineTo(w / 2 - 8, yy); ctx.stroke();
    }
    // teal tick
    ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, h / 2 - 12); ctx.lineTo(-1, h / 2 - 7); ctx.lineTo(8, h / 2 - 17); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  function drawItem(it) {
    ctx.save();
    ctx.translate(it.x, it.y); ctx.rotate(it.rot);
    if (it.type === TYPES.VOTE) { drawVoteCard(it.w, it.h, true); }
    else if (it.type === TYPES.INTEGRITY) {
      // Teal "1" token — a preference in our box, like the ballot numbers.
      ctx.fillStyle = C.teal; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, it.catchR, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = DISPLAY.replace('%s', '24');
      ctx.fillText('1', 0, 1);
    } else if (it.type === TYPES.ADICON) {
      // The official Australian Democrats icon, framed with an ink border.
      if (adReady) ctx.drawImage(adImg, -it.w / 2, -it.h / 2, it.w, it.h);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      roundRect(-it.w / 2, -it.h / 2, it.w, it.h, 9); ctx.stroke();
    } else if (it.type === TYPES.GOLD) {
      ctx.fillStyle = C.yellow; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      roundRect(-it.w / 2, -it.h / 2, it.w, it.h, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = DISPLAY.replace('%s', '30');
      ctx.fillText('1', 0, 2);
    } else if (it.type === TYPES.RORT) {
      // wobbly ink blob — clearly "avoid"
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      for (var a = 0; a < TAU; a += TAU / 9) {
        var rr = it.catchR + Math.sin(a * 3 + it.t * 8) * 3;
        var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.paper; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (it.type === TYPES.PAGE) {
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2;
      roundRect(-it.w / 2, -it.h / 2, it.w, it.h, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.inkSoft; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = DISPLAY.replace('%s', '15');
      ctx.fillText('404', 0, 0);
    }
    ctx.restore();
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], al = 1 - p.life / p.max;
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.shape === 'sq') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      else if (p.shape === 'ci') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, TAU); ctx.fill(); }
      else { ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(-p.size / 2, 0); ctx.lineTo(-p.size / 6, p.size / 3); ctx.lineTo(p.size / 2, -p.size / 3); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawTrail() {
    for (var i = 0; i < trail.length; i++) {
      var tr = trail[i];
      ctx.globalAlpha = clamp(tr.a, 0, 1) * 0.5;
      ctx.fillStyle = C.yellow;
      var w = player.w * (0.5 + 0.5 * (i / trail.length));
      roundRect(tr.x - w / 2, tr.y - 9, w, 18, 8); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y); ctx.rotate(player.tilt);
    var w = player.w, h = 30;
    // felt nib (catch tip)
    ctx.fillStyle = C.tealInk;
    roundRect(-w / 2 + 6, -h / 2 - 9, w - 12, 12, 4); ctx.fill();
    // body
    ctx.fillStyle = C.yellow; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill(); ctx.stroke();
    // cap band
    ctx.fillStyle = C.ink;
    roundRect(w / 2 - 12, -h / 2, 12, h, 6); ctx.fill();
    // glint
    ctx.strokeStyle = C.yellowSoft; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -3); ctx.lineTo(w / 2 - 16, -3); ctx.stroke();
    ctx.restore();
  }
  function drawBanner() {
    if (!banner) return;
    var t = banner.t / banner.dur;
    var ease = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;   // fade out second half
    ctx.save();
    ctx.globalAlpha = clamp(ease, 0, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = DISPLAY.replace('%s', String(Math.round(clamp(W * 0.06, 26, 42))));
    var m = ctx.measureText(banner.text), bw = m.width + 34, by = H * 0.34;
    ctx.fillStyle = banner.color;
    roundRect(W / 2 - bw / 2, by - 24, bw, 48, 8); ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText(banner.text, W / 2, by + 1);
    ctx.restore();
  }
  function drawAmbient() {
    for (var i = 0; i < ambient.length; i++) {
      var am = ambient[i];
      ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(am.x, am.y); ctx.rotate(am.rot); ctx.scale(am.s, am.s);
      if (am.kind === 'vote') drawVoteCard(38, 48, true);
      else if (am.kind === 'tick') {
        ctx.strokeStyle = C.teal; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-9, 1); ctx.lineTo(-2, 9); ctx.lineTo(10, -8); ctx.stroke(); ctx.lineCap = 'butt';
      } else { ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    var sx = 0, sy = 0;
    if (shake > 0 && !reduceMotion) { sx = rand(-shake, shake); sy = rand(-shake, shake); }
    ctx.save();
    ctx.translate(sx, sy);
    bg();
    if (state === 'attract' || state === 'over') drawAmbient();
    for (var i = 0; i < items.length; i++) drawItem(items[i]);
    drawParticles();
    if (state === 'playing' || state === 'paused') { drawTrail(); drawPlayer(); }
    drawBanner();
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.5; ctx.fillStyle = flashColor; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- loop ---------------------------------------------------------------
  function frame(t) {
    if (!running) return;
    if (!lastT) lastT = t;
    var dt = Math.min(64, t - lastT); lastT = t;
    acc += dt;
    var steps = 0;
    while (acc >= 16.6667 && steps < 5) { update(1 / 60); acc -= 16.6667; steps++; }
    if (steps === 5) acc = 0;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (running || !onscreen) return; running = true; lastT = 0; acc = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  // ---- state transitions --------------------------------------------------
  function start() {
    fit();
    state = 'playing';
    timeLeft = DURATION; score = 0; displayScore = 0; combo = 0; mult = 1;
    items = []; particles = []; banner = null; trail = []; spawnTimer = 0;
    shake = 0; flash = 0; keyDir = 0; pointerActive = false;
    player.x = W / 2; player.tx = W / 2;
    if (elScore) elScore.textContent = '0';
    if (elTime) elTime.textContent = DURATION;
    if (elComboWrap) elComboWrap.hidden = true;
    if (elStart) elStart.hidden = true;
    if (elOver) elOver.hidden = true;
    if (elPaused) elPaused.hidden = true;
    if (elPause) elPause.hidden = false;
    stage.classList.add('kh-playing');
    stage.setAttribute('tabindex', '0');
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    announce('Game started. Catch votes, avoid rorts. Forty-five seconds.');
    startLoop();
  }
  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      if (elPaused) elPaused.hidden = false;
      announce('Paused.');
    } else if (state === 'paused') {
      state = 'playing';
      if (elPaused) elPaused.hidden = true;
      stage.setAttribute('tabindex', '0');
      try { stage.focus({ preventScroll: true }); } catch (e) {}
      announce('Resumed.');
    }
  }
  function verdictFor(s) {
    if (s >= 400) return ['Landslide!', "You kept 'em honest — a clean sweep."];
    if (s >= 250) return ['Elected!', 'A strong, honest result. The bastards are on notice.'];
    if (s >= 120) return ['Balance of power', 'Not bad — enough to keep the big parties honest.'];
    return ['Keep going', 'Every honest vote counts. Give it another run?'];
  }
  function gameOver() {
    state = 'over';
    stage.classList.remove('kh-playing', 'kh-urgent');
    if (elPause) elPause.hidden = true;
    if (elPaused) elPaused.hidden = true;
    score = Math.round(score); displayScore = score;
    var isBest = score > best;
    if (isBest) { best = score; saveBest(best); }
    var v = verdictFor(score);
    if (elVerdict) elVerdict.textContent = v[0];
    if (elFinal) elFinal.textContent = score;
    if (elOverMsg) elOverMsg.textContent = (isBest ? 'New personal best! ' : 'Your best: ' + best + '. ') + v[1];
    if (elOver) elOver.hidden = false;
    if (elAgain) { try { elAgain.focus({ preventScroll: true }); } catch (e) {} }
    burst(W / 2, H * 0.4, [C.yellow, C.teal, C.ink, C.yellowSoft], reduceMotion ? 12 : 40);
    announce('Term over. ' + score + ' honest votes. ' + v[0] + '. ' + v[1]);
  }

  // ---- lifecycle: pause when hidden / offscreen ---------------------------
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else if (onscreen) startLoop();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onscreen = entries[0].isIntersecting;
      if (onscreen && !document.hidden) startLoop(); else stopLoop();
    }, { threshold: 0.12 }).observe(stage);
  }
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { fit(); if (state === 'attract') seedAmbient(); }, 120);
  });

  // ---- boot ---------------------------------------------------------------
  root.classList.add('kh-on');       // reveal the stage (progressive enhancement)
  if (elBest && best > 0) { elBest.textContent = best; if (elBestLine) elBestLine.hidden = false; }
  fit();
  seedAmbient();
  state = 'attract';
  startLoop();
})();
