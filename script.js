// ── Supabase ──
var sbUrl = function() { return localStorage.getItem('1ma_sb_url') || ''; };
var sbKey = function() { return localStorage.getItem('1ma_sb_key') || ''; };

function sb(method, table, opts) {
  var u = sbUrl(), k = sbKey();
  if (!u || !k) return Promise.reject('no config');
  u = u.replace(/\/+rest\/v1\/?$/, '');
  var h = { apikey: k, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (k.startsWith('eyJ')) h.Authorization = 'Bearer ' + k;
  return fetch(u + '/rest/v1/' + table + (opts.q || ''), { method: method, headers: h, body: opts.body ? JSON.stringify(opts.body) : void 0 }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    return r.json();
  });
}
function sbGet(t) { return sb('GET', t, { q: '?select=*' }); }
function sbAdd(t, b) { return sb('POST', t, { body: b }); }
function sbSet(t, id, b) { return sb('PATCH', t, { q: '?id=eq.' + id, body: b }); }
function sbDel(t, id) { return sb('DELETE', t, { q: '?id=eq.' + id }); }

// ── Stores ──
var posts = [];
var projects = [];
var nowItems = [];
var legacyItems = [];
var links = [];
var activeTag = '';

// ── YouTube cache ──
var ytCache = JSON.parse(localStorage.getItem('1ma_yt') || '{}');
var ytBusy = {};

function ytSave() { localStorage.setItem('1ma_yt', JSON.stringify(ytCache)); }

function ytId(url) {
  var m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function ytFetch(id) {
  if (ytBusy[id]) return;
  ytBusy[id] = true;
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + id + '&format=json').then(function(r) { return r.json(); }).then(function(d) {
    ytCache[id] = { title: d.title, thumb: d.thumbnail_url, author: d.author_name };
    ytSave();
    delete ytBusy[id];
    renderLegacy(document.querySelector('.pfilter.is-selected').dataset.platform);
  }).catch(function() { delete ytBusy[id]; });
}

// ── Content renderer ──
function renderContent(text) {
  if (!text) return '';
  var imgRe = /^(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp)(\?\S*)?|data:image\/\S+)$/i;
  return text.split('\n').map(function(line) {
    line = line.trim();
    if (!line) return '';
    if (imgRe.test(line)) return '<div class="content-img"><img src="' + line + '" loading="lazy" alt=""></div>';
    return '<p>' + line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>';
  }).filter(Boolean).join('\n');
}

function fmtDate(d) {
  var dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
}

// ── Mobile menu ──
var menuBtn = document.getElementById('menu-btn');
var nav = document.getElementById('nav');

menuBtn.addEventListener('click', function() {
  nav.classList.toggle('open');
  menuBtn.classList.toggle('open');
});

nav.querySelectorAll('a').forEach(function(a) {
  a.addEventListener('click', function() { nav.classList.remove('open'); menuBtn.classList.remove('open'); });
});

document.getElementById('year').textContent = new Date().getFullYear();

// ── Nav scroll active ──
var sections = document.querySelectorAll('section[id]');
var navLinks = nav.querySelectorAll('a');

function updateNav() {
  var scrollY = window.scrollY + 150;
  var current = null;
  sections.forEach(function(s) {
    var top = s.offsetTop, bottom = top + s.offsetHeight;
    if (scrollY >= top && scrollY < bottom) { current = s; }
  });
  navLinks.forEach(function(l) { l.classList.remove('active'); });
  if (current) {
    navLinks.forEach(function(l) { if (l.getAttribute('href') === '#' + current.id) l.classList.add('active'); });
  }
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// ── Scroll reveal ──
var revealObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('show'); revealObs.unobserve(e.target); } });
}, { threshold: .12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.project-card, .post-item, .legacy-item, .now-entry, .link-card, .section-head, .about-shell > *').forEach(function(el) {
  el.classList.add('reveal');
  revealObs.observe(el);
});

// ── Tags ──
function buildTagList() {
  var dl = document.getElementById('tag-datalist');
  if (!dl) return;
  var seen = {};
  posts.forEach(function(p) { (p.tags || []).forEach(function(t) { if (t) seen[t] = true; }); });
  projects.forEach(function(p) { (p.tags || []).forEach(function(t) { if (t) seen[t] = true; }); });
  dl.innerHTML = Object.keys(seen).sort().map(function(t) { return '<option value="' + t.replace(/"/g,'&quot;') + '">'; }).join('');
}

// ── Filters ──
document.querySelectorAll('.filter').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter').forEach(function(b) { b.classList.toggle('is-selected', b === btn); });
    renderPosts(btn.dataset.filter);
  });
});

document.querySelectorAll('.pfilter').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.pfilter').forEach(function(b) { b.classList.toggle('is-selected', b === btn); });
    renderLegacy(btn.dataset.platform);
  });
});

document.getElementById('tag-clear').addEventListener('click', function() {
  activeTag = '';
  document.getElementById('tag-bar').style.display = 'none';
  renderProjects();
  renderPosts('all');
});

// ── Render projects ──
function renderProjects() {
  var grid = document.getElementById('project-grid');
  var items = projects;
  if (activeTag) items = items.filter(function(p) { return p.tags && p.tags.indexOf(activeTag) !== -1; });
  if (!items.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = items.map(function(p) {
    var cls = 'project-card ' + p.style + (p.large ? ' large' : '');
    var extra = '';
    if (p.style === 'sunrise') extra = '<div class="orbit" aria-hidden="true">\u2736</div>';
    else if (p.style === 'moss') extra = '<div class="moss-a" aria-hidden="true"></div><div class="moss-b" aria-hidden="true"></div>';
    var tagAttr = p.tags && p.tags.length ? ' data-tags="' + p.tags.join(',') + '"' : '';
    return '<article class="' + cls + '">' +
      '<a href="#posts"' + tagAttr + ' aria-label="' + p.title + '">' +
        '<div class="card-top"><span>' + p.number + '</span><span>' + p.year + '</span></div>' +
        extra + (p.quote ? '<p class="card-quote">\u201c' + p.quote + '\u201d</p>' : '') +
        '<div class="card-body"><p class="mono">' + (p.tags ? p.tags.join(', ') : '') + '</p><h3>' + p.title + '</h3><p>' + p.description + '</p></div>' +
        '<span class="card-arrow" aria-hidden="true">\u2197</span>' +
      '</a>' +
      '<div class="item-actions">' +
        '<button class="pe" data-id="' + p.id + '" type="button" title="Edit">...</button>' +
        '<button class="pd" data-id="' + p.id + '" type="button" title="Delete">&times;</button>' +
      '</div>' +
    '</article>';
  }).join('');

  document.querySelectorAll('.pd').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.del('projects', btn.dataset.id); });
  });
  document.querySelectorAll('.pe').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.edit('projects', btn.dataset.id); });
  });

  document.querySelectorAll('#project-grid a[data-tags]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var tags = link.dataset.tags.split(',');
      if (tags.length) {
        activeTag = tags[0];
        document.getElementById('tag-bar').style.display = 'flex';
        document.getElementById('tag-name').textContent = activeTag;
        renderProjects();
        renderPosts('all');
        document.getElementById('posts').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ── Render posts ──
function renderPosts(filter) {
  var list = document.getElementById('post-list');
  var items = filter === 'all' ? posts : posts.filter(function(p) { return p.category === filter; });
  if (activeTag) items = items.filter(function(p) { return p.tags && p.tags.indexOf(activeTag) !== -1; });
  if (!items.length) { list.innerHTML = ''; return; }
  list.innerHTML = items.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(p) {
    var body = p.content ? '<div class="post-body">' + renderContent(p.content) + '</div>' : '';
    var img = p.featured_image ? '<div class="post-featured"><img src="' + p.featured_image + '" loading="lazy" alt=""></div>' : '';
    var tags = p.tags && p.tags.length ? '<div class="post-tags">' + p.tags.map(function(t) { return '<span class="post-tag">' + t + '</span>'; }).join('') + '</div>' : '';
    return '<article class="post-item reveal">' +
      '<a href="#contact">' +
        '<time class="post-meta" datetime="' + p.date + '">' + fmtDate(p.date) + '</time>' +
        '<div><p class="post-cat">' + p.category + '</p><h3>' + p.title + '</h3>' + body + img + tags + '</div>' +
        '<span class="post-arrow" aria-hidden="true">\u2197</span>' +
      '</a>' +
      '<div class="item-actions">' +
        '<button class="pe" data-id="' + p.id + '" type="button" title="Edit">...</button>' +
        '<button class="pd" data-id="' + p.id + '" type="button" title="Delete">&times;</button>' +
      '</div>' +
    '</article>';
  }).join('');

  document.querySelectorAll('.post-item .pd').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.del('posts', btn.dataset.id); });
  });
  document.querySelectorAll('.post-item .pe').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.edit('posts', btn.dataset.id); });
  });
}

// ── Render legacy ──
function renderLegacy(platform) {
  var list = document.getElementById('legacy-list');
  var items = platform && platform !== 'all' ? legacyItems.filter(function(l) { return l.platform === platform; }) : legacyItems;
  if (!items.length) { list.innerHTML = '<p class="legacy-empty">No posts yet.</p>'; return; }
  list.innerHTML = items.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(l) {
    var badge = '<span class="legacy-badge ' + l.platform + '">' + l.platform + '</span>';
    var body = l.content ? '<div class="legacy-body">' + renderContent(l.content) + '</div>' : '';
    if (l.platform === 'youtube') {
      var vid = ytId(l.link);
      var cached = vid ? ytCache[vid] : null;
      if (vid && !cached && !ytBusy[vid]) ytFetch(vid);
      if (cached) {
        return '<div class="legacy-item legacy-youtube"><a href="' + l.link + '" target="_blank" rel="noopener">' +
          '<div class="legacy-yt-thumb"><img src="' + cached.thumb + '" loading="lazy" alt=""></div>' +
          '<div class="legacy-yt-info">' + badge + '<p class="legacy-title">' + cached.title + ' <small>' + l.date + '</small></p>' +
          (cached.author ? '<p class="legacy-yt-author">' + cached.author + '</p>' : '') + body + '</div>' +
          '<span class="legacy-arrow" aria-hidden="true">\u2197</span></a>' +
          '<div class="item-actions"><button class="le" data-id="' + l.id + '" type="button" title="Edit">...</button><button class="ld" data-id="' + l.id + '" type="button" title="Delete">&times;</button></div></div>';
      }
    }
    return '<div class="legacy-item">' +
      '<a href="' + l.link + '" target="_blank" rel="noopener">' + badge + '<div><p class="legacy-title">' + l.title + ' <small>' + l.date + '</small></p>' + body + '</div><span class="legacy-arrow" aria-hidden="true">\u2197</span></a>' +
      '<div class="item-actions"><button class="le" data-id="' + l.id + '" type="button" title="Edit">...</button><button class="ld" data-id="' + l.id + '" type="button" title="Delete">&times;</button></div></div>';
  }).join('');

  document.querySelectorAll('.ld').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.del('legacy', btn.dataset.id); });
  });
  document.querySelectorAll('.le').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.edit('legacy', btn.dataset.id); });
  });
}

// ── Render now ──
function renderNow() {
  var list = document.getElementById('now-list');
  if (!nowItems.length) { list.innerHTML = ''; return; }
  list.innerHTML = nowItems.map(function(n) {
    var desc = n.italic ? '<p><em>' + n.description.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</em></p>' : renderContent(n.description);
    return '<div class="now-entry">' +
      '<p class="now-entry-cat">' + n.category + '</p>' + desc +
      '<div class="item-actions">' +
        '<button class="ne" data-id="' + n.id + '" type="button" title="Edit">...</button>' +
        '<button class="nd" data-id="' + n.id + '" type="button" title="Delete">&times;</button>' +
      '</div></div>';
  }).join('');

  document.querySelectorAll('.nd').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.del('now', btn.dataset.id); });
  });
  document.querySelectorAll('.ne').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.edit('now', btn.dataset.id); });
  });
}

// ── Render links ──
function renderLinks() {
  var grid = document.getElementById('links-grid');
  if (!links.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = links.map(function(l) {
    return '<div class="link-card"><a href="' + l.url + '" target="_blank" rel="noopener">' +
      '<p class="mono">' + (l.category || 'link') + '</p><h3>' + l.title + ' <span class="link-arrow">\u2197</span></h3></a>' +
      '<div class="item-actions">' +
        '<button class="lke" data-id="' + l.id + '" type="button" title="Edit">...</button>' +
        '<button class="lkd" data-id="' + l.id + '" type="button" title="Delete">&times;</button>' +
      '</div></div>';
  }).join('');

  document.querySelectorAll('.lkd').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.del('links', btn.dataset.id); });
  });
  document.querySelectorAll('.lke').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); if (window.__admin) window.__admin.edit('links', btn.dataset.id); });
  });
}

// ── Admin loader ──
function bootAdmin() {
  document.body.classList.add('admin');
  window.__admin.init();
  renderProjects();
  renderNow();
  renderLegacy('all');
  renderLinks();
}

if (location.hash === '#1ma-write') {
  var s = document.createElement('script');
  s.src = 'admin.js';
  s.onload = bootAdmin;
  document.head.appendChild(s);
} else {
  var loaded = false;
  window.addEventListener('hashchange', function() {
    if (location.hash === '#1ma-write' && !loaded) {
      loaded = true;
      var s = document.createElement('script');
      s.src = 'admin.js';
      s.onload = bootAdmin;
      document.head.appendChild(s);
    }
  });
}

// ── Init ──
function init() {
  if (sbUrl() && sbKey()) {
    Promise.all([
      sbGet('posts').then(function(d) { posts = d || []; renderPosts('all'); }).catch(function() {}),
      sbGet('projects').then(function(d) { projects = d || []; renderProjects(); }).catch(function() {}),
      sbGet('now').then(function(d) { nowItems = d || []; renderNow(); }).catch(function() {}),
      sbGet('legacy').then(function(d) { legacyItems = d || []; renderLegacy('all'); }).catch(function() {}),
      sbGet('links').then(function(d) { links = d || []; renderLinks(); }).catch(function() {}),
    ]).then(function() { buildTagList(); });
  } else {
    document.getElementById('post-list').innerHTML = '<p style="font-family:var(--serif);font-size:1.4rem;color:rgba(23,33,29,.4);padding:2rem 0;text-align:center">Connect Supabase to start (add #1ma-write to configure)</p>';
  }
}
init();
