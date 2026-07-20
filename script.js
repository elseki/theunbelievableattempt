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

// ── Data stores ──
function makeStore(key, file) {
  let data = [];
  return {
    get data() { return data; },
    set data(v) { data = v; },
    save() { localStorage.setItem(key, JSON.stringify(data)); },
    load() {
      const stored = localStorage.getItem(key);
      if (stored) { try { data = JSON.parse(stored); return true; } catch (_) {} }
      return false;
    },
    fetchFrom(file) {
      return window.fetch(file).then(r => r.json()).then(d => { data = d; this.save(); }).catch(() => { data = []; });
    },
  };
}

const __work = makeStore('1ma_work', 'work.json');
const __now = makeStore('1ma_now', 'now.json');
const __legacy = makeStore('1ma_legacy', 'legacy.json');
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

// ── Notes system (public: load, display, filter) ──
const STORAGE_KEY = '1ma_notes';
let notes = [];

const __notes = {
  get data() { return notes; },
  set data(v) { notes = v; },
  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); },
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

function loadNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { notes = JSON.parse(stored); } catch (_) {}
  }
  if (!notes.length) {
    fetch('notes.json')
      .then((r) => r.json())
      .then((data) => { notes = data; __notes.save(); render(); })
      .catch(() => { notes = []; render(); });
    return;
  }
  render();
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
        extra + quote +
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

// ── Admin loader (no trace of the hash in the main flow) ──
function afterAdmin() {
  document.body.classList.add('admin-mode');
  window.__admin.init();
  renderWork();
  renderNow();
  renderLegacy('all');
}

if (window.location.hash === '#1ma-write') {
  const s = document.createElement('script');
  s.src = 'admin.js';
  s.onload = afterAdmin;
  document.head.appendChild(s);
} else {
  let adminLoaded = false;
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#1ma-write' && !adminLoaded) {
      adminLoaded = true;
      const s = document.createElement('script');
      s.src = 'admin.js';
      s.onload = afterAdmin;
      document.head.appendChild(s);
    }
  });
}

// ── Init ──
function initAll() {
  loadNotes();
  if (!__work.load()) __work.fetchFrom('work.json').then(() => renderWork());
  else renderWork();
  if (!__now.load()) __now.fetchFrom('now.json').then(() => renderNow());
  else renderNow();
  if (!__legacy.load()) __legacy.fetchFrom('legacy.json').then(() => renderLegacy('all'));
  else renderLegacy('all');
}
initAll();
