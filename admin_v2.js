// ── Supabase helpers ──
function supabaseRequest(method, table, opts) {
  const url = localStorage.getItem('1ma_supabase_url') || '';
  const key = localStorage.getItem('1ma_supabase_key') || '';
  if (!url || !key) { showToast('Supabase not configured'); return Promise.reject('Supabase not configured'); }
  var headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  var base = url.replace(/\/+rest\/v1\/?$/, '');
  var q = base + '/rest/v1/' + table + (opts.query || '');
  return fetch(q, { method: method, headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    return r.json();
  });
}

// ── Dialog ──
var dialogOverlay = document.getElementById('dialog-overlay');
var dialogContent = document.getElementById('dialog-content');
var dialogForm = document.getElementById('dialog-form');
var dialogTitle = document.getElementById('dialog-title');
var dialogCancel = document.getElementById('dialog-cancel');
var dialogSubmit = document.getElementById('dialog-submit');
var dialogConfirmDelete = document.getElementById('dialog-confirm-delete');

var currentDelete = null;
var currentEdit = null;

// ── Toast ──
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  setTimeout(function() { t.classList.remove('is-visible'); }, 3000);
}

// ── Config panel ──
var configPanel = document.getElementById('admin-config');
var configBtn = document.getElementById('config-toggle');
var configForm = document.getElementById('config-form');

configForm.addEventListener('submit', function(e) {
  e.preventDefault();
  var fd = new FormData(configForm);
  localStorage.setItem('1ma_supabase_url', fd.get('supabase_url').trim());
  localStorage.setItem('1ma_supabase_key', fd.get('supabase_key').trim());
  showToast('Supabase config saved. Reloading...');
  setTimeout(function() { location.reload(); }, 1000);
});

configBtn.addEventListener('click', function() {
  configPanel.classList.toggle('is-open');
});

// ── Migrate localStorage → Supabase ──
function migrateFromLocalStorage() {
  var tables = ['notes', 'work', 'now', 'legacy'];
  var keys = ['1ma_notes', '1ma_work', '1ma_now', '1ma_legacy'];
  var total = 0;
  tables.forEach(function(table, i) {
    var raw = localStorage.getItem(keys[i]);
    if (!raw) return;
    var items;
    try { items = JSON.parse(raw); } catch(e) { return; }
    if (!items || !items.length) return;
    items.forEach(function(item) {
      supabaseInsert(table, item).then(function() {
        total++;
      }).catch(function(err) {
        console.error('Migration error for', table, item, err);
        showToast('Error on ' + table + ': ' + err.message);
      });
    });
  });
  showToast('Migration started — check toasts for progress');
}

document.getElementById('migrate-btn').addEventListener('click', function() {
  migrateFromLocalStorage();
});

// ── Form tabs ──
var tabs = document.querySelectorAll('.form-tab');
var tabPanes = document.querySelectorAll('.tab-pane');
tabs.forEach(function(t) {
  t.addEventListener('click', function() {
    tabs.forEach(function(x) { x.classList.remove('is-active'); });
    t.classList.add('is-active');
    tabPanes.forEach(function(p) { p.classList.remove('is-active'); });
    document.getElementById(t.dataset.tab).classList.add('is-active');
  });
});

// ── Shared helpers ──
function formToObj(formId) {
  var fd = new FormData(document.getElementById(formId));
  var o = {};
  fd.forEach(function(v, k) { o[k] = v; });
  if (o.tags) o.tags = o.tags.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  return o;
}

function resetForm(formId) {
  document.getElementById(formId).reset();
}

function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Work form ──
document.getElementById('work-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var o = formToObj('work-form');
  o.id = nid();
  if (!o.tag) delete o.tag;
  var data = __work.data;
  data.push(o);
  supabaseInsert('work', o).then(function() {
    renderWork();
    resetForm('work-form');
    showToast('Work item created');
  }).catch(function(err) {
    data.pop();
    showToast('Error: ' + (err.message || err));
  });
});

// ── Now form ──
document.getElementById('now-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var fd = new FormData(document.getElementById('now-form'));
  var o = {
    id: nid(),
    category: fd.get('now_category'),
    description: fd.get('now_description'),
    italic: fd.get('now_italic') === 'on'
  };
  var data = __now.data;
  data.push(o);
  supabaseInsert('now', o).then(function() {
    renderNow();
    resetForm('now-form');
    showToast('Now item created');
  }).catch(function(err) {
    data.pop();
    showToast('Error: ' + (err.message || err));
  });
});

// ── Legacy form ──
document.getElementById('legacy-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var o = formToObj('legacy-form');
  o.id = nid();
  var data = __legacy.data;
  data.push(o);
  supabaseInsert('legacy', o).then(function() {
    var active = document.querySelector('.legacy-filter.is-selected');
    renderLegacy(active ? active.dataset.platform : 'all');
    resetForm('legacy-form');
    showToast('Legacy post created');
  }).catch(function(err) {
    data.pop();
    showToast('Error: ' + (err.message || err));
  });
});

// ── Note form ──
document.getElementById('note-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var o = formToObj('note-form');
  o.id = nid();
  if (!o.tag) delete o.tag;
  var idx = notes.length;
  notes.push(o);
  supabaseInsert('notes', o).then(function() {
    render();
    resetForm('note-form');
    showToast('Note created');
  }).catch(function(err) {
    notes.splice(idx, 1);
    showToast('Error: ' + (err.message || err));
  });
});

function populateTagDropdown() {
  var sel = document.getElementById('note_tag');
  if (!sel) return;
  var current = sel.value;
  sel.innerHTML = '<option value="">None</option>';
  var seen = {};
  __work.data.forEach(function(w) {
    if (w.tag && !seen[w.tag]) {
      seen[w.tag] = true;
      var opt = document.createElement('option');
      opt.value = w.tag;
      opt.textContent = w.tag;
      sel.appendChild(opt);
    }
  });
  if (current) sel.value = current;
}

// ── Delete ──
window.__admin = {
  init: function() {
    populateTagDropdown();
    document.getElementById('supabase_url').value = localStorage.getItem('1ma_supabase_url') || '';
    document.getElementById('supabase_key').value = localStorage.getItem('1ma_supabase_key') || '';
    // Refresh tag dropdown when work changes
    var origRenderWork = renderWork;
    var self = this;
    renderWork = function() { origRenderWork(); populateTagDropdown(); };
  },

  editNote: function(id) {
    var n = notes.find(function(x) { return x.id === id; });
    if (!n) return;
    currentEdit = { type: 'note', original: n };
    dialogTitle.textContent = 'Edit Note';
    dialogForm.querySelector('#dialog-note-title').value = n.title;
    dialogForm.querySelector('#dialog-note-content').value = n.content || '';
    dialogForm.querySelector('#dialog-note-category').value = n.category;
    dialogForm.querySelector('#dialog-note-tag').value = n.tag || '';
    dialogForm.querySelector('#dialog-note-date').value = n.date;
    dialogForm.querySelector('.extra-fields-note').style.display = 'block';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogSubmit.style.display = 'block';
    dialogConfirmDelete.style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  editWork: function(id) {
    var w = __work.data.find(function(x) { return x.id === id; });
    if (!w) return;
    currentEdit = { type: 'work', original: w };
    dialogTitle.textContent = 'Edit Work';
    dialogForm.querySelector('#dialog-work-number').value = w.number || '';
    dialogForm.querySelector('#dialog-work-year').value = w.year || '';
    dialogForm.querySelector('#dialog-work-label').value = w.label || '';
    dialogForm.querySelector('#dialog-work-title').value = w.title || '';
    dialogForm.querySelector('#dialog-work-description').value = w.description || '';
    dialogForm.querySelector('#dialog-work-link').value = w.link || '';
    dialogForm.querySelector('#dialog-work-style').value = w.style || 'sunrise';
    dialogForm.querySelector('#dialog-work-large').checked = !!w.large;
    dialogForm.querySelector('#dialog-work-quote').value = w.quote || '';
    dialogForm.querySelector('#dialog-work-tag').value = w.tag || '';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'block';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogSubmit.style.display = 'block';
    dialogConfirmDelete.style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  editNow: function(id) {
    var n = __now.data.find(function(x) { return x.id === id; });
    if (!n) return;
    currentEdit = { type: 'now', original: n };
    dialogTitle.textContent = 'Edit Now';
    dialogForm.querySelector('#dialog-now-category').value = n.category || '';
    dialogForm.querySelector('#dialog-now-description').value = n.description || '';
    dialogForm.querySelector('#dialog-now-italic').checked = !!n.italic;
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'block';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogSubmit.style.display = 'block';
    dialogConfirmDelete.style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  editLegacy: function(id) {
    var l = __legacy.data.find(function(x) { return x.id === id; });
    if (!l) return;
    currentEdit = { type: 'legacy', original: l };
    dialogTitle.textContent = 'Edit Legacy';
    dialogForm.querySelector('#dialog-legacy-platform').value = l.platform || '';
    dialogForm.querySelector('#dialog-legacy-title').value = l.title || '';
    dialogForm.querySelector('#dialog-legacy-link').value = l.link || '';
    dialogForm.querySelector('#dialog-legacy-content').value = l.content || '';
    dialogForm.querySelector('#dialog-legacy-date').value = l.date || '';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'block';
    dialogSubmit.style.display = 'block';
    dialogConfirmDelete.style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  delete: function(id) {
    currentDelete = { type: 'note', id: id };
    dialogTitle.textContent = 'Delete note?';
    dialogConfirmDelete.style.display = 'flex';
    dialogSubmit.style.display = 'none';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  deleteWork: function(id) {
    currentDelete = { type: 'work', id: id };
    dialogTitle.textContent = 'Delete work item?';
    dialogConfirmDelete.style.display = 'flex';
    dialogSubmit.style.display = 'none';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  deleteNow: function(id) {
    currentDelete = { type: 'now', id: id };
    dialogTitle.textContent = 'Delete now item?';
    dialogConfirmDelete.style.display = 'flex';
    dialogSubmit.style.display = 'none';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  },

  deleteLegacy: function(id) {
    currentDelete = { type: 'legacy', id: id };
    dialogTitle.textContent = 'Delete legacy post?';
    dialogConfirmDelete.style.display = 'flex';
    dialogSubmit.style.display = 'none';
    dialogForm.querySelector('.extra-fields-note').style.display = 'none';
    dialogForm.querySelector('.extra-fields-work').style.display = 'none';
    dialogForm.querySelector('.extra-fields-now').style.display = 'none';
    dialogForm.querySelector('.extra-fields-legacy').style.display = 'none';
    dialogOverlay.classList.add('is-visible');
  }
};

// ── Dialog handlers ──
dialogCancel.addEventListener('click', function() {
  dialogOverlay.classList.remove('is-visible');
  currentEdit = null;
  currentDelete = null;
});

dialogOverlay.addEventListener('click', function(e) {
  if (e.target === dialogOverlay) {
    dialogOverlay.classList.remove('is-visible');
    currentEdit = null;
    currentDelete = null;
  }
});

// Confirm delete
document.getElementById('dialog-confirm-yes').addEventListener('click', function() {
  if (!currentDelete) return;
  var d = currentDelete;
  var store = d.type === 'note' ? notes : d.type === 'work' ? __work.data : d.type === 'now' ? __now.data : __legacy.data;
  var idx = store.findIndex(function(x) { return x.id === d.id; });
  if (idx === -1) return;
  var removed = store.splice(idx, 1)[0];
  supabaseDelete(d.type, d.id).then(function() {
    if (d.type === 'note') render();
    else if (d.type === 'work') renderWork();
    else if (d.type === 'now') renderNow();
    else { var active = document.querySelector('.legacy-filter.is-selected'); renderLegacy(active ? active.dataset.platform : 'all'); }
    showToast(d.type.charAt(0).toUpperCase() + d.type.slice(1) + ' deleted');
  }).catch(function(err) {
    store.splice(idx, 0, removed);
    showToast('Delete failed: ' + (err.message || err));
  });
  dialogOverlay.classList.remove('is-visible');
  currentDelete = null;
});

document.getElementById('dialog-confirm-no').addEventListener('click', function() {
  dialogOverlay.classList.remove('is-visible');
  currentDelete = null;
});

// Edit save via dialog submit
dialogForm.addEventListener('submit', function(e) {
  e.preventDefault();
  if (!currentEdit) return;
  var edit = currentEdit;
  var store = edit.type === 'note' ? notes : edit.type === 'work' ? __work.data : edit.type === 'now' ? __now.data : __legacy.data;
  var fd = new FormData(dialogForm);
  var updated = {};

  if (edit.type === 'note') {
    var tag = fd.get('dialog_note_tag');
    updated = { title: fd.get('dialog_note_title'), content: fd.get('dialog_note_content'), category: fd.get('dialog_note_category'), date: fd.get('dialog_note_date'), id: edit.original.id };
    if (tag) updated.tag = tag; else updated.tag = null;
  } else if (edit.type === 'work') {
    updated = {
      id: edit.original.id,
      number: fd.get('dialog_work_number'),
      year: fd.get('dialog_work_year'),
      label: fd.get('dialog_work_label'),
      title: fd.get('dialog_work_title'),
      description: fd.get('dialog_work_description'),
      link: fd.get('dialog_work_link'),
      style: fd.get('dialog_work_style'),
      large: fd.get('dialog_work_large') === 'on',
      quote: fd.get('dialog_work_quote'),
      tag: fd.get('dialog_work_tag') || null
    };
  } else if (edit.type === 'now') {
    updated = { id: edit.original.id, category: fd.get('dialog_now_category'), description: fd.get('dialog_now_description'), italic: fd.get('dialog_now_italic') === 'on' };
  } else if (edit.type === 'legacy') {
    updated = { id: edit.original.id, platform: fd.get('dialog_legacy_platform'), title: fd.get('dialog_legacy_title'), link: fd.get('dialog_legacy_link'), content: fd.get('dialog_legacy_content'), date: fd.get('dialog_legacy_date') };
  }

  var idx = store.findIndex(function(x) { return x.id === edit.original.id; });
  if (idx === -1) return;
  var prev = store[idx];
  store[idx] = updated;

  supabaseUpdate(edit.type, edit.original.id, updated).then(function() {
    if (edit.type === 'note') render();
    else if (edit.type === 'work') renderWork();
    else if (edit.type === 'now') renderNow();
    else { var active = document.querySelector('.legacy-filter.is-selected'); renderLegacy(active ? active.dataset.platform : 'all'); }
    showToast(edit.type.charAt(0).toUpperCase() + edit.type.slice(1) + ' updated');
  }).catch(function(err) {
    store[idx] = prev;
    showToast('Update failed: ' + (err.message || err));
  });

  dialogOverlay.classList.remove('is-visible');
  currentEdit = null;
});
