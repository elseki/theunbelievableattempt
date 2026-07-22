// ── Supabase (same as script.js) ──
function sbAdm(method, table, opts) {
  var u = localStorage.getItem('1ma_sb_url') || '', k = localStorage.getItem('1ma_sb_key') || '';
  if (!u || !k) { toast('Supabase not configured'); return Promise.reject('no config'); }
  u = u.replace(/\/+rest\/v1\/?$/, '');
  var h = { apikey: k, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (k.startsWith('eyJ')) h.Authorization = 'Bearer ' + k;
  return fetch(u + '/rest/v1/' + table + (opts.q || ''), { method: method, headers: h, body: opts.body ? JSON.stringify(opts.body) : void 0 }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    return r.json();
  });
}

// ── DOM refs ──
var dlg = document.getElementById('dialog');
var dlgForm = document.getElementById('dialog-form');
var dlgTitle = document.getElementById('dialog-title');
var dlgSave = document.getElementById('dialog-save');
var dlgCancel = document.getElementById('dialog-cancel');
var dlgConfirm = document.getElementById('dialog-confirm');
var confirmYes = document.getElementById('confirm-yes');
var confirmNo = document.getElementById('confirm-no');
var toastEl = document.getElementById('toast');

var currentEdit = null;
var currentDel = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(function() { toastEl.classList.remove('show'); }, 3000);
}

function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function tagsArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

function buildTags() {
  var dl = document.getElementById('tag-datalist');
  if (!dl) return;
  var seen = {};
  (window.posts || []).forEach(function(p) { (p.tags || []).forEach(function(t) { if (t) seen[t] = true; }); });
  (window.projects || []).forEach(function(p) { (p.tags || []).forEach(function(t) { if (t) seen[t] = true; }); });
  dl.innerHTML = Object.keys(seen).sort().map(function(t) { return '<option value="' + t.replace(/"/g,'&quot;') + '">'; }).join('');
}

// ── Config ──
document.getElementById('cfg-toggle').addEventListener('click', function() {
  var f = document.getElementById('cfg-form');
  f.style.display = f.style.display === 'none' ? 'grid' : 'none';
});

document.getElementById('cfg-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var fd = new FormData(this);
  localStorage.setItem('1ma_sb_url', fd.get('supabase_url').trim());
  localStorage.setItem('1ma_sb_key', fd.get('supabase_key').trim());
  toast('Config saved, reloading...');
  setTimeout(function() { location.reload(); }, 1000);
});

// ── Admin tabs ──
document.querySelectorAll('.atab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.atab').forEach(function(t) { t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    document.querySelectorAll('.apane').forEach(function(p) { p.classList.remove('is-active'); });
    document.getElementById(tab.dataset.pane).classList.add('is-active');
  });
});

// ── Form helpers ──
function formData(formId) {
  var fd = new FormData(document.getElementById(formId));
  var o = {};
  fd.forEach(function(v, k) { o[k] = v; });
  return o;
}

function resetForm(formId) { document.getElementById(formId).reset(); }

// ── Create forms ──
var creates = [
  { id: 'f-post', table: 'posts', store: 'posts', map: function(o) { o.id = nid(); o.tags = tagsArr(o.tags); return o; }, render: function() { renderPosts(document.querySelector('.filter.is-selected').dataset.filter); } },
  { id: 'f-project', table: 'projects', store: 'projects', map: function(o) { o.id = nid(); o.tags = tagsArr(o.tags); return o; }, render: function() { renderProjects(); } },
  { id: 'f-now', table: 'now', store: 'nowItems', map: function(o) { o.id = nid(); o.italic = !!o.italic; return o; }, render: function() { renderNow(); } },
  { id: 'f-legacy', table: 'legacy', store: 'legacyItems', map: function(o) { o.id = nid(); return o; }, render: function() { renderLegacy(document.querySelector('.pfilter.is-selected').dataset.platform); } },
  { id: 'f-links', table: 'links', store: 'links', map: function(o) { o.id = nid(); return o; }, render: function() { renderLinks(); } },
];

creates.forEach(function(cfg) {
  document.getElementById(cfg.id).addEventListener('submit', function(e) {
    e.preventDefault();
    var obj = cfg.map(formData(cfg.id));
    var arr = window[cfg.store];
    arr.push(obj);
    sbAdm('POST', cfg.table, { body: obj }).then(function() {
      cfg.render();
      resetForm(cfg.id);
      buildTags();
      toast('Created');
    }).catch(function(err) {
      arr.pop();
      toast('Error: ' + (err.message || err));
    });
  });
});

// ── Edit helpers ──
function showDlg(type, item) {
  currentEdit = { type: type, item: item };
  dlgTitle.textContent = 'Edit ' + type;
  dlgConfirm.style.display = 'none';
  dlgSave.style.display = 'block';
  dlgForm.querySelector('.df-note').style.display = 'none';
  dlgForm.querySelector('.df-project').style.display = 'none';
  dlgForm.querySelector('.df-now').style.display = 'none';
  dlgForm.querySelector('.df-legacy').style.display = 'none';
  dlgForm.querySelector('.df-links').style.display = 'none';

  if (type === 'posts') {
    dlgForm.querySelector('.df-note').style.display = 'block';
    dlgForm.querySelector('#df-note-title').value = item.title || '';
    dlgForm.querySelector('#df-note-content').value = item.content || '';
    dlgForm.querySelector('#df-note-cat').value = item.category || 'thinking';
    dlgForm.querySelector('#df-note-tags').value = (item.tags || []).join(', ');
    dlgForm.querySelector('#df-note-img').value = item.featured_image || '';
    dlgForm.querySelector('#df-note-date').value = item.date || '';
  } else if (type === 'projects') {
    dlgForm.querySelector('.df-project').style.display = 'block';
    dlgForm.querySelector('#df-proj-title').value = item.title || '';
    dlgForm.querySelector('#df-proj-desc').value = item.description || '';
    dlgForm.querySelector('#df-proj-num').value = item.number || '';
    dlgForm.querySelector('#df-proj-year').value = item.year || '';
    dlgForm.querySelector('#df-proj-tags').value = (item.tags || []).join(', ');
    dlgForm.querySelector('#df-proj-style').value = item.style || 'sunrise';
    dlgForm.querySelector('#df-proj-large').checked = !!item.large;
    dlgForm.querySelector('#df-proj-quote').value = item.quote || '';
  } else if (type === 'now') {
    dlgForm.querySelector('.df-now').style.display = 'block';
    dlgForm.querySelector('#df-now-cat').value = item.category || '';
    dlgForm.querySelector('#df-now-desc').value = item.description || '';
    dlgForm.querySelector('#df-now-italic').checked = !!item.italic;
  } else if (type === 'legacy') {
    dlgForm.querySelector('.df-legacy').style.display = 'block';
    dlgForm.querySelector('#df-leg-platform').value = item.platform || 'youtube';
    dlgForm.querySelector('#df-leg-title').value = item.title || '';
    dlgForm.querySelector('#df-leg-content').value = item.content || '';
    dlgForm.querySelector('#df-leg-link').value = item.link || '';
    dlgForm.querySelector('#df-leg-date').value = item.date || '';
  } else if (type === 'links') {
    dlgForm.querySelector('.df-links').style.display = 'block';
    dlgForm.querySelector('#df-link-title').value = item.title || '';
    dlgForm.querySelector('#df-link-url').value = item.url || '';
    dlgForm.querySelector('#df-link-cat').value = item.category || '';
  }
  dlg.classList.add('show');
}

function showDel(type, id) {
  currentDel = { type: type, id: id };
  dlgTitle.textContent = 'Delete this item?';
  dlgConfirm.style.display = 'block';
  dlgSave.style.display = 'none';
  dlgForm.querySelector('.df-note').style.display = 'none';
  dlgForm.querySelector('.df-project').style.display = 'none';
  dlgForm.querySelector('.df-now').style.display = 'none';
  dlgForm.querySelector('.df-legacy').style.display = 'none';
  dlgForm.querySelector('.df-links').style.display = 'none';
  dlg.classList.add('show');
}

// ── Edit save ──
dlgForm.addEventListener('submit', function(e) {
  e.preventDefault();
  if (!currentEdit) return;
  var ed = currentEdit;
  var fd = new FormData(dlgForm);
  var updated = { id: ed.item.id };
  var storeMap = { posts: 'posts', projects: 'projects', now: 'nowItems', legacy: 'legacyItems', links: 'links' };
  var arr = window[storeMap[ed.type]];
  var idx = arr.findIndex(function(x) { return x.id === ed.item.id; });
  if (idx === -1) return;

  if (ed.type === 'posts') {
    updated.title = fd.get('df_note_title');
    updated.content = fd.get('df_note_content');
    updated.category = fd.get('df_note_cat');
    updated.tags = tagsArr(fd.get('df_note_tags'));
    updated.featured_image = fd.get('df_note_img');
    updated.date = fd.get('df_note_date');
  } else if (ed.type === 'projects') {
    updated.title = fd.get('df_proj_title');
    updated.description = fd.get('df_proj_desc');
    updated.number = fd.get('df_proj_num');
    updated.year = fd.get('df_proj_year');
    updated.tags = tagsArr(fd.get('df_proj_tags'));
    updated.style = fd.get('df_proj_style');
    updated.large = fd.get('df_proj_large') === 'on';
    updated.quote = fd.get('df_proj_quote');
  } else if (ed.type === 'now') {
    updated.category = fd.get('df_now_cat');
    updated.description = fd.get('df_now_desc');
    updated.italic = fd.get('df_now_italic') === 'on';
  } else if (ed.type === 'legacy') {
    updated.platform = fd.get('df_leg_platform');
    updated.title = fd.get('df_leg_title');
    updated.content = fd.get('df_leg_content');
    updated.link = fd.get('df_leg_link');
    updated.date = fd.get('df_leg_date');
  } else if (ed.type === 'links') {
    updated.title = fd.get('df_link_title');
    updated.url = fd.get('df_link_url');
    updated.category = fd.get('df_link_cat');
  }

  var prev = arr[idx];
  arr[idx] = updated;
  sbAdm('PATCH', ed.type, { q: '?id=eq.' + ed.item.id, body: updated }).then(function() {
    if (ed.type === 'posts') renderPosts(document.querySelector('.filter.is-selected').dataset.filter);
    else if (ed.type === 'projects') renderProjects();
    else if (ed.type === 'now') renderNow();
    else if (ed.type === 'legacy') renderLegacy(document.querySelector('.pfilter.is-selected').dataset.platform);
    else if (ed.type === 'links') renderLinks();
    buildTags();
    toast('Updated');
  }).catch(function(err) {
    arr[idx] = prev;
    toast('Error: ' + (err.message || err));
  });
  dlg.classList.remove('show');
  currentEdit = null;
});

// ── Delete confirm ──
confirmYes.addEventListener('click', function() {
  if (!currentDel) return;
  var d = currentDel;
  var storeMap = { posts: 'posts', projects: 'projects', now: 'nowItems', legacy: 'legacyItems', links: 'links' };
  var arr = window[storeMap[d.type]];
  var idx = arr.findIndex(function(x) { return x.id === d.id; });
  if (idx === -1) return;
  var removed = arr.splice(idx, 1)[0];
  sbAdm('DELETE', d.type, { q: '?id=eq.' + d.id }).then(function() {
    if (d.type === 'posts') renderPosts(document.querySelector('.filter.is-selected').dataset.filter);
    else if (d.type === 'projects') renderProjects();
    else if (d.type === 'now') renderNow();
    else if (d.type === 'legacy') renderLegacy(document.querySelector('.pfilter.is-selected').dataset.platform);
    else if (d.type === 'links') renderLinks();
    buildTags();
    toast('Deleted');
  }).catch(function(err) {
    arr.splice(idx, 0, removed);
    toast('Delete failed: ' + (err.message || err));
  });
  dlg.classList.remove('show');
  currentDel = null;
});

confirmNo.addEventListener('click', function() { dlg.classList.remove('show'); currentDel = null; });
dlgCancel.addEventListener('click', function() { dlg.classList.remove('show'); currentEdit = null; currentDel = null; });
dlg.addEventListener('click', function(e) { if (e.target === dlg) { dlg.classList.remove('show'); currentEdit = null; currentDel = null; } });

// ── Exports ──
window.__admin = {
  init: function() {
    document.getElementById('supabase_url').value = localStorage.getItem('1ma_sb_url') || '';
    document.getElementById('supabase_key').value = localStorage.getItem('1ma_sb_key') || '';
    buildTags();
    // Rebuild tags after renders
    var origP = renderPosts;
    renderPosts = function(f) { origP(f); buildTags(); };
    var origPr = renderProjects;
    renderProjects = function() { origPr(); buildTags(); };
  },
  edit: function(type, id) {
    var arr = { posts: posts, projects: projects, now: nowItems, legacy: legacyItems, links: links }[type];
    var item = arr.find(function(x) { return x.id === id; });
    if (item) showDlg(type, item);
  },
  del: function(type, id) { showDel(type, id); },
};
