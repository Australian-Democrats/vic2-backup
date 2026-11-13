/* /admin/campaigns — fundraising campaign-link register. External file because VIC
 * keeps a strict `script-src 'self'` CSP on site pages (no inline scripts). Logic is
 * identical to the parent ausdems-keystatic-workers page's inline script. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var tok = function () { return $('tok').value.trim(); };
  var campaigns = [];
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

  // Mirror of normaliseCampaign() in src/lib/campaigns.ts — preview only, the
  // server's normalisation is authoritative.
  function normalise(raw) {
    return String(raw || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '');
  }
  function donateUrl(slug) { return location.origin + '/donate?campaign=' + encodeURIComponent(slug); }

  $('cname').addEventListener('input', function () {
    var slug = normalise($('cname').value);
    $('preview').textContent = slug ? donateUrl(slug) : '—';
  });

  function copyBtn(text) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-o btn-sm'; b.textContent = 'Copy link';
    b.addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500); })
        .catch(function () { window.prompt('Copy this link:', text); });
    });
    return b;
  }

  function render() {
    var tbody = $('rows'); tbody.textContent = '';
    if (!campaigns.length) {
      var tr = document.createElement('tr'); var td = document.createElement('td');
      td.colSpan = 5; td.className = 'empty'; td.textContent = 'No campaigns yet — create the first one above.';
      tr.appendChild(td); tbody.appendChild(tr); return;
    }
    campaigns.forEach(function (c) {
      var tr = document.createElement('tr');

      var name = document.createElement('td'); name.textContent = c.name;

      var link = document.createElement('td'); link.className = 'slug';
      var url = (c.urls && c.urls.donate) || donateUrl(c.slug);
      link.textContent = url; link.appendChild(document.createElement('br')); link.appendChild(copyBtn(url));

      // Stored as UTC; rendered in THIS computer's local time zone.
      var when = document.createElement('td'); when.className = 'when';
      var d = c.at ? new Date(c.at) : null;
      when.textContent = d && !isNaN(d) ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

      var by = document.createElement('td'); by.textContent = c.by || 'unknown';

      var act = document.createElement('td');
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'btn btn-r btn-sm'; del.textContent = 'Delete…';
      del.addEventListener('click', function () { armDelete(tr, c, del); });
      act.appendChild(del);

      tr.appendChild(name); tr.appendChild(link); tr.appendChild(when); tr.appendChild(by); tr.appendChild(act);
      tbody.appendChild(tr);
    });
  }

  // Two-step delete: an inline WARNING row demanding the word DELETE be typed.
  // The server independently requires confirm:"DELETE" — this is only the UX half.
  function armDelete(afterRow, c, trigger) {
    var existing = document.getElementById('confirmRow');
    if (existing) existing.remove();
    trigger.disabled = true;

    var tr = document.createElement('tr'); tr.id = 'confirmRow';
    var td = document.createElement('td'); td.colSpan = 5;
    var box = document.createElement('div'); box.className = 'confirm';
    var p = document.createElement('p');
    p.appendChild(Object.assign(document.createElement('b'), { textContent: 'Warning:' }));
    p.appendChild(document.createTextNode(' This permanently deletes the campaign "' + c.name + '" from the register. Past payments keep their tag; the link keeps working if it is still being shared. '));
    var note = document.createElement('span'); note.className = 'note';
    note.textContent = 'This action is audited (who, what and when are recorded).';
    p.appendChild(note);

    var inp = document.createElement('input');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.placeholder = 'Type DELETE to confirm';
    inp.setAttribute('aria-label', 'Type DELETE to confirm');

    var btns = document.createElement('div'); btns.className = 'btns'; btns.style.marginTop = '10px';
    var go = document.createElement('button');
    go.type = 'button'; go.className = 'btn btn-rf btn-sm'; go.textContent = 'Delete campaign'; go.disabled = true;
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn-o btn-sm'; cancel.textContent = 'Cancel';
    var msg = document.createElement('div'); msg.className = 'msg';

    inp.addEventListener('input', function () { go.disabled = inp.value.trim() !== 'DELETE'; });
    cancel.addEventListener('click', function () { tr.remove(); trigger.disabled = false; });
    go.addEventListener('click', function () {
      if (inp.value.trim() !== 'DELETE') return;
      go.disabled = true; cancel.disabled = true;
      setMsg(msg, 'Deleting…', '');
      fetch('/admin/delete-campaign', {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ slug: c.slug, confirm: 'DELETE' }),
      })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.s !== 200 || !res.d.ok) { setMsg(msg, res.d && res.d.error ? res.d.error : errText(res.s), 'err'); go.disabled = false; cancel.disabled = false; return; }
          campaigns = campaigns.filter(function (e) { return e.slug !== c.slug; });
          render();
          setMsg($('listMsg'), 'Campaign "' + c.name + '" deleted (audited).', 'ok');
        })
        .catch(function () { setMsg(msg, 'Network error — could not reach the server.', 'err'); go.disabled = false; cancel.disabled = false; });
    });

    btns.appendChild(go); btns.appendChild(cancel);
    box.appendChild(p); box.appendChild(inp); box.appendChild(btns); box.appendChild(msg);
    td.appendChild(box); tr.appendChild(td);
    afterRow.insertAdjacentElement('afterend', tr);
    inp.focus();
  }

  function loadCampaigns() {
    setMsg($('loadMsg'), 'Token accepted ✓ — loading campaigns…', 'ok');
    fetch('/admin/get-campaigns', { headers: headers() })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s !== 200 || !res.d.ok) { setMsg($('loadMsg'), res.d && res.d.error ? res.d.error : errText(res.s), 'err'); return; }
        campaigns = res.d.campaigns || [];
        render();
        $('fsCreate').disabled = false;
        setMsg($('loadMsg'), 'Loaded.', 'ok');
      })
      .catch(function () { setMsg($('loadMsg'), 'Network error — could not reach the server.', 'err'); });
  }

  // Unlock: validate the pasted token (and the Cloudflare Access layer) against
  // the no-op /admin/check-token endpoint BEFORE any real call, then auto-load.
  $('load').addEventListener('click', function () {
    if (!tok()) { setMsg($('loadMsg'), 'Enter the admin token first.', 'err'); return; }
    setMsg($('loadMsg'), 'Checking token…', '');
    fetch('/admin/check-token', { headers: headers() })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s !== 200 || !res.d.ok) { setMsg($('loadMsg'), res.d && res.d.error ? res.d.error : errText(res.s), 'err'); return; }
        loadCampaigns();
      })
      .catch(function () { setMsg($('loadMsg'), 'Network error — could not reach the server.', 'err'); });
  });

  $('createForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!tok()) { setMsg($('createMsg'), 'Enter the admin token first.', 'err'); return; }
    var name = $('cname').value.trim();
    if (!normalise(name)) { setMsg($('createMsg'), 'Enter a campaign name (letters/numbers).', 'err'); return; }
    setMsg($('createMsg'), 'Creating…', '');
    fetch('/admin/save-campaign', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: name }),
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s !== 200 || !res.d.ok) { setMsg($('createMsg'), res.d && res.d.error ? res.d.error : errText(res.s), 'err'); return; }
        campaigns.unshift(res.d.entry);
        render();
        $('cname').value = ''; $('preview').textContent = '—';
        var url = res.d.entry.urls && res.d.entry.urls.donate;
        setMsg($('createMsg'), 'Created ✓ — share ' + url, 'ok');
      })
      .catch(function () { setMsg($('createMsg'), 'Network error — could not reach the server.', 'err'); });
  });
})();
