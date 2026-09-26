/* Stripe price-ID editor client (external so VIC's `script-src 'self'` CSP stays
   strict — no inline scripts). Talks to the token-gated /admin/get-prices and
   /admin/save-prices endpoints; the Bearer ADMIN_TOKEN is the real gate. */
(function () {
  'use strict';
  var KEYS = [
    'price_ordinary_once',
    'price_ordinary_recurring',
    'price_concession_once',
    'price_concession_recurring',
    'price_supporter_once',
    'price_supporter_recurring',
  ];
  // Qomon Fundraising price mapping — numeric ids; normally-blank overrides (records
  // auto-match the price live from the workspace catalog).
  var QKEYS = [
    'qomon_price_membership_ordinary',
    'qomon_price_membership_concession',
    'qomon_price_membership_supporter',
    'qomon_price_donation',
  ];
  var $ = function (id) { return document.getElementById(id); };
  var tok = function () { return $('tok').value.trim(); };
  function setMsg(el, text, kind) { el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text; }
  function headers(extra) {
    var h = { Authorization: 'Bearer ' + tok() };
    if (extra) Object.assign(h, extra);
    return h;
  }
  function errText(status) {
    if (status === 401) return 'Unauthorized — wrong admin token.';
    if (status === 403) return 'Forbidden — this origin is not allowed.';
    if (status === 502) return 'Config store unavailable (KV not bound?).';
    return 'Request failed (' + status + ').';
  }

  $('load').addEventListener('click', function () {
    if (!tok()) { setMsg($('loadMsg'), 'Enter the admin token first.', 'err'); return; }
    setMsg($('loadMsg'), 'Loading…', '');
    fetch('/admin/get-prices', { headers: headers() })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s !== 200 || !res.d.ok) { setMsg($('loadMsg'), res.d && res.d.error ? res.d.error : errText(res.s), 'err'); return; }
        KEYS.concat(QKEYS).forEach(function (k) { if ($(k)) $(k).value = (res.d.prices && res.d.prices[k]) || ''; });
        renderCatalog(res.d.qomonCatalog || {});
        $('fs').disabled = false;
        setMsg($('loadMsg'), 'Loaded. Edit the fields below and save.', 'ok');
      })
      .catch(function () { setMsg($('loadMsg'), 'Network error — could not reach the server.', 'err'); });
  });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!tok()) { setMsg($('saveMsg'), 'Enter the admin token first.', 'err'); return; }
    var body = {}; var bad = '';
    KEYS.forEach(function (k) {
      var v = $(k).value.trim(); body[k] = v;
      // Blank = leave that price unset; only validate the format of filled fields.
      if (v && !/^price_[A-Za-z0-9]+$/.test(v)) bad = bad || k;
    });
    if (bad) { setMsg($('saveMsg'), 'Invalid Stripe price ID for "' + bad + '" (must look like price_…).', 'err'); return; }
    QKEYS.forEach(function (k) {
      if (!$(k)) return;
      var v = $(k).value.trim(); body[k] = v;
      if (v && !/^\d+$/.test(v)) bad = bad || k;
    });
    if (bad) { setMsg($('saveMsg'), 'Invalid Qomon price ID for "' + bad + '" (numeric id).', 'err'); return; }
    setMsg($('saveMsg'), 'Saving…', '');
    fetch('/admin/save-prices', { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s !== 200 || !res.d.ok) { setMsg($('saveMsg'), res.d && res.d.error ? res.d.error : errText(res.s), 'err'); return; }
        setMsg($('saveMsg'), 'Saved ✓', 'ok');
      })
      .catch(function () { setMsg($('saveMsg'), 'Network error — could not reach the server.', 'err'); });
  });
  // Render the Qomon workspace's available prices as tables (newest first — the same
  // order auto-match prefers) so the numeric ids mean something.
  function renderCatalog(cat) {
    var mount = $('qomonCatalog');
    if (!mount) return;
    mount.textContent = '';
    function table(title, rows) {
      if (!rows || !rows.length) return null;
      rows = rows.slice().sort(function (a, b) { return Number(b.id) - Number(a.id); });
      var h3 = document.createElement('h3'); h3.textContent = title + ' (' + rows.length + ', newest first)';
      var scroll = document.createElement('div'); scroll.className = 'scroll';
      var t = document.createElement('table');
      var thead = document.createElement('thead'); var hr = document.createElement('tr');
      ['ID', 'Name', 'Amount'].forEach(function (c) { var th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
      thead.appendChild(hr); t.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function (p) {
        var tr = document.createElement('tr');
        var id = document.createElement('td'); id.className = 'id'; id.textContent = p.id;
        var name = document.createElement('td'); name.textContent = p.name || '—';
        var amt = document.createElement('td'); amt.className = 'amt';
        amt.textContent = typeof p.amount === 'number' ? '$' + (p.amount / 100).toFixed(2) : '—';
        tr.appendChild(id); tr.appendChild(name); tr.appendChild(amt); tbody.appendChild(tr);
      });
      t.appendChild(tbody); scroll.appendChild(t);
      var frag = document.createDocumentFragment(); frag.appendChild(h3); frag.appendChild(scroll);
      return frag;
    }
    var m = table('Membership prices in Qomon', cat.memberships);
    var d = table('Donation prices in Qomon', cat.donations);
    if (m) mount.appendChild(m);
    if (d) mount.appendChild(d);
    if (!m && !d) { mount.className = 'hint'; mount.textContent = 'Could not load the Qomon price catalog (check QOMON_API_KEY) — enter ids manually.'; }
  }
})();
