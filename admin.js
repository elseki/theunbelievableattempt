// ── Admin panel — only loads via #1ma-write ──
(function () {
  const N = window.__notes;
  const W = window.__work;
  const O = window.__now;

  let editingNoteId = null;
  let editingWorkId = null;
  let editingNowId = null;
  let editingLegacyId = null;

  function inject() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('admin-section')) return;

    const section = document.createElement('section');
    section.className = 'admin-section';
    section.id = 'admin-section';
    section.innerHTML =
      '<div class="section-shell">' +
        '<p class="eyebrow">Admin</p>' +
        '<div class="admin-tabs" id="admin-tabs"></div>' +
        '<div class="admin-form-pane is-active" id="pane-notes"></div>' +
        '<div class="admin-form-pane" id="pane-work"></div>' +
        '<div class="admin-form-pane" id="pane-now"></div>' +
        '<div class="admin-form-pane" id="pane-legacy"></div>' +
      '</div>';
    main.appendChild(section);

    const tabs = [
      { id: 'notes', label: 'Notes', form: notesForm() },
      { id: 'work', label: 'Work', form: workForm() },
      { id: 'now', label: 'Now', form: nowForm() },
      { id: 'legacy', label: 'Legacy', form: legacyForm() },
    ];

    const tabBar = document.getElementById('admin-tabs');

    function switchTab(id) {
      tabBar.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === id));
      document.querySelectorAll('.admin-form-pane').forEach((p) => p.classList.toggle('is-active', p.id === 'pane-' + id));
      if (id === 'work' || id === 'notes') refreshNoteTagOptions();
    }

    tabs.forEach((t) => {
      const tb = document.createElement('button');
      tb.className = 'admin-tab' + (t.id === 'notes' ? ' is-active' : '');
      tb.dataset.tab = t.id;
      tb.type = 'button';
      tb.textContent = t.label;
      tb.addEventListener('click', () => switchTab(t.id));
      tabBar.appendChild(tb);

      const pane = document.getElementById('pane-' + t.id);
      pane.innerHTML = t.form.html;
      pane.querySelector('form').addEventListener('submit', t.form.handler);
    });

    refreshNoteTagOptions();
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function reRenderNotes() {
    const active = document.querySelector('.filter-button.is-selected');
    if (active) active.click();
  }

  function cancelEdit(formId, submitBtnId, defaultLabel, resetEditing) {
    resetEditing();
    const form = document.getElementById(formId);
    if (form) form.reset();
    const btn = document.getElementById(submitBtnId);
    if (btn) btn.textContent = defaultLabel;
    const cancel = form?.querySelector('.admin-cancel');
    if (cancel) cancel.remove();
  }

  // ── Notes form ──
  function notesForm() {
    const html =
      '<form id="form-notes" class="admin-form">' +
        '<div class="admin-field"><label for="note-date">Date</label><input type="date" id="note-date" required /></div>' +
        '<div class="admin-field"><label for="note-category">Category</label>' +
          '<select id="note-category"><option value="thinking">Thinking</option><option value="making">Making</option><option value="life">Life lately</option></select>' +
        '</div>' +
        '<div class="admin-field"><label for="note-tag">Tag <span class="admin-optional">(from Work cards)</span></label><select id="note-tag"><option value="">No tag</option></select></div>' +
        '<div class="admin-field"><label for="note-title">Title</label><input type="text" id="note-title" placeholder="What\'s the note about?" required /></div>' +
        '<div class="admin-field"><label for="note-content">Content</label><textarea id="note-content" rows="6" placeholder="Write your post. Paste image URLs on their own line to embed them." required></textarea></div>' +
        '<div class="admin-actions"><button type="submit" class="admin-submit" id="notes-submit">Publish note</button></div>' +
      '</form>';
    function handler(e) {
      e.preventDefault();
      const date = document.getElementById('note-date').value;
      const cat = document.getElementById('note-category').value;
      const tag = document.getElementById('note-tag').value;
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').value;
      if (!title || !date) return;
      if (editingNoteId) {
        const item = N.data.find((n) => n.id === editingNoteId);
        if (item) { item.date = date; item.category = cat; item.tag = tag; item.title = title; item.content = content; }
        N.save();
        cancelEdit('form-notes', 'notes-submit', 'Publish note', () => { editingNoteId = null; });
        reRenderNotes();
      } else {
        N.data.push({ id: 'n' + id(), date, category: cat, tag: tag, title, content });
        N.save();
        e.target.reset();
        document.getElementById('note-date').value = new Date().toISOString().split('T')[0];
        reRenderNotes();
      }
    }
    return { html, handler };
  }

  function editNote(id) {
    const item = N.data.find((n) => n.id === id);
    if (!item) return;
    editingNoteId = id;
    switchTab('notes');
    document.getElementById('note-date').value = item.date;
    document.getElementById('note-category').value = item.category;
    document.getElementById('note-tag').value = item.tag || '';
    document.getElementById('note-title').value = item.title;
    document.getElementById('note-content').value = item.content;
    document.getElementById('notes-submit').textContent = 'Update note';
    addCancelBtn('form-notes', 'notes-submit', 'Publish note', () => { editingNoteId = null; });
    document.getElementById('admin-section').scrollIntoView({ behavior: 'smooth' });
  }

  // ── Work form ──
  function workForm() {
    const html =
      '<form id="form-work" class="admin-form">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem">' +
          '<div class="admin-field"><label for="work-number">Number</label><input type="text" id="work-number" placeholder="01" required /></div>' +
          '<div class="admin-field"><label for="work-year">Year</label><input type="text" id="work-year" placeholder="2025" required /></div>' +
        '</div>' +
        '<div class="admin-field"><label for="work-label">Label</label><input type="text" id="work-label" placeholder="Miniatures & painting" required /></div>' +
        '<div class="admin-field"><label for="work-title">Title</label><input type="text" id="work-title" placeholder="Warhammer" required /></div>' +
        '<div class="admin-field"><label for="work-desc">Description</label><textarea id="work-desc" rows="2" placeholder="Short description" required></textarea></div>' +
        '<div class="admin-field"><label for="work-tag">Tag <span class="admin-optional">(links to matching notes)</span></label><input type="text" id="work-tag" placeholder="warhammer" /></div>' +
        '<div class="admin-field"><label for="work-link">Link URL</label><input type="text" id="work-link" placeholder="#work or https://..." /></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem">' +
          '<div class="admin-field"><label for="work-style">Style</label>' +
            '<select id="work-style"><option value="sunrise">Sunrise</option><option value="moss">Moss</option><option value="blue">Blue</option></select>' +
          '</div>' +
          '<div class="admin-field" style="justify-content:end;padding-top:1.2rem">' +
            '<label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-family:var(--mono);font-size:.65rem;text-transform:uppercase">' +
              '<input type="checkbox" id="work-large" /> Large card' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="admin-field"><label for="work-quote">Quote <span class="admin-optional">(optional, blue style only)</span></label><input type="text" id="work-quote" placeholder="A pull quote for the card" /></div>' +
        '<div class="admin-actions"><button type="submit" class="admin-submit" id="work-submit">Add work</button></div>' +
      '</form>';
    function handler(e) {
      e.preventDefault();
      const tag = document.getElementById('work-tag').value.trim().toLowerCase().replace(/\s+/g, '-') || '';
      const number = document.getElementById('work-number').value;
      const year = document.getElementById('work-year').value;
      const label = document.getElementById('work-label').value;
      const title = document.getElementById('work-title').value;
      const description = document.getElementById('work-desc').value;
      const link = document.getElementById('work-link').value || '#work';
      const style = document.getElementById('work-style').value;
      const large = document.getElementById('work-large').checked;
      const quote = document.getElementById('work-quote').value || '';
      if (editingWorkId) {
        const item = W.data.find((w) => w.id === editingWorkId);
        if (item) { item.number = number; item.year = year; item.label = label; item.title = title; item.description = description; item.tag = tag; item.link = link; item.style = style; item.large = large; item.quote = quote; }
        W.save();
        cancelEdit('form-work', 'work-submit', 'Add work', () => { editingWorkId = null; });
        renderWork();
        refreshNoteTagOptions();
      } else {
        W.data.push({ id: 'w' + id(), number, year, label, title, description, tag, link, style, large, quote });
        W.save();
        e.target.reset();
        renderWork();
        refreshNoteTagOptions();
      }
    }
    return { html, handler };
  }

  function editWork(id) {
    const item = W.data.find((w) => w.id === id);
    if (!item) return;
    editingWorkId = id;
    switchTab('work');
    document.getElementById('work-number').value = item.number;
    document.getElementById('work-year').value = item.year;
    document.getElementById('work-label').value = item.label;
    document.getElementById('work-title').value = item.title;
    document.getElementById('work-desc').value = item.description;
    document.getElementById('work-tag').value = item.tag || '';
    document.getElementById('work-link').value = item.link === '#work' ? '' : item.link;
    document.getElementById('work-style').value = item.style;
    document.getElementById('work-large').checked = item.large;
    document.getElementById('work-quote').value = item.quote || '';
    document.getElementById('work-submit').textContent = 'Update work';
    addCancelBtn('form-work', 'work-submit', 'Add work', () => { editingWorkId = null; });
    document.getElementById('admin-section').scrollIntoView({ behavior: 'smooth' });
  }

  // ── Now form ──
  function nowForm() {
    const html =
      '<form id="form-now" class="admin-form">' +
        '<div class="admin-field"><label for="now-category">Category</label><input type="text" id="now-category" placeholder="Learning" required /></div>' +
        '<div class="admin-field"><label for="now-desc">Description</label><textarea id="now-desc" rows="2" placeholder="What are you up to?" required></textarea></div>' +
        '<div class="admin-field">' +
          '<label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-family:var(--mono);font-size:.65rem;text-transform:uppercase">' +
            '<input type="checkbox" id="now-italic" /> Italic description' +
          '</label>' +
        '</div>' +
        '<div class="admin-actions"><button type="submit" class="admin-submit" id="now-submit">Add now item</button></div>' +
      '</form>';
    function handler(e) {
      e.preventDefault();
      const category = document.getElementById('now-category').value;
      const description = document.getElementById('now-desc').value;
      const italic = document.getElementById('now-italic').checked;
      if (editingNowId) {
        const item = O.data.find((n) => n.id === editingNowId);
        if (item) { item.category = category; item.description = description; item.italic = italic; }
        O.save();
        cancelEdit('form-now', 'now-submit', 'Add now item', () => { editingNowId = null; });
        renderNow();
      } else {
        O.data.push({ id: 'o' + id(), category, description, italic });
        O.save();
        e.target.reset();
        renderNow();
      }
    }
    return { html, handler };
  }

  function editNow(id) {
    const item = O.data.find((n) => n.id === id);
    if (!item) return;
    editingNowId = id;
    switchTab('now');
    document.getElementById('now-category').value = item.category;
    document.getElementById('now-desc').value = item.description;
    document.getElementById('now-italic').checked = item.italic;
    document.getElementById('now-submit').textContent = 'Update now';
    addCancelBtn('form-now', 'now-submit', 'Add now item', () => { editingNowId = null; });
    document.getElementById('admin-section').scrollIntoView({ behavior: 'smooth' });
  }

  // ── Legacy form ──
  function legacyForm() {
    const html =
      '<form id="form-legacy" class="admin-form">' +
        '<div class="admin-field"><label for="legacy-platform">Platform</label>' +
          '<select id="legacy-platform"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select>' +
        '</div>' +
        '<div class="admin-field"><label for="legacy-title">Title</label><input type="text" id="legacy-title" placeholder="Post title" required /></div>' +
        '<div class="admin-field"><label for="legacy-content">Content <span class="admin-optional">(text + image URLs on their own line)</span></label><textarea id="legacy-content" rows="4" placeholder="Write your post content. Paste image URLs on their own line."></textarea></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem">' +
          '<div class="admin-field"><label for="legacy-date">Date</label><input type="date" id="legacy-date" required /></div>' +
          '<div class="admin-field"><label for="legacy-link">Link URL</label><input type="url" id="legacy-link" placeholder="https://..." required /></div>' +
        '</div>' +
        '<div class="admin-actions"><button type="submit" class="admin-submit" id="legacy-submit">Add post</button></div>' +
      '</form>';
    function handler(e) {
      e.preventDefault();
      const platform = document.getElementById('legacy-platform').value;
      const title = document.getElementById('legacy-title').value;
      const content = document.getElementById('legacy-content').value;
      const date = document.getElementById('legacy-date').value;
      const link = document.getElementById('legacy-link').value;
      if (editingLegacyId) {
        const item = window.__legacy.data.find((l) => l.id === editingLegacyId);
        if (item) { item.platform = platform; item.title = title; item.content = content; item.date = date; item.link = link; }
        window.__legacy.save();
        cancelEdit('form-legacy', 'legacy-submit', 'Add post', () => { editingLegacyId = null; });
        const active = document.querySelector('.legacy-filter.is-selected');
        renderLegacy(active ? active.dataset.platform : 'all');
      } else {
        window.__legacy.data.push({ id: 'l' + id(), platform, title, content, date, link });
        window.__legacy.save();
        e.target.reset();
        const active = document.querySelector('.legacy-filter.is-selected');
        renderLegacy(active ? active.dataset.platform : 'all');
      }
    }
    return { html, handler };
  }

  function editLegacy(id) {
    const item = window.__legacy.data.find((l) => l.id === id);
    if (!item) return;
    editingLegacyId = id;
    switchTab('legacy');
    document.getElementById('legacy-platform').value = item.platform;
    document.getElementById('legacy-title').value = item.title;
    document.getElementById('legacy-content').value = item.content || '';
    document.getElementById('legacy-date').value = item.date;
    document.getElementById('legacy-link').value = item.link;
    document.getElementById('legacy-submit').textContent = 'Update post';
    addCancelBtn('form-legacy', 'legacy-submit', 'Add post', () => { editingLegacyId = null; });
    document.getElementById('admin-section').scrollIntoView({ behavior: 'smooth' });
  }

  function addCancelBtn(formId, submitBtnId, defaultLabel, resetEditing) {
    const form = document.getElementById(formId);
    if (!form || form.querySelector('.admin-cancel')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-cancel';
    btn.textContent = 'Cancel';
    btn.addEventListener('click', () => cancelEdit(formId, submitBtnId, defaultLabel, resetEditing));
    form.querySelector('.admin-actions').appendChild(btn);
  }

  function refreshNoteTagOptions() {
    const sel = document.getElementById('note-tag');
    if (!sel) return;
    const current = sel.value;
    const tags = [...new Set(W.data.map((w) => w.tag).filter(Boolean))];
    sel.innerHTML = '<option value="">No tag</option>' + tags.map((t) => '<option value="' + t + '"' + (t === current ? ' selected' : '') + '>' + t + '</option>').join('');
  }

  window.__admin = {
    init: inject,
    refreshNoteTagOptions,
    editNote,
    editWork,
    editNow,
    editLegacy,
    delete(id) {
      if (!confirm('Delete this note?')) return;
      N.data = N.data.filter((n) => n.id !== id);
      N.save();
      reRenderNotes();
    },
    deleteWork(id) {
      if (!confirm('Delete this work card?')) return;
      W.data = W.data.filter((w) => w.id !== id);
      W.save();
      renderWork();
      refreshNoteTagOptions();
    },
    deleteNow(id) {
      if (!confirm('Delete this now item?')) return;
      O.data = O.data.filter((n) => n.id !== id);
      O.save();
      renderNow();
    },
    deleteLegacy(id) {
      if (!confirm('Delete this legacy post?')) return;
      window.__legacy.data = window.__legacy.data.filter((l) => l.id !== id);
      window.__legacy.save();
      const active = document.querySelector('.legacy-filter.is-selected');
      renderLegacy(active ? active.dataset.platform : 'all');
    },
  };
})();
