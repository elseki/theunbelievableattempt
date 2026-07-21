const SITE_VER = 1;

// ── Mobile menu ──
const menuButton = document.querySelector('.menu-button');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');

const backdrop = document.createElement('div');
backdrop.className = 'menu-backdrop';
document.body.appendChild(backdrop);

function toggleMenu(forceClose) {
  const isOpen = forceClose ? false : siteNav.classList.toggle('is-open');
  siteNav.classList.toggle('is-open', isOpen);
  menuButton.classList.toggle('is-open', isOpen);
  backdrop.classList.toggle('is-visible', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

menuButton?.addEventListener('click', () => toggleMenu());
backdrop.addEventListener('click', () => toggleMenu(true));

navLinks.forEach((link) => {
  link.addEventListener('click', () => toggleMenu(true));
});

document.querySelector('#year').textContent = new Date().getFullYear();

// ── Supabase client ──
const supabaseConfig = {
  get url() { return localStorage.getItem('1ma_supabase_url') || ''; },
  get key() { return localStorage.getItem('1ma_supabase_key') || ''; },
};

function supabaseRequest(method, table, opts) {
  if (!supabaseConfig.url || !supabaseConfig.key) return Promise.reject('Supabase not configured');
  var headers = { apikey: supabaseConfig.key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (supabaseConfig.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + supabaseConfig.key;
  var base = supabaseConfig.url.replace(/\/+rest\/v1\/?$/, '');
  var url = base + '/rest/v1/' + table + (opts.query || '');
  return fetch(url, { method: method, headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function(r) { return r.json(); });
}

function supabaseSelect(table) { return supabaseRequest('GET', table, { query: '?select=*' }); }
function supabaseInsert(table, body) { return supabaseRequest('POST', table, { body: body }); }
function supabaseUpdate(table, id, body) { return supabaseRequest('PATCH', table, { query: '?id=eq.' + encodeURIComponent(id), body: body }); }
function supabaseDelete(table, id) { return supabaseRequest('DELETE', table, { query: '?id=eq.' + encodeURIComponent(id) }); }

// ── Data stores (local caches) ──
const __work = { data: [] };
const __now = { data: [] };
const __legacy = { data: [] };
window.__work = __work;
window.__now = __now;
window.__legacy = __legacy;

// ── YouTube oEmbed cache ──
const YT_CACHE_KEY = '1ma_yt_cache';
const ytCache = JSON.parse(localStorage.getItem(YT_CACHE_KEY) || '{}');
let ytFetching = new Set();

function saveYtCache() { localStorage.setItem(YT_CACHE_KEY, JSON.stringify(ytCache)); }

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function fetchYouTubeData(id) {
  if (ytFetching.has(id)) return;
  ytFetching.add(id);
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + id + '&format=json')
    .then(r => r.json())
    .then(data => {
      ytCache[id] = { title: data.title, thumbnail: data.thumbnail_url, author: data.author_name };
      saveYtCache();
      ytFetching.delete(id);
      const active = document.querySelector('.legacy-filter.is-selected');
      renderLegacy(active ? active.dataset.platform : 'all');
    })
    .catch(() => { ytFetching.delete(id); });
}

// ── Content renderer (text + auto-image) ──
function renderContent(text) {
  if (!text) return '';
  const imgRe = /^(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp)(\?\S*)?|data:image\/\S+)$/i;
  return text.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (imgRe.test(trimmed)) return '<div class="content-img"><img src="' + trimmed + '" loading="lazy" alt="" /></div>';
    return '<p>' + trimmed.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>';
  }).filter(Boolean).join('\n');
}

// ── Notes system ──
let notes = [];

const __notes = {
  get data() { return notes; },
  set data(v) { notes = v; },
  format(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
  },
};
window.__notes = __notes;

let activeTag = '';

function renderNotes(filter) {
  const list = document.getElementById('note-list');
  const tagBar = document.getElementById('tag-filter');
  let filtered = filter === 'all' ? notes : notes.filter((n) => n.category === filter);
  if (activeTag) {
    filtered = filtered.filter((n) => n.tag === activeTag);
    if (tagBar) { tagBar.style.display = 'flex'; document.getElementById('tag-filter-name').textContent = activeTag; }
  } else {
    if (tagBar) tagBar.style.display = 'none';
  }
  if (!filtered.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = filtered
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (n) => {
      const body = n.content ? '<div class="note-body">' + renderContent(n.content) + '</div>' : '';
      const tagBadge = n.tag ? '<span class="note-tag-badge">' + n.tag + '</span>' : '';
      return `
    <article class="note-item reveal" data-category="${n.category}" data-id="${n.id}">
      <a href="#contact">
        <time datetime="${n.date}">${__notes.format(n.date)}</time>
        <div>
          <p class="note-type">${n.category.charAt(0).toUpperCase() + n.category.slice(1)}${tagBadge}</p>
          <h3>${n.title}</h3>
          ${body}
        </div>
        <span class="note-arrow" aria-hidden="true">↗</span>
      </a>
      <div class="item-actions">
        <button class="note-edit item-edit" data-id="${n.id}" type="button" aria-label="Edit note" title="Edit note">...</button>
        <button class="note-delete item-delete" data-id="${n.id}" type="button" aria-label="Delete note" title="Delete note">&times;</button>
      </div>
    </article>`; }
    )
    .join('');

  document.querySelectorAll('.note-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.delete(btn.dataset.id);
    });
  });

  document.querySelectorAll('.note-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.editNote(btn.dataset.id);
    });
  });

  document.querySelectorAll('.note-item').forEach((el) => {
    if (el.classList.contains('reveal')) revealObserver.observe(el);
  });
}

function render() {
  const active = document.querySelector('.filter-button.is-selected');
  renderNotes(active ? active.dataset.filter : 'all');
}

// ── Legacy filters ──
document.querySelectorAll('.legacy-filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.legacy-filter').forEach((b) => b.classList.toggle('is-selected', b === btn));
    renderLegacy(btn.dataset.platform);
  });
});

// ── Tag filter ──
document.getElementById('tag-filter-clear')?.addEventListener('click', () => {
  activeTag = '';
  document.querySelector('.filter-button.is-selected')?.click();
});

// ── Filters ──
document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-button').forEach((b) => b.classList.toggle('is-selected', b === button));
    renderNotes(button.dataset.filter);
  });
});

// ── Work renderer ──
function renderWork() {
  const grid = document.getElementById('work-grid');
  const items = __work.data;
  if (!items.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = items.map((w) => {
    const cls = 'project-card' + (w.large ? ' project-card-large' : '') + ' project-' + w.style;
    let extra = '';
    if (w.style === 'sunrise') {
      extra = '<div class="project-orbit" aria-hidden="true">\u2736</div>';
    } else if (w.style === 'moss') {
      extra = '<div class="moss-shape moss-one" aria-hidden="true"></div><div class="moss-shape moss-two" aria-hidden="true"></div>';
    }
    const hasExternal = w.link && w.link !== '#work' && w.link !== '';
    const href = w.tag && !hasExternal ? '#notes' : (w.link || '#work');
    const target = hasExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const tagAttr = w.tag && !hasExternal ? ' data-tag="' + w.tag + '"' : '';
    return '<article class="' + cls + '">' +
      '<a href="' + href + '"' + target + tagAttr + ' aria-label="Explore ' + w.title + '">' +
        '<div class="card-topline"><span>' + w.number + '</span><span>' + w.year + '</span></div>' +
        extra + (w.quote ? '<p class="project-quote">\u201c' + w.quote + '\u201d</p>' : '') +
        '<div class="card-copy">' +
          '<p class="card-label">' + w.label + '</p>' +
          '<h3>' + w.title + '</h3>' +
          '<p>' + w.description + '</p>' +
        '</div>' +
        '<span class="card-arrow" aria-hidden="true">\u2197</span>' +
      '</a>' +
      '<div class="item-actions">' +
        '<button class="work-edit item-edit" data-id="' + w.id + '" type="button" aria-label="Edit work" title="Edit work">...</button>' +
        '<button class="work-delete item-delete" data-id="' + w.id + '" type="button" aria-label="Delete work item" title="Delete">&times;</button>' +
      '</div>' +
    '</article>';
  }).join('');

  document.querySelectorAll('.work-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.deleteWork(btn.dataset.id);
    });
  });

  document.querySelectorAll('.work-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.editWork(btn.dataset.id);
    });
  });

  document.querySelectorAll('#work-grid a[data-tag]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      activeTag = link.dataset.tag;
      document.querySelectorAll('.filter-button').forEach((b) => b.classList.toggle('is-selected', b.dataset.filter === 'all'));
      renderNotes('all');
      document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ── Now renderer ──
function renderNow() {
  const list = document.getElementById('now-list');
  const items = __now.data;
  if (!items.length) { list.innerHTML = ''; return; }
  list.innerHTML = items.map((n) => {
    const desc = n.italic ? '<p><em>' + n.description + '</em></p>' : '<p>' + n.description + '</p>';
    return '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
      '<div><span>' + n.category + '</span>' + desc + '</div>' +
      '<div class="item-actions">' +
        '<button class="now-edit item-edit" data-id="' + n.id + '" type="button" aria-label="Edit now item" title="Edit now">...</button>' +
        '<button class="now-delete item-delete" data-id="' + n.id + '" type="button" aria-label="Delete now item" title="Delete">&times;</button>' +
      '</div>' +
    '</div>';
  }).join('');

  document.querySelectorAll('.now-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.deleteNow(btn.dataset.id);
    });
  });

  document.querySelectorAll('.now-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.editNow(btn.dataset.id);
    });
  });
}

// ── Legacy renderer ──
function renderLegacy(platform) {
  const list = document.getElementById('legacy-list');
  const items = platform && platform !== 'all' ? __legacy.data.filter((l) => l.platform === platform) : __legacy.data;
  if (!items.length) { list.innerHTML = '<p class="legacy-empty">No posts yet.</p>'; return; }
  let needsFetch = false;
  list.innerHTML = items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((l) => {
    const badge = '<span class="legacy-badge ' + l.platform + '">' + l.platform + '</span>';
    const body = l.content ? '<div class="legacy-body">' + renderContent(l.content) + '</div>' : '';

    if (l.platform === 'youtube') {
      const vid = getYouTubeId(l.link);
      const cached = vid ? ytCache[vid] : null;
      if (vid && !cached && !ytFetching.has(vid)) { needsFetch = true; fetchYouTubeData(vid); }
      if (cached) {
        return '<div class="legacy-item legacy-youtube-item">' +
          '<a href="' + l.link + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="legacy-yt-thumb"><img src="' + cached.thumbnail + '" loading="lazy" alt=""></div>' +
            '<div class="legacy-yt-info">' +
              badge +
              '<p class="legacy-title">' + cached.title + ' <small>' + l.date + '</small></p>' +
              (cached.author ? '<p class="legacy-yt-author">' + cached.author + '</p>' : '') +
              body +
            '</div>' +
            '<span class="legacy-arrow" aria-hidden="true">\u2197</span>' +
          '</a>' +
          '<div class="item-actions">' +
            '<button class="legacy-edit item-edit" data-id="' + l.id + '" type="button" aria-label="Edit" title="Edit">...</button>' +
            '<button class="legacy-delete item-delete" data-id="' + l.id + '" type="button" aria-label="Delete">&times;</button>' +
          '</div>' +
        '</div>';
      }
      return '<div class="legacy-item">' +
        '<a href="' + l.link + '" target="_blank" rel="noopener noreferrer">' +
          badge +
          '<div><p class="legacy-title">' + l.title + ' <small>' + l.date + '</small></p>' + body + '</div>' +
          '<span class="legacy-arrow" aria-hidden="true">\u2197</span>' +
        '</a>' +
        '<div class="item-actions">' +
          '<button class="legacy-edit item-edit" data-id="' + l.id + '" type="button" aria-label="Edit" title="Edit">...</button>' +
          '<button class="legacy-delete item-delete" data-id="' + l.id + '" type="button" aria-label="Delete">&times;</button>' +
        '</div>' +
      '</div>';
    }

    return '<div class="legacy-item">' +
      '<a href="' + l.link + '" target="_blank" rel="noopener noreferrer">' +
        badge +
        '<div><p class="legacy-title">' + l.title + ' <small>' + l.date + '</small></p>' + body + '</div>' +
        '<span class="legacy-arrow" aria-hidden="true">\u2197</span>' +
      '</a>' +
      '<div class="item-actions">' +
        '<button class="legacy-edit item-edit" data-id="' + l.id + '" type="button" aria-label="Edit" title="Edit">...</button>' +
        '<button class="legacy-delete item-delete" data-id="' + l.id + '" type="button" aria-label="Delete">&times;</button>' +
      '</div>' +
    '</div>';
  }).join('');

  document.querySelectorAll('.legacy-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.deleteLegacy(btn.dataset.id);
    });
  });

  document.querySelectorAll('.legacy-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__admin) window.__admin.editLegacy(btn.dataset.id);
    });
  });
}

// ── Scroll reveal ──
const revealEls = document.querySelectorAll(
  '.work-section .section-heading, .project-card, .notes-heading, .filters, .now-card, .about-section > *'
);
revealEls.forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);
revealEls.forEach((el) => {
  const idx = [...el.parentElement.children].indexOf(el);
  if (idx > 0 && idx < 5) el.classList.add('reveal-delay-' + idx);
  revealObserver.observe(el);
});

// ── Active nav on scroll ──
const sections = document.querySelectorAll('section[id]');
const navMap = new Map();
sections.forEach((s) => {
  const link = document.querySelector(`.site-nav a[href="#${s.id}"]`);
  if (link) navMap.set(s, link);
});

function updateActiveNav() {
  let current = null;
  const scrollY = window.scrollY + 150;
  for (const [section, link] of navMap) {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    if (scrollY >= top && scrollY < bottom) { current = link; break; }
  }
  navLinks.forEach((l) => l.classList.remove('is-active'));
  if (current) current.classList.add('is-active');
}
window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();

// ── Admin loader ──
function afterAdmin() {
  document.body.classList.add('admin-mode');
  window.__admin.init();
  renderWork();
  renderNow();
  renderLegacy('all');
}

if (window.location.hash === '#1ma-write') {
  const s = document.createElement('script');
  s.src = 'admin_v2.js';
  s.onload = afterAdmin;
  document.head.appendChild(s);
} else {
  let adminLoaded = false;
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#1ma-write' && !adminLoaded) {
      adminLoaded = true;
      const s = document.createElement('script');
      s.src = 'admin_v2.js';
      s.onload = afterAdmin;
      document.head.appendChild(s);
    }
  });
}

// ── Init ──
function initAll() {
  if (supabaseConfig.url && supabaseConfig.key) {
    Promise.all([
      supabaseSelect('notes').then(function(d) { notes = d || []; render(); }).catch(function() {}),
      supabaseSelect('work').then(function(d) { __work.data = d || []; renderWork(); }).catch(function() {}),
      supabaseSelect('now').then(function(d) { __now.data = d || []; renderNow(); }).catch(function() {}),
      supabaseSelect('legacy').then(function(d) { __legacy.data = d || []; renderLegacy('all'); }).catch(function() {}),
    ]);
  } else {
    document.getElementById('note-list').innerHTML = '<p style="font-family:var(--serif);font-size:1.4rem;color:rgba(23,33,29,.4);padding:2rem 0;text-align:center">Connect Supabase to start posting (add hash #1ma-write to configure)</p>';
  }
}
initAll();
