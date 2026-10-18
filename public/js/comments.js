/* Cava Games — comments.js. Dimuat lazy oleh main.js saat bagian komentar terlihat (atau tombol ditekan).
   Semua teks pengguna dirender dengan textContent / node teks (tidak pernah innerHTML); tautan dibuat lewat DOM
   dengan rel="nofollow ugc noopener". Gagal API (kuota habis, jaringan) = pesan ramah, halaman tetap jalan. */
(function () {
  'use strict';

  var NAME_KEY = 'cava:comment-name';
  var LINK_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
  var MSG = {
    loadFail: 'Comments are unavailable right now.',
    sendFail: 'Could not send your comment. Please try again later.',
    rate: 'You are commenting too fast. Please wait a minute and try again.',
    pending: 'Thanks! Your comment is awaiting moderation and will appear once approved.',
    empty: 'No comments yet. Be the first to comment.',
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function field(id, label, control) {
    var wrap = el('div', 'comment-field');
    var lab = el('label', 'comment-label', label);
    lab.setAttribute('for', id);
    control.id = id;
    wrap.appendChild(lab);
    wrap.appendChild(control);
    return wrap;
  }
  function getName() { try { return window.localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function setName(v) { try { window.localStorage.setItem(NAME_KEY, v); } catch (e) { /* diabaikan */ } }

  function formatDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    try { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' }); }
    catch (e) { return d.toLocaleDateString('en-US'); }
  }

  /* Teks → node: URL http(s)/www menjadi <a> aman; selebihnya node teks. */
  function linkify(text) {
    var frag = document.createDocumentFragment();
    var parts = String(text).split(LINK_RE);
    parts.forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 0) { frag.appendChild(document.createTextNode(part)); return; }
      var m = /[.,;:!?)\]]+$/.exec(part);
      var trail = m ? m[0] : '';
      var url = trail ? part.slice(0, -trail.length) : part;
      var href = /^www\./i.test(url) ? 'https://' + url : url;
      var ok = false;
      try { var u = new URL(href); ok = u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { ok = false; }
      if (!ok) { frag.appendChild(document.createTextNode(part)); return; }
      var a = el('a', null, url);
      a.href = href;
      a.rel = 'nofollow ugc noopener';
      a.target = '_blank';
      frag.appendChild(a);
      if (trail) frag.appendChild(document.createTextNode(trail));
    });
    return frag;
  }

  /* Satu tingkat balasan: balasan atas balasan dipasang ke komentar induk teratas. */
  function group(comments) {
    var byId = {};
    comments.forEach(function (c) { byId[c.id] = c; });
    function rootOf(c) {
      var cur = c, guard = 0;
      while (cur.parentId && byId[cur.parentId] && guard++ < 5) cur = byId[cur.parentId];
      return cur.parentId && !byId[cur.parentId] ? null : cur;
    }
    var tops = [], replies = {};
    comments.forEach(function (c) {
      if (!c.parentId) { tops.push(c); return; }
      var root = rootOf(c);
      if (!root || root === c) { tops.push(c); return; }
      (replies[root.id] = replies[root.id] || []).push(c);
    });
    return { tops: tops, replies: replies };
  }

  function init(root) {
    if (root.getAttribute('data-comments-ready')) return;
    root.setAttribute('data-comments-ready', 'true');
    var slug = root.getAttribute('data-comments-slug');
    var body = root.querySelector('[data-comments-body]');
    var title = root.querySelector('.comments-title');
    body.textContent = '';

    var status = el('p', 'comments-status');
    status.setAttribute('role', 'status');
    var list = el('ol', 'comment-list');
    var formBox = el('div', 'comment-form-box');
    body.appendChild(status);
    body.appendChild(list);
    body.appendChild(formBox);

    var parent = null; // { id, name }
    var textarea, nameInput, replyNote, submit;

    function setStatus(msg, isError) {
      status.textContent = msg || '';
      status.classList.toggle('is-error', !!isError);
    }
    function setReply(c) {
      parent = c ? { id: c.id, name: c.name } : null;
      replyNote.hidden = !c;
      replyNote.querySelector('span').textContent = c ? 'Replying to ' + c.name : '';
      if (c) { formBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); textarea.focus(); }
    }

    function commentEl(c, isReply) {
      var li = el('li', 'comment' + (isReply ? ' comment--reply' : ''));
      li.id = 'comment-' + c.id;
      var head = el('div', 'comment-head');
      head.appendChild(el('strong', 'comment-name', c.name));
      var time = el('time', 'comment-date', formatDate(c.createdAt));
      time.setAttribute('datetime', new Date(c.createdAt).toISOString());
      head.appendChild(time);
      li.appendChild(head);
      var text = el('p', 'comment-text');
      text.appendChild(linkify(c.text));
      li.appendChild(text);
      var btn = el('button', 'comment-reply', 'Reply');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Reply to ' + c.name);
      btn.addEventListener('click', function () { setReply(c); });
      li.appendChild(btn);
      return li;
    }
    function renderList(comments) {
      list.textContent = '';
      if (title) title.textContent = comments.length ? 'Comments (' + comments.length + ')' : 'Comments';
      if (!comments.length) { setStatus(MSG.empty, false); return; }
      setStatus('', false);
      var g = group(comments);
      g.tops.forEach(function (c) {
        var li = commentEl(c, false);
        var rs = g.replies[c.id];
        if (rs && rs.length) {
          var sub = el('ol', 'comment-list comment-list--replies');
          rs.forEach(function (r) { sub.appendChild(commentEl(r, true)); });
          li.appendChild(sub);
        }
        list.appendChild(li);
      });
    }

    function buildForm() {
      var form = el('form', 'comment-form');
      form.noValidate = false;
      var h = el('h3', 'comment-form-title', 'Leave a comment');
      replyNote = el('p', 'comment-replying');
      replyNote.hidden = true;
      replyNote.appendChild(el('span'));
      var cancel = el('button', 'comment-cancel', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { setReply(null); });
      replyNote.appendChild(cancel);

      nameInput = el('input', 'comment-input');
      nameInput.type = 'text'; nameInput.name = 'name'; nameInput.required = true; nameInput.maxLength = 40;
      nameInput.autocomplete = 'nickname'; nameInput.value = getName();
      textarea = el('textarea', 'comment-input comment-textarea');
      textarea.name = 'text'; textarea.required = true; textarea.rows = 4; textarea.maxLength = 1000; textarea.minLength = 2;

      var hp = el('div', 'comment-hp');
      hp.setAttribute('aria-hidden', 'true');
      var hpInput = el('input');
      hpInput.type = 'text'; hpInput.name = 'website'; hpInput.tabIndex = -1; hpInput.autocomplete = 'off';
      var hpLabel = el('label', null, 'Website ');
      hpLabel.appendChild(hpInput);
      hp.appendChild(hpLabel);

      var hint = el('p', 'comment-hint', 'Plain text only. Comments are reviewed before they appear.');
      submit = el('button', 'btn comment-submit', 'Post comment');
      submit.type = 'submit';
      var result = el('p', 'comment-result');
      result.setAttribute('role', 'status');

      form.appendChild(h);
      form.appendChild(replyNote);
      form.appendChild(field('comment-name-' + slug, 'Name', nameInput));
      form.appendChild(field('comment-text-' + slug, 'Comment', textarea));
      form.appendChild(hp);
      form.appendChild(hint);
      form.appendChild(submit);
      form.appendChild(result);

      var sending = false;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (sending) return;
        var payload = { slug: slug, name: nameInput.value.trim(), text: textarea.value.trim(), parentId: parent ? parent.id : null, website: hpInput.value };
        if (!payload.name || !payload.text) { result.textContent = 'Please fill in your name and comment.'; result.className = 'comment-result is-error'; return; }
        sending = true; submit.disabled = true; submit.setAttribute('aria-busy', 'true');
        result.textContent = 'Sending…'; result.className = 'comment-result';
        window.fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) {
            if (r.status === 202) {
              setName(payload.name);
              textarea.value = '';
              setReply(null);
              result.textContent = MSG.pending; result.className = 'comment-result is-ok';
              return null;
            }
            return r.json().catch(function () { return {}; }).then(function (d) {
              result.className = 'comment-result is-error';
              result.textContent = r.status === 429 ? MSG.rate : (r.status === 400 && d && d.message) ? d.message : MSG.sendFail;
            });
          })
          .catch(function () { result.textContent = MSG.sendFail; result.className = 'comment-result is-error'; })
          .then(function () { sending = false; submit.disabled = false; submit.removeAttribute('aria-busy'); });
      });
      formBox.textContent = '';
      formBox.appendChild(form);
    }

    function load() {
      setStatus('Loading comments…', false);
      window.fetch('/api/comments?slug=' + encodeURIComponent(slug), { headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (d) {
          if (!d || !Array.isArray(d.comments)) throw new Error('bad payload');
          renderList(d.comments);
          buildForm();
        })
        .catch(function () {
          setStatus(MSG.loadFail, true);
          var retry = el('button', 'btn btn--ghost comment-retry', 'Try again');
          retry.type = 'button';
          retry.addEventListener('click', function () { if (retry.parentNode) retry.parentNode.removeChild(retry); load(); });
          formBox.textContent = '';
          formBox.appendChild(retry);
        });
    }
    load();
  }

  window.CavaComments = { init: init };
})();
