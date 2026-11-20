/*
 * Keystatic link guard - flags links typed without a scheme.
 *
 * On 2026-10-15 an editor published a podcast episode whose show notes linked to
 * `www.vic.democrats.org.au` and `www.democrats.org.au` with no `https://`. A
 * browser treats those as RELATIVE paths, so the rendered page linked to
 * /podcasts/<slug>/www.vic.democrats.org.au - a 404. The deploy gate's link check
 * (scripts/check-dist.mjs) correctly refused to release, production stayed on the
 * previous version, every later editor publish was blocked by the same two links
 * until a developer fixed them two days later, and nobody was told. This script
 * is the editor-facing half of the fix (the gate's failure alert is the other).
 *
 * Keystatic in GitHub storage mode commits from the browser (GraphQL
 * createCommitOnBranch with base64 file contents; REST contents PUT as a
 * fallback; local storage mode POSTs the same additions to /api/keystatic/update),
 * so the check runs here, in the same place as the image guard: wrap
 * window.fetch inside the /keystatic admin, decode every text file about to be
 * committed, and BLOCK the save with a plain-English list of the links to fix
 * when any link target
 *   - starts with `www.`                      (www.democrats.org.au)
 *   - is a bare domain, with or without a path (vic.democrats.org.au/join)
 *   - is an email address with no `mailto:`   (info@democrats.org.au)
 * Site paths (/join), anchors (#top), relative files (policy.pdf), full URLs and
 * mailto:/tel: links are all left alone. Only link TARGETS are read - markdown
 * `[label](target)`, HTML `href="..."`, and `href`/`url`/`link` keys in JSON and
 * frontmatter - never the prose.
 *
 * Fail-open by design, like the image guard: anything this script cannot
 * positively judge passes straight through, and the deploy gate still stands
 * behind it. Injected into the Keystatic admin HTML by src/middleware.ts; never
 * loaded on public pages. The pure detector is exposed on window.__adLinkGuard
 * so scripts/link-guard.test.mjs can unit-test it under Node. The file is kept pure
 * ASCII (\uXXXX escapes for typographic quotes): a script served without a charset
 * is decoded with the page's default, and the dev server rendered curly quotes as
 * mojibake in the dialog.
 */
(function () {
  'use strict';
  if (window.__adLinkGuardInstalled) return;
  window.__adLinkGuardInstalled = true;

  // Text files whose link targets are checked.
  var TEXT_EXT = /\.(md|mdoc|markdoc|mdx|json|ya?ml)$/i;

  // A first path segment ending in one of these is a relative FILE, not a domain.
  var FILE_EXT = {
    html: 1, htm: 1, pdf: 1, md: 1, txt: 1, jpg: 1, jpeg: 1, png: 1, webp: 1, gif: 1,
    svg: 1, ico: 1, json: 1, xml: 1, csv: 1, mp3: 1, mp4: 1, m4a: 1, webm: 1, doc: 1,
    docx: 1, xls: 1, xlsx: 1, ppt: 1, pptx: 1, zip: 1, ics: 1, vcf: 1, rss: 1, php: 1,
  };

  // Decide whether one link target was typed without its scheme.
  // Returns null (fine) or { reason: 'www' | 'bare-domain' | 'email' }.
  function classify(target) {
    if (typeof target !== 'string') return null;
    var t = target.trim();
    if (t.charAt(0) === '<' && t.charAt(t.length - 1) === '>') t = t.slice(1, -1).trim();
    if (!t) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // https:, mailto:, tel:, sms: ...
    if (/^(\/|#|\?|\.)/.test(t)) return null;        // site path, anchor, query, ./relative
    if (/^\{/.test(t)) return null;                  // template placeholder
    if (/^[^\s@\/?#]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(t)) return { reason: 'email' };
    var host = t.split(/[\/?#]/)[0].toLowerCase();
    if (host.indexOf('www.') === 0) return { reason: 'www' };
    var labels = host.split('.');
    if (labels.length < 2) return null;
    for (var i = 0; i < labels.length; i++) {
      if (!/^[a-z0-9-]+$/.test(labels[i])) return null;
    }
    var tld = labels[labels.length - 1];
    if (!/^[a-z]{2,24}$/.test(tld)) return null;
    if (FILE_EXT[tld]) return null;
    return { reason: 'bare-domain' };
  }

  // Pull every link target out of a committed text file. Only targets - never prose.
  function extractTargets(path, text) {
    var out = [];
    var m;
    if (/\.json$/i.test(path)) {
      try {
        walkJson(JSON.parse(text), out);
        return out;
      } catch (e) { /* not valid JSON - fall through to the regexes */ }
    }
    // Markdown inline links / images: [label](target "title") or [label](<target>)
    var inline = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g;
    while ((m = inline.exec(text))) out.push(m[1]);
    // Reference definitions: [id]: target
    var ref = /^[ \t]*\[[^\]]+\]:[ \t]*(\S+)/gm;
    while ((m = ref.exec(text))) out.push(m[1]);
    // Raw HTML in content: href="..."
    var href = /\bhref\s*=\s*["']([^"']*)["']/gi;
    while ((m = href.exec(text))) out.push(m[1]);
    // Frontmatter / YAML keys: href: ..., url: ..., link: ...
    var yaml = /^[ \t]*(?:-[ \t]+)?(?:href|url|link)[ \t]*:[ \t]*["']?([^"'\n#]+)/gim;
    while ((m = yaml.exec(text))) out.push(m[1].trim());
    return out;
  }

  function walkJson(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(function (n) { walkJson(n, out); }); return; }
    Object.keys(node).forEach(function (k) {
      var v = node[k];
      if (typeof v === 'string' && /^(href|url|link|to|target)$/i.test(k)) out.push(v);
      else if (v && typeof v === 'object') walkJson(v, out);
    });
  }

  // { path, text } -> [{ path, target, reason }]
  function findBadLinks(path, text) {
    if (!TEXT_EXT.test(path || '') || typeof text !== 'string') return [];
    var seen = {};
    var bad = [];
    extractTargets(path, text).forEach(function (t) {
      var c = classify(t);
      if (!c) return;
      var key = t.trim();
      if (seen[key]) return;
      seen[key] = true;
      bad.push({ path: path, target: key, reason: c.reason });
    });
    return bad;
  }

  function decodeBase64(b64) {
    try {
      var bin = atob(String(b64 || '').replace(/\s/g, ''));
      if (typeof TextDecoder === 'function') {
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
      }
      return decodeURIComponent(escape(bin));
    } catch (e) { return null; } // undecodable - cannot judge, let it through
  }

  function fixFor(p) {
    var t = p.target.replace(/^<|>$/g, '');
    if (p.reason === 'email') return 'mailto:' + t;
    return 'https://' + t;
  }

  function explain(problems) {
    var lines = problems.map(function (p) {
      var name = p.path.split('/').pop();
      var why = p.reason === 'email'
        ? 'is an email address, but has no \u201cmailto:\u201d in front of it'
        : 'is missing \u201chttps://\u201d at the front';
      return '\u2022  ' + p.target + '\n    ' + why + ' (in ' + name + ').\n    Change it to:  ' + fixFor(p);
    });
    var intro = problems.length > 1
      ? 'Some links on this page are written without their \u201chttps://\u201d, so '
      : 'A link on this page is written without its \u201chttps://\u201d, so ';
    return intro + 'visitors would get a \u201cpage not found\u201d instead of the site you meant:\n\n' +
      lines.join('\n\n') +
      '\n\nNothing has been saved. Edit each link so it starts with https:// (or mailto: for an email ' +
      'address) and click Save again.\n\n(This check protects the website: a link like this breaks for ' +
      'visitors and would block the production deploy for everyone until it is fixed.)';
  }

  function showBlockedMessage(problems) {
    var msg = explain(problems);
    try {
      var el = document.createElement('div');
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('data-adw-link-guard', 'blocked');
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(28,43,41,.7);display:flex;align-items:center;justify-content:center;padding:24px;';
      var box = document.createElement('div');
      box.style.cssText = 'max-width:600px;background:#fffdf7;color:#1c2b29;border:2px solid #1c2b29;box-shadow:6px 6px 0 #1c2b29;border-radius:8px;padding:24px;font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap;max-height:80vh;overflow:auto;';
      var h = document.createElement('div');
      h.textContent = 'Link needs fixing before this can be saved';
      h.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:12px;';
      var body = document.createElement('div');
      body.textContent = msg;
      var btn = document.createElement('button');
      btn.textContent = 'OK, I\u2019ll fix the link';
      btn.style.cssText = 'margin-top:16px;padding:10px 18px;background:#fcd666;color:#1c2b29;border:2px solid #1c2b29;border-radius:6px;font-weight:700;cursor:pointer;box-shadow:3px 3px 0 #1c2b29;';
      btn.onclick = function () { el.remove(); };
      box.appendChild(h); box.appendChild(body); box.appendChild(btn); el.appendChild(box);
      document.body.appendChild(el);
    } catch (e) {
      try { window.alert(msg); } catch (e2) { /* headless */ }
    }
  }

  // Inspect a GitHub write request body. Returns the problems found.
  function collectProblems(url, bodyText) {
    var problems = [];
    var data;
    try { data = JSON.parse(bodyText); } catch (e) { return problems; }
    // GraphQL createCommitOnBranch: variables.input.fileChanges.additions[{path, contents}]
    // Local storage mode (POST /api/keystatic/update): { additions: [{path, contents}], deletions }
    var input = data && data.variables && data.variables.input;
    var additions = (input && input.fileChanges && input.fileChanges.additions) || (data && data.additions);
    if (Array.isArray(additions)) {
      additions.forEach(function (a) {
        if (!a || !TEXT_EXT.test(a.path || '')) return;
        var text = decodeBase64(a.contents);
        if (text !== null) problems = problems.concat(findBadLinks(a.path, text));
      });
    }
    // REST PUT /repos/:owner/:repo/contents/:path - { message, content: base64 }
    if (typeof data.content === 'string' && data.message !== undefined) {
      var urlPath = decodeURIComponent(url.split('/contents/')[1] || '').split('?')[0];
      if (TEXT_EXT.test(urlPath)) {
        var t = decodeBase64(data.content);
        if (t !== null) problems = problems.concat(findBadLinks(urlPath, t));
      }
    }
    return problems;
  }

  window.__adLinkGuard = { classify: classify, findBadLinks: findBadLinks, collectProblems: collectProblems };

  if (typeof window.fetch !== 'function') return;
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var body = init && typeof init.body === 'string' ? init.body : null;
      if (body && (method === 'POST' || method === 'PUT')) {
        var isContentWrite = /api\.github\.com\/graphql/.test(url) ||
          /\/graphql(\?|$)/.test(url) ||
          (/\/repos\/[^/]+\/[^/]+\/contents\//.test(url) && method === 'PUT') ||
          (/\/api\/keystatic\/update(\?|$)/.test(url) && method === 'POST');
        if (isContentWrite) {
          var problems = collectProblems(url, body);
          if (problems.length) {
            showBlockedMessage(problems);
            return Promise.reject(new Error('Save blocked: ' +
              problems.map(function (p) { return p.target + ' needs ' + (p.reason === 'email' ? 'mailto:' : 'https://'); }).join('; ') +
              ' - see the on-screen message.'));
          }
        }
      }
    } catch (e) { /* guard must never break saving - fall through */ }
    return origFetch.apply(this, arguments);
  };
})();
