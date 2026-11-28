/* "Build the bench" — the Australian Democrats (Victoria) thank-you mini-game.
 * Loads ONLY on /thanks (guards on #thanksGame). Vanilla JS, CSP-safe
 * (script-src 'self'): no libraries, no eval, no inline handlers, no network.
 * Canvas 2D, DPR-aware, fixed-timestep loop, pooled particles — the same
 * chassis as the 404 page's "Keep 'em honest" (public/assets/js/404-game.js),
 * with a different game on it: a one-button stacker. A seat slides across the
 * chamber; drop it onto the bench; the overhang is trimmed off, a perfect
 * landing earns width back; three misses end the sitting.
 * Progressive enhancement: the section is `hidden` in the HTML and stays that
 * way if this never runs, so a no-JS visitor sees a page without a game, not a
 * broken one. */
(function () {
  'use strict';

  var section = document.getElementById('thanksGame');
  if (!section) return;
  var canvas = document.getElementById('tgCanvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var stage = document.getElementById('tgStage');
  if (!stage) return;

  // ---- DOM refs -----------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var elScore = $('tgScore'), elLives = $('tgLives'),
      elStreakWrap = $('tgStreakWrap'), elStreak = $('tgStreak'),
      elStart = $('tgStart'), elPlay = $('tgPlay'),
      elBestLine = $('tgBestLine'), elBest = $('tgBest'),
      elOver = $('tgOver'), elVerdict = $('tgVerdict'), elFinal = $('tgFinal'),
      elOverMsg = $('tgOverMsg'), elAgain = $('tgAgain'), elLive = $('tgLive'), elUnit = $('tgUnit'),
      elPause = $('tgPause'), elPaused = $('tgPaused'), elResume = $('tgResume'),
      elPlayLink = $('thanksPlayLink');

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
  var TAU = Math.PI * 2;

  // ---- official Australian Democrats icon (same-origin PNG) ----------------
  var adImg = new Image();
  var adReady = false;
  adImg.decoding = 'async';
  adImg.onload = function () { adReady = true; };
  adImg.src = '/assets/img/ad-icon.png';

  // ---- localStorage best --------------------------------------------------
  var BEST_KEY = 'tgBenchBest';
  var best = 0;
  try { best = parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
  function saveBest(v) { try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) {} }

  // ---- state --------------------------------------------------------------
  var LIVES = 3;
  var W = 0, H = 0, dpr = 1;
  var BLOCK_H = 34, BASE_Y = 0, baseW = 240, minW = 12;
  var state = 'attract';               // 'attract' | 'playing' | 'paused' | 'over'
  var seats = 0, lives = LIVES, streak = 0, perfectTotal = 0;
  var stack = [];                      // landed seats, bottom first: {x, w, top, perfect}
  var mover = null;                    // the sliding seat: {x, w, top, dir, speed}
  var faller = null;                   // the dropped seat on its way down: {x, w, top, vy, target}
  var debris = [], particles = [];
  var camY = 0, camTarget = 0;         // world → screen: screenY = worldY + camY
  var flash = 0, flashColor = C.yellow, shake = 0, banner = null;
  var raf = 0, running = false, lastT = 0, acc = 0, onscreen = true;
  var attractT = 0;

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
    BLOCK_H = clamp(Math.round(W * 0.075), 28, 40);
    BASE_Y = H - clamp(Math.round(H * 0.11), 44, 64);   // world y of the bench top
    baseW = clamp(Math.round(W * 0.52), 170, 330);
  }
  function topBlock() { return stack[stack.length - 1]; }
  function topY() { return stack.length ? topBlock().top : BASE_Y; }

  // ---- the sliding seat ---------------------------------------------------
  function spawnMover(fromRight) {
    var t = topBlock();
    var w = t ? t.w : baseW;
    var margin = 10;
    var speedScale = clamp(W / 520, 0.72, 1.25);
    mover = {
      w: w,
      x: fromRight ? W - margin - w : margin,
      top: topY() - BLOCK_H - clamp(Math.round(H * 0.16), 70, 120),
      dir: fromRight ? -1 : 1,
      speed: Math.min(470, 150 + seats * 13) * speedScale
    };
  }

  // ---- particles (pooled) -------------------------------------------------
  var SHAPES = ['sq', 'ci', 'ti'];
  function burst(x, y, colors, n) {
    if (reduceMotion) n = Math.min(n, 6);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 240);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 140),
        life: 0, max: rand(0.5, 1.0), size: rand(4, 9), rot: rand(0, TAU), vr: rand(-8, 8),
        color: colors[(Math.random() * colors.length) | 0],
        shape: SHAPES[(Math.random() * SHAPES.length) | 0]
      });
      if (particles.length > 320) particles.shift();
    }
  }

  // ---- HUD + announcements ------------------------------------------------
  function announce(msg) { if (elLive) elLive.textContent = msg; }
  function pop(el) { if (!el) return; el.classList.remove('tg-pop'); void el.offsetWidth; el.classList.add('tg-pop'); }
  function setSeats(n) { seats = n; if (elScore) { elScore.textContent = n; pop(elScore); } }
  function setLives(n) { lives = n; if (elLives) { elLives.textContent = n; pop(elLives); } }
  function setStreak(n) {
    streak = n;
    if (n >= 2) {
      if (elStreakWrap) elStreakWrap.hidden = false;
      if (elStreak) { elStreak.textContent = '×' + n; pop(elStreak); }
    } else if (elStreakWrap) { elStreakWrap.hidden = true; }
  }
  function showBanner(text, color) {
    banner = { text: text, color: color || C.yellow, t: 0, dur: reduceMotion ? 1.0 : 1.4 };
  }

  // ---- drop & landing -----------------------------------------------------
  function drop() {
    if (state !== 'playing' || !mover || faller) return;
    faller = { x: mover.x, w: mover.w, top: mover.top, vy: 0, target: topY() - BLOCK_H };
    mover = null;
  }
  function land() {
    var f = faller; faller = null;
    var b = topBlock() || { x: (W - baseW) / 2, w: baseW };
    var left = Math.max(f.x, b.x), right = Math.min(f.x + f.w, b.x + b.w);
    var overlap = right - left;
    var perfectTol = 8;

    if (overlap <= 6) {
      // Clean miss: the seat tumbles off the side. One try gone.
      debris.push({ x: f.x, w: f.w, top: f.target, vx: f.x + f.w / 2 < b.x + b.w / 2 ? -140 : 140, vy: -60, rot: 0, vr: f.x + f.w / 2 < b.x + b.w / 2 ? -3 : 3, life: 0 });
      setStreak(0);
      setLives(lives - 1);
      flash = 0.45; flashColor = C.ink; if (!reduceMotion) shake = 9;
      if (lives <= 0) { gameOver(); return; }
      announce('Missed the bench. ' + lives + (lives === 1 ? ' try' : ' tries') + ' left.');
      showBanner(lives === 1 ? 'Last try' : 'Missed', C.sand);
      spawnMover(Math.random() < 0.5);
      return;
    }

    var seat;
    if (Math.abs(f.x - b.x) <= perfectTol && Math.abs(f.w - b.w) <= perfectTol) {
      // Perfect landing: snap to the seat below and win some width back.
      seat = { x: b.x, w: Math.min(b.w + 10, baseW), top: f.target, perfect: true };
      setStreak(streak + 1); perfectTotal++;
      flash = 0.35; flashColor = C.yellow;
      burst(seat.x + seat.w / 2, seat.top + camY, [C.yellow, C.teal, C.ink, C.yellowSoft], reduceMotion ? 6 : 18);
      showBanner(streak >= 2 ? 'Perfect ×' + streak : 'Perfect!', C.yellow);
      announce('Perfect landing.');
    } else {
      // Trim the overhang; the offcut falls away.
      seat = { x: left, w: overlap, top: f.target, perfect: false };
      var cutW = f.w - overlap;
      var cutX = f.x < b.x ? f.x : right;
      debris.push({ x: cutX, w: cutW, top: f.target, vx: f.x < b.x ? -90 : 90, vy: -40, rot: 0, vr: f.x < b.x ? -2.5 : 2.5, life: 0 });
      setStreak(0);
      burst(cutX + cutW / 2, f.target + camY + BLOCK_H / 2, [C.line, C.sand, C.inkSoft], reduceMotion ? 4 : 8);
    }
    stack.push(seat);
    setSeats(seats + 1);
    if (seats === 5) showBanner('Five up', C.teal);
    else if (seats === 10) showBanner('Ten seats!', C.teal);
    else if (seats === 15) showBanner('Crossbench!', C.yellow);
    else if (seats === 20) showBanner('Balance of power', C.yellow);
    else if (seats > 20 && seats % 10 === 0) showBanner(seats + ' seats', C.teal);
    if (seat.w < minW) announce('The bench is very narrow now.');
    camTarget = Math.max(0, H * 0.5 - seat.top);
    if (reduceMotion) camY = camTarget;
    spawnMover(Math.random() < 0.5);
  }

  // ---- input --------------------------------------------------------------
  stage.addEventListener('pointerdown', function (e) {
    if (state !== 'playing') return;
    var t = e.target;
    if (t && t.closest && t.closest('button, a')) return;
    drop();
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    var idle = document.activeElement === document.body || document.activeElement === stage;
    if (state === 'playing') {
      if (k === ' ' || k === 'Enter' || k === 'ArrowDown') { if (idle) { drop(); e.preventDefault(); } }
      else if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); e.preventDefault(); }
    } else if (state === 'paused') {
      if (k === 'p' || k === 'P' || k === 'Escape' || (idle && k === ' ')) { togglePause(); e.preventDefault(); }
    } else if ((state === 'attract' || state === 'over') && idle && (k === ' ' || k === 'Enter')) {
      start(); e.preventDefault();
    }
  });

  if (elPlay) elPlay.addEventListener('click', start);
  if (elAgain) elAgain.addEventListener('click', start);
  if (elPause) elPause.addEventListener('click', togglePause);
  if (elResume) elResume.addEventListener('click', togglePause);

  // ---- update -------------------------------------------------------------
  function update(dt) {
    if (state === 'attract') attractT += dt;

    // the sliding seat (also slides in attract mode, as a demo)
    if (mover && (state === 'playing' || state === 'attract')) {
      var margin = 10;
      mover.x += mover.dir * mover.speed * dt;
      if (mover.x <= margin) { mover.x = margin; mover.dir = 1; }
      if (mover.x + mover.w >= W - margin) { mover.x = W - margin - mover.w; mover.dir = -1; }
    }

    // the falling seat
    if (faller) {
      faller.vy += 2600 * dt;
      faller.top += faller.vy * dt;
      if (faller.top >= faller.target) { faller.top = faller.target; land(); }
    }

    // camera
    if (!reduceMotion) camY = lerp(camY, camTarget, Math.min(1, dt * 6));
    else camY = camTarget;

    // debris
    for (var d = debris.length - 1; d >= 0; d--) {
      var p = debris[d];
      p.life += dt; p.vy += 1800 * dt; p.x += p.vx * dt; p.top += p.vy * dt; p.rot += p.vr * dt;
      if (p.top + camY > H + 80 || p.life > 2.5) debris.splice(d, 1);
    }

    // particles
    for (var j = particles.length - 1; j >= 0; j--) {
      var pt = particles[j];
      pt.life += dt;
      if (pt.life >= pt.max) { particles.splice(j, 1); continue; }
      pt.vy += 520 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.vr * dt;
    }

    // fx decay
    if (shake > 0) shake = Math.max(0, shake - dt * 34);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (banner) { banner.t += dt; if (banner.t >= banner.dur) banner = null; }
  }

  // ---- drawing ------------------------------------------------------------
  function roundRect(x, y, w, h, rad) {
    var r = Math.max(0, Math.min(rad, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function bg() {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    // faint dotted grid — editorial "paper", scrolling gently with the camera
    ctx.fillStyle = C.line;
    var gap = 26, r = 1.1, off = ((camY * 0.35) % gap + gap) % gap;
    ctx.globalAlpha = 0.55;
    for (var y = off; y < H; y += gap) for (var x = gap; x < W; x += gap) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawBench() {
    var y = BASE_Y + camY;
    var x = (W - baseW) / 2;
    // the floor line
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, y + BLOCK_H + 18); ctx.lineTo(W - 14, y + BLOCK_H + 18); ctx.stroke();
    // the bench itself — yellow cushion, ink frame, the AD icon centred
    ctx.fillStyle = C.yellow; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    roundRect(x, y, baseW, BLOCK_H + 8, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink;
    roundRect(x + 8, y + BLOCK_H - 2, baseW - 16, 6, 3); ctx.fill();
    var s = BLOCK_H - 10;
    if (adReady) ctx.drawImage(adImg, x + baseW / 2 - s / 2, y + 4, s, s);
    // bench legs
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 14, y + BLOCK_H + 8, 8, 10);
    ctx.fillRect(x + baseW - 22, y + BLOCK_H + 8, 8, 10);
  }
  function drawSeat(x, top, w, perfect, ghost) {
    var y = top + camY;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.9;
    // seat body
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    roundRect(x, y, w, BLOCK_H, 6); ctx.fill(); ctx.stroke();
    // cushion band
    ctx.fillStyle = perfect ? C.teal : C.yellow;
    roundRect(x + 3, y + 3, w - 6, Math.max(4, BLOCK_H * 0.32), 4); ctx.fill();
    // ballot lines
    if (w > 40) {
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      var ly = y + BLOCK_H * 0.62;
      ctx.beginPath(); ctx.moveTo(x + 9, ly); ctx.lineTo(x + w - 9, ly); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 9, ly + 7); ctx.lineTo(x + Math.min(w - 9, w * 0.6), ly + 7); ctx.stroke();
    }
    // a teal tick on perfect seats
    if (perfect && w > 30) {
      ctx.strokeStyle = C.tealInk; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      var tx = x + w - 16, ty = y + BLOCK_H * 0.66;
      ctx.beginPath(); ctx.moveTo(tx - 6, ty); ctx.lineTo(tx - 2, ty + 4); ctx.lineTo(tx + 6, ty - 5); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
  function drawGuides() {
    if (!mover || state !== 'playing') return;
    var t = topBlock() || { x: (W - baseW) / 2, w: baseW, top: BASE_Y };
    var yTop = mover.top + BLOCK_H + camY, yBot = t.top + camY;
    ctx.save();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = C.tealDeep; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mover.x, yTop); ctx.lineTo(mover.x, yBot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mover.x + mover.w, yTop); ctx.lineTo(mover.x + mover.w, yBot); ctx.stroke();
    ctx.restore();
  }
  function drawDebris() {
    for (var i = 0; i < debris.length; i++) {
      var p = debris[i];
      ctx.save();
      ctx.globalAlpha = clamp(1 - p.life / 2.2, 0, 1);
      ctx.translate(p.x + p.w / 2, p.top + camY + BLOCK_H / 2); ctx.rotate(p.rot);
      ctx.fillStyle = C.sand; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2;
      roundRect(-p.w / 2, -BLOCK_H / 2, p.w, BLOCK_H, 5); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
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
  function drawBanner() {
    if (!banner) return;
    var t = banner.t / banner.dur;
    var ease = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    ctx.save();
    ctx.globalAlpha = clamp(ease, 0, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = DISPLAY.replace('%s', String(Math.round(clamp(W * 0.06, 24, 40))));
    var m = ctx.measureText(banner.text), bw = m.width + 34, by = H * 0.26;
    ctx.fillStyle = banner.color; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    roundRect(W / 2 - bw / 2, by - 24, bw, 48, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(banner.text, W / 2, by + 1);
    ctx.restore();
  }
  function drawHeightMark() {
    // a small rule on the left showing the tower's height in seats
    if (state !== 'playing' || !stack.length) return;
    ctx.save();
    ctx.font = "700 11px 'Public Sans Variable',system-ui,sans-serif";
    ctx.fillStyle = C.inkSoft; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var i = 4; i < stack.length; i += 5) {
      var y = stack[i].top + camY + BLOCK_H / 2;
      if (y < 40 || y > H - 20) continue;
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(22, y); ctx.stroke();
      ctx.fillText(String(i + 1), 26, y);
    }
    ctx.restore();
  }
  function draw() {
    var sx = 0, sy = 0;
    if (shake > 0 && !reduceMotion) { sx = rand(-shake, shake); sy = rand(-shake, shake); }
    ctx.save();
    ctx.translate(sx, sy);
    bg();
    drawBench();
    for (var i = 0; i < stack.length; i++) drawSeat(stack[i].x, stack[i].top, stack[i].w, stack[i].perfect, false);
    drawDebris();
    drawGuides();
    if (mover) drawSeat(mover.x, mover.top, mover.w, false, true);
    if (faller) drawSeat(faller.x, faller.top, faller.w, false, false);
    drawHeightMark();
    drawParticles();
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
  function seedAttract() {
    // A little demo bench behind the start card: a few seats already stacked.
    stack = [];
    var x = (W - baseW) / 2, w = baseW;
    var n = 5;
    for (var i = 0; i < n; i++) {
      var shift = (i % 2 ? -1 : 1) * Math.round(w * 0.06);
      x = clamp(x + shift, 10, W - 10 - w); w = Math.max(minW, w - Math.abs(shift));
      stack.push({ x: x, w: w, top: BASE_Y - (i + 1) * BLOCK_H, perfect: i === 2 });
    }
    seats = 0; camY = 0; camTarget = 0;
    spawnMover(false);
    mover.speed = 120;
  }
  function start() {
    fit();
    state = 'playing';
    stack = []; debris = []; particles = []; banner = null; faller = null;
    camY = 0; camTarget = 0; shake = 0; flash = 0; perfectTotal = 0;
    setSeats(0); setLives(LIVES); setStreak(0);
    if (elStart) elStart.hidden = true;
    if (elOver) elOver.hidden = true;
    if (elPaused) elPaused.hidden = true;
    if (elPause) elPause.hidden = false;
    spawnMover(false);
    stage.setAttribute('tabindex', '0');
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
    announce('Game started. Press space, or tap the chamber, to drop each seat onto the bench. Three misses end the sitting.');
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
    if (s >= 20) return ['Balance of power', 'A crossbench tall enough to make the big parties negotiate. Superb.'];
    if (s >= 12) return ['Elected!', 'A strong, steady bench. The house is in good hands.'];
    if (s >= 6) return ['On the ballot', 'A solid start — a few more perfect landings and you’re in.'];
    return ['Every seat counts', 'The bench is the hard part. Give it another sitting?'];
  }
  function gameOver() {
    state = 'over';
    mover = null; faller = null;
    if (elPause) elPause.hidden = true;
    if (elPaused) elPaused.hidden = true;
    var isBest = seats > best;
    if (isBest) { best = seats; saveBest(best); }
    var v = verdictFor(seats);
    if (elVerdict) elVerdict.textContent = v[0];
    if (elFinal) elFinal.textContent = seats;
    if (elUnit) elUnit.textContent = seats === 1 ? 'seat on the bench' : 'seats on the bench';
    if (elOverMsg) {
      elOverMsg.textContent = (isBest ? 'New personal best! ' : 'Your best: ' + best + '. ') +
        (perfectTotal ? perfectTotal + ' perfect landing' + (perfectTotal === 1 ? '' : 's') + '. ' : '') + v[1];
    }
    if (elOver) elOver.hidden = false;
    if (elAgain) { try { elAgain.focus({ preventScroll: true }); } catch (e) {} }
    burst(W / 2, H * 0.4, [C.yellow, C.teal, C.ink, C.yellowSoft], reduceMotion ? 10 : 36);
    announce('Sitting over. ' + seats + (seats === 1 ? ' seat' : ' seats') + ' on the bench. ' + v[0] + '. ' + v[1]);
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
    resizeT = setTimeout(function () {
      var oldBase = BASE_Y;
      fit();
      // keep the tower standing on the (re-measured) bench
      var dy = BASE_Y - oldBase;
      for (var i = 0; i < stack.length; i++) stack[i].top += dy;
      if (mover) { mover.top += dy; mover.x = clamp(mover.x, 10, Math.max(10, W - 10 - mover.w)); }
      if (faller) { faller.top += dy; faller.target += dy; }
      if (state === 'attract') seedAttract();
      else if (stack.length) { camTarget = Math.max(0, H * 0.5 - topY()); camY = camTarget; }
    }, 120);
  });

  // ---- boot ---------------------------------------------------------------
  section.hidden = false;                 // reveal the section (progressive enhancement)
  section.classList.add('tg-on');
  if (elPlayLink) elPlayLink.hidden = false;
  if (elBest && best > 0) { elBest.textContent = best; if (elBestLine) elBestLine.hidden = false; }
  fit();
  seedAttract();
  state = 'attract';
  startLoop();
})();
