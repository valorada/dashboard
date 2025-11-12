const indicatorListEl = document.getElementById('indicator-list');
const indicatorButtonsEl = document.getElementById('indicator-buttons');
// Removed category filter elements
const searchInputEl = document.getElementById('indicator-search');
const clearSearchBtn = document.getElementById('clear-search');
const indicatorDetailsEl = document.getElementById('dataset-list');
const datasetListEl = indicatorDetailsEl.querySelector('ul');
const indicatorTitleEl = indicatorDetailsEl.querySelector('h2');
const indicatorIdEl = document.getElementById('indicator-id');
const indicatorDescEl = document.getElementById('indicator-description');
const datasetDetailsEl = document.getElementById('details-content');
const copyLinkBtn = document.getElementById('copy-link-btn');
const liveRegion = document.getElementById('live-region');
const statIndicatorsEl = document.getElementById('stat-indicators');
const statDatasetsEl = document.getElementById('stat-datasets');
const themeToggleBtn = document.getElementById('theme-toggle');
const hcToggleBtn = document.getElementById('hc-toggle');
const cicCheckboxesEl = document.getElementById('cic-checkboxes');
const cicClearBtn = document.getElementById('cic-clear');
const cicMatchAllEl = document.getElementById('cic-match-all');

// Catalog structure (new): { generated_at, indicators: [...], cics: [...] }
let catalogObj = null;
let catalog = []; // indicators
let cics = []; // cic objects
let selectedIndicatorId = null;
let selectedDatasetId = null;
let activeCicIds = new Set(); // multi-selection
let cicMatchAll = false; // if true require indicators to have ALL selected CICs; else ANY
let searchQuery = '';

// Resizable columns state
const dashboardEl = document.getElementById('dashboard');
const gutter1 = document.getElementById('gutter-1');
const gutter2 = document.getElementById('gutter-2');
const LS_KEY = 'dashboard.col.widths.v1';
let colLeftPx = 260; // initial fallback
let colRightPx = null; // computed from container when needed
let isDragging = false;
let dragTarget = null; // 'g1' or 'g2'

// (Categories removed)

// Utility: format multiline description with paragraphs
function formatDescription(text) {
  return text
    .split('\n\n')
    .map(para => `<p>${para}</p>`)
    .join('');
}

function renderDatasetDetails(ds) {
  const link = pickDatasetUrl(ds);
  const tags = [];
  if (ds.license) tags.push(`<span class="tag tag--license" title="License">${escapeHtml(ds.license)}</span>`);
  // If category or other domain tags are present you can push more here.
  datasetDetailsEl.innerHTML = `
    <p><strong>ID:</strong> ${safe(ds.id)}</p>
    <p><strong>Name:</strong> ${safe(ds.name)}</p>
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    ${section('Description', formatDescription(ds.description))}
    ${section('Source', formatDescription(ds.source))}
    ${section('Citation', formatDescription(ds.citation))}
    ${section('License', safe(ds.license))}
    ${link ? `<p><a href="${link}" target="_blank" rel="noopener noreferrer">Open link</a></p>` : ''}
  `;
  selectedDatasetId = ds.id;
  updateHash();
}

function renderDatasets(ind) {
  indicatorTitleEl.textContent = ind.indicator;
  // Add a colored category chip next to the title when available
  const cat = ind.category || '';
  const color = getCategoryColor(cat);
  const chip = cat ? ` <span class="category-chip" style="--cat-color: ${color}">${cat}</span>` : '';
  indicatorTitleEl.innerHTML = `${escapeHtml(ind.indicator)}${chip}`;
  const metaBits = [ ind.id ? `ID: ${ind.id}` : null ].filter(Boolean).join(' • ');
  indicatorIdEl.textContent = metaBits;
  // CIC chips row
  const cicRow = (ind.cic_ids || []).map(cid => {
    const cic = cics.find(c => c.id === cid);
    if (!cic) {
      return `<button class="cic-chip" data-cic="${escapeHtml(cid)}" title="Filter by impact chain">${escapeHtml(cid)}</button>`;
    }
    const desc = collapseWhitespace(cic.description || cic.impact || '');
    const area = cic.area || '';
    const label = `${cic.id}: ${desc}${area ? ` (${area})` : ''}`;
    const areaClass = area ? ` area-${escapeHtml(area)}` : '';
    return `<button class="cic-chip${areaClass}" data-cic="${escapeHtml(cid)}" title="Filter by impact chain">${escapeHtml(label)}</button>`;
  }).join(' ');
  const cicHtml = cicRow ? `<div class="cic-chip-row">${cicRow}</div>` : '';
  indicatorDescEl.innerHTML = formatDescription(ind.description) + cicHtml;

  // Update selected indicator state
  selectedIndicatorId = ind.id;
  highlightSelectedIndicator();
  updateHash();

  // Render dataset list
  datasetListEl.innerHTML = '';
  ind.datasets.forEach(ds => {
    const li = document.createElement('li');
    li.textContent = ds.name;
    li.tabIndex = 0;
    li.style.cursor = 'pointer';
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `${ds.name} details`);
    if (selectedDatasetId === ds.id) li.classList.add('selected');
  li.onclick = () => {
      datasetListEl.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
      li.classList.add('selected');
      renderDatasetDetails(ds);
    };
    li.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { li.click(); } };
    datasetListEl.appendChild(li);
  });

  datasetDetailsEl.innerHTML = `<div class="empty-state fade-in"><span class="emoji">🛈</span>Select a dataset to see details</div>`;
}

function highlightSelectedIndicator() {
  const buttons = indicatorButtonsEl.querySelectorAll('button[data-id]');
  buttons.forEach(b => {
    if (b.dataset.id === selectedIndicatorId) b.classList.add('selected');
    else b.classList.remove('selected');
  });
}

function initGlobalInputs() {
  // Search wiring
  if (searchInputEl) {
    searchInputEl.value = searchQuery;
    searchInputEl.oninput = () => {
      searchQuery = searchInputEl.value.trim();
      renderIndicators();
      if (clearSearchBtn) clearSearchBtn.disabled = !searchQuery;
    };
  }
  if (clearSearchBtn) {
    clearSearchBtn.onclick = () => {
      searchQuery = '';
      if (searchInputEl) searchInputEl.value = '';
      renderIndicators();
      if (searchInputEl) searchInputEl.focus();
      clearSearchBtn.disabled = true;
    };
    clearSearchBtn.disabled = !searchQuery;
  }
  renderCicMulti();
  updateHeaderStats();
}

function getFilteredIndicators() {
  let list = catalog;
  if (activeCicIds.size) {
    list = list.filter(ind => {
      const ids = ind.cic_ids || [];
      if (!ids.length) return false;
      if (cicMatchAll) {
        // every selected must be present
        for (const sel of activeCicIds) if (!ids.includes(sel)) return false;
        return true;
      } else {
        // any selected present
        return ids.some(id => activeCicIds.has(id));
      }
    });
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(ind =>
      (ind.indicator && ind.indicator.toLowerCase().includes(q)) ||
      (ind.description && ind.description.toLowerCase().includes(q))
    );
  }
  return list;
}

function renderIndicators() {
  indicatorButtonsEl.innerHTML = '';
  indicatorButtonsEl.style.opacity = '0';
  const filteredIndicators = getFilteredIndicators();

  // Update header stats on each render
  updateHeaderStats(filteredIndicators);

  if (filteredIndicators.length === 0) {
    indicatorButtonsEl.innerHTML = '<p>No indicators found.</p>';
    // Clear right/middle panels to avoid stale selection
    indicatorTitleEl.textContent = 'No indicator selected';
    indicatorIdEl.textContent = '';
    indicatorDescEl.textContent = '';
    datasetListEl.innerHTML = '';
    datasetDetailsEl.textContent = 'Adjust filters or search to see details';
    announce('No indicators found');
    return;
  }

  filteredIndicators.forEach(ind => {
    const btn = document.createElement('button');
  // Button with title and dataset count badge
  const titleSpan = document.createElement('span');
  titleSpan.textContent = ind.indicator;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = (ind.datasets?.length || 0).toString();
  btn.appendChild(titleSpan);
  btn.appendChild(badge);
    btn.dataset.id = ind.id;
    btn.tabIndex = 0;
    btn.setAttribute('aria-pressed', String(ind.id === selectedIndicatorId));
    btn.setAttribute('aria-label', `${ind.indicator} (${ind.datasets?.length || 0} datasets)`);
  // Assign category color to left border
  const catColor = getCategoryColor(ind.category);
  btn.style.setProperty('--cat-color', catColor);
    btn.onclick = () => {
      btn.classList.add('press');
      setTimeout(() => btn.classList.remove('press'), 120);
      renderDatasets(ind);
    };
    btn.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { renderDatasets(ind); } };
    indicatorButtonsEl.appendChild(btn);
  });
  highlightSelectedIndicator();

  // If current selection is filtered out, auto-select first visible indicator
  if (!filteredIndicators.find(i => i.id === selectedIndicatorId)) {
    renderDatasets(filteredIndicators[0]);
  }
  // micro fade-in
  requestAnimationFrame(() => { indicatorButtonsEl.style.opacity = '1'; });
}

function updateHeaderStats(filtered = null) {
  if (!statIndicatorsEl || !statDatasetsEl) return;
  const list = filtered || getFilteredIndicators();
  const indicatorCount = list.length;
  const datasetCount = list.reduce((acc, ind) => acc + (ind.datasets ? ind.datasets.length : 0), 0);
  statIndicatorsEl.textContent = String(indicatorCount);
  statDatasetsEl.textContent = String(datasetCount);
}

// Category legend removed

function renderCicMulti() {
  if (!cics.length || !cicCheckboxesEl) return;
  cicCheckboxesEl.innerHTML = '';
  // Sort by CIC id (numeric aware)
  const sorted = [...cics].sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  sorted.forEach(c => {
    const id = c.id;
    const desc = collapseWhitespace(c.description || c.impact || '');
    const area = c.area || '';
    const labelText = `${id}: ${desc}${area ? ` (${area})` : ''}`;
    const wrapper = document.createElement('label');
    const areaClass = area ? ` area-${area}` : '';
    wrapper.className = `cic-item${areaClass}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.checked = activeCicIds.has(id);
    cb.onchange = () => {
      if (cb.checked) activeCicIds.add(id); else activeCicIds.delete(id);
      renderIndicators();
      updateHash();
      syncCicControls();
    };
    const span = document.createElement('span');
    span.textContent = labelText;
    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    cicCheckboxesEl.appendChild(wrapper);
  });
  if (cicClearBtn) cicClearBtn.disabled = activeCicIds.size === 0;
  if (cicClearBtn) cicClearBtn.onclick = () => {
    activeCicIds.clear();
    renderIndicators();
    updateHash();
    syncCicControls();
  };
  if (cicMatchAllEl) {
    cicMatchAllEl.checked = cicMatchAll;
    cicMatchAllEl.onchange = () => {
      cicMatchAll = cicMatchAllEl.checked;
      renderIndicators();
      updateHash();
    };
  }
}

function syncCicControls() {
  // refresh checkbox states & clear button
  document.querySelectorAll('#cic-checkboxes input[type=checkbox]').forEach(cb => {
    cb.checked = activeCicIds.has(cb.value);
  });
  if (cicClearBtn) cicClearBtn.disabled = activeCicIds.size === 0;
}

function updateHash() {
  const parts = [];
  if (selectedIndicatorId) parts.push(`indicator=${encodeURIComponent(selectedIndicatorId)}`);
  if (selectedDatasetId) parts.push(`dataset=${encodeURIComponent(selectedDatasetId)}`);
  if (activeCicIds.size) parts.push(`cic=${encodeURIComponent([...activeCicIds].join(','))}`);
  if (cicMatchAll) parts.push('mode=all');
  const hash = parts.join('&');
  window.location.hash = hash || '';
}

function applyHash() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const indId = params.get('indicator');
  const dsId = params.get('dataset');
  const cicParam = params.get('cic');
  const mode = params.get('mode');
  if (!catalog.length) return;
  cicMatchAll = mode === 'all';
  activeCicIds.clear();
  if (cicParam) {
    cicParam.split(',').forEach(id => { if (id) activeCicIds.add(id); });
  }
  const filteredIndicators = getFilteredIndicators();
  let ind = filteredIndicators.find(i => i.id === indId) || filteredIndicators[0] || catalog[0];
  selectedDatasetId = dsId || null;
  if (ind) renderDatasets(ind);
  if (selectedDatasetId && ind && ind.datasets) {
    const ds = ind.datasets.find(d => d.id === selectedDatasetId);
    if (ds) renderDatasetDetails(ds);
  }
  bindCicChipHandlers();
  renderCicMulti(); // sync checkboxes
}

// Helpers
function safe(v) {
  return (v ?? '').toString();
}

function section(title, html) {
  if (!html || html === '<p></p>') return '';
  return `<div><strong>${title}:</strong> ${html}</div>`;
}

function pickDatasetUrl(ds) {
  // Prefer explicit url field if present
  if (ds.url && /^https?:\/\//i.test(ds.url)) return ds.url;
  // Try to extract first URL from source or citation fields
  const url = extractFirstUrl(ds.source) || extractFirstUrl(ds.citation) || null;
  return url;
}

function extractFirstUrl(text) {
  if (!text) return null;
  const m = String(text).match(/https?:\/\/[^\s)]+/i);
  return m ? m[0] : null;
}

// Copy deep link to clipboard
function copyDeepLink() {
  const url = new URL(window.location.href);
  if (!selectedIndicatorId) return;
  const params = new URLSearchParams();
  params.set('indicator', selectedIndicatorId);
  if (selectedDatasetId) params.set('dataset', selectedDatasetId);
  url.hash = params.toString();
  navigator.clipboard.writeText(url.toString()).then(() => {
    announce('Link copied to clipboard');
  }, () => {
    announce('Failed to copy link');
  });
}

function announce(msg) {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = msg; }, 10);
}

// Category color mapping
function getCategoryColor(category) {
  const map = {
    'Exposure': '#ffb84d',
    'Sensitivity': '#ff6b6b',
    'Adaptive Capacity': '#4dd0a6',
  };
  return map[category] || '#bcd5ff';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bindCicChipHandlers() {
  document.querySelectorAll('.cic-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cid = chip.getAttribute('data-cic');
      if (activeCicIds.has(cid)) activeCicIds.delete(cid); else activeCicIds.add(cid);
      renderIndicators();
      updateHash();
      renderCicMulti();
    });
  });
  document.querySelectorAll('.cic-chip').forEach(chip => {
    const cid = chip.getAttribute('data-cic');
    chip.classList.toggle('active', activeCicIds.has(cid));
  });
}

function collapseWhitespace(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

// ========== Resizable columns ==========
function applyWidths() {
  const rect = dashboardEl.getBoundingClientRect();
  const total = rect.width - 2 * parseFloat(getComputedStyle(dashboardEl).getPropertyValue('--gutter-size')) - parseFloat(getComputedStyle(dashboardEl).gap || 0) * 2; // approximate
  const min = 180; // px minimum for side panels
  const right = colRightPx != null ? colRightPx : Math.max(min, Math.floor(total * 0.35));
  const left = Math.max(min, colLeftPx);
  const middle = Math.max(min, total - left - right);
  dashboardEl.style.setProperty('--col-left', `${left}px`);
  dashboardEl.style.setProperty('--col-middle', `${middle}px`);
  dashboardEl.style.setProperty('--col-right', `${right}px`);
}

function saveWidths() {
  const val = {
    left: parseInt(getComputedStyle(dashboardEl).getPropertyValue('--col-left')) || colLeftPx,
    middle: parseInt(getComputedStyle(dashboardEl).getPropertyValue('--col-middle')) || 0,
    right: parseInt(getComputedStyle(dashboardEl).getPropertyValue('--col-right')) || 0,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(val));
}

function loadWidths() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const val = JSON.parse(raw);
    if (val && typeof val.left === 'number' && typeof val.right === 'number') {
      colLeftPx = val.left;
      colRightPx = val.right;
      dashboardEl.style.setProperty('--col-left', `${val.left}px`);
      dashboardEl.style.setProperty('--col-middle', `${val.middle}px`);
      dashboardEl.style.setProperty('--col-right', `${val.right}px`);
    }
  } catch (_) { /* ignore */ }
}

function startDrag(e, target) {
  isDragging = true;
  dragTarget = target; // 'g1' or 'g2'
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  (target === 'g1' ? gutter1 : gutter2).classList.add('dragging');
}

function onDrag(e) {
  if (!isDragging) return;
  const rect = dashboardEl.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const min = 180;
  const gutterSize = parseFloat(getComputedStyle(dashboardEl).getPropertyValue('--gutter-size'));
  if (dragTarget === 'g1') {
    colLeftPx = Math.max(min, Math.min(x, rect.width - min));
  } else if (dragTarget === 'g2') {
    // Right width computed from right edge
    const rightX = rect.width - x;
    colRightPx = Math.max(min, Math.min(rightX, rect.width - min));
  }
  applyWidths();
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  dragTarget = null;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  gutter1.classList.remove('dragging');
  gutter2.classList.remove('dragging');
  saveWidths();
}

function initResizers() {
  loadWidths();
  applyWidths();
  // Mouse/touch events
  gutter1.addEventListener('mousedown', e => startDrag(e, 'g1'));
  gutter2.addEventListener('mousedown', e => startDrag(e, 'g2'));
  gutter1.addEventListener('touchstart', e => { startDrag(e, 'g1'); e.preventDefault(); }, { passive: false });
  gutter2.addEventListener('touchstart', e => { startDrag(e, 'g2'); e.preventDefault(); }, { passive: false });
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);
  window.addEventListener('resize', applyWidths);

  // Keyboard resize (10px step, Shift = 50px)
  function keyResizeFactory(which) {
    const step = (e) => (e.shiftKey ? 50 : 10);
    return function(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = (e.key === 'ArrowLeft' ? -1 : 1) * step(e);
        if (which === 'g1') {
          colLeftPx = Math.max(180, colLeftPx + delta);
        } else {
          colRightPx = Math.max(180, (colRightPx || 300) - delta); // inverse on right gutter
        }
        applyWidths();
        saveWidths();
      }
    };
  }
  gutter1.addEventListener('keydown', keyResizeFactory('g1'));
  gutter2.addEventListener('keydown', keyResizeFactory('g2'));

  // Double-click to reset to defaults
  function resetWidths() {
    colLeftPx = 260;
    colRightPx = null; // recompute
    localStorage.removeItem(LS_KEY);
    applyWidths();
  }
  gutter1.ondblclick = resetWidths;
  gutter2.ondblclick = resetWidths;
}

// Fetch and initialize
fetch('catalog.json', { cache: 'no-cache' })
  .then(res => {
    if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
    return res.json();
  })
  .then(data => {
    if (Array.isArray(data)) {
      catalogObj = { generated_at: null, indicators: data, cics: [] };
    } else if (data && Array.isArray(data.indicators)) {
      catalogObj = data;
    } else {
      throw new Error('Catalog format invalid');
    }
    catalog = catalogObj.indicators || [];
    cics = catalogObj.cics || [];
    initResizers();
    initGlobalInputs();
    renderIndicators();
    if (window.location.hash) applyHash();
    else if (catalog[0]) renderDatasets(catalog[0]);
    window.addEventListener('hashchange', applyHash);
    bindCicChipHandlers();
  })
  .catch(err => {
    indicatorListEl.textContent = 'Failed to load catalog.';
    indicatorListEl.setAttribute('role', 'alert');
    console.error(err);
  });

// Toolbar actions
if (copyLinkBtn) {
  copyLinkBtn.onclick = copyDeepLink;
}

// Theme toggle
(function initTheme() {
  const KEY = 'dashboard.theme.v1';
  const root = document.documentElement;
  const pref = localStorage.getItem(KEY);
  if (pref === 'dark' || (!pref && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.setAttribute('data-theme', 'dark');
    if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
  }
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      localStorage.setItem(KEY, next);
      themeToggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }
})();

// High-contrast toggle
(function initHighContrast() {
  const KEY = 'dashboard.hc.v1';
  const root = document.documentElement;
  const pref = localStorage.getItem(KEY);
  if (pref === 'on') root.setAttribute('data-hc', 'on');
  if (hcToggleBtn) {
    hcToggleBtn.addEventListener('click', () => {
      const isOn = root.getAttribute('data-hc') === 'on';
      if (isOn) root.removeAttribute('data-hc'); else root.setAttribute('data-hc', 'on');
      localStorage.setItem(KEY, isOn ? 'off' : 'on');
    });
  }
})();
