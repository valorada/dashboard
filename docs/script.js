const indicatorListEl = document.getElementById('indicator-list');
const indicatorButtonsEl = document.getElementById('indicator-buttons');
const categorySelectEl = document.getElementById('category-select');
const indicatorDetailsEl = document.getElementById('dataset-list');
const datasetListEl = indicatorDetailsEl.querySelector('ul');
const indicatorTitleEl = indicatorDetailsEl.querySelector('h2');
const indicatorIdEl = document.getElementById('indicator-id');
const indicatorDescEl = document.getElementById('indicator-description');
const datasetDetailsEl = document.getElementById('details-content');

let catalog = [];
let selectedIndicatorId = null;
let selectedDatasetId = null;
let selectedCategory = '';

// Resizable columns state
const dashboardEl = document.getElementById('dashboard');
const gutter1 = document.getElementById('gutter-1');
const gutter2 = document.getElementById('gutter-2');
const LS_KEY = 'dashboard.col.widths.v1';
let colLeftPx = 260; // initial fallback
let colRightPx = null; // computed from container when needed
let isDragging = false;
let dragTarget = null; // 'g1' or 'g2'

// Get unique categories from catalog
function getCategories() {
  const categories = [...new Set(catalog.map(ind => ind.category).filter(Boolean))];
  return categories.sort();
}

// Utility: format multiline description with paragraphs
function formatDescription(text) {
  return text
    .split('\n\n')
    .map(para => `<p>${para}</p>`)
    .join('');
}

function renderDatasetDetails(ds) {
  const link = pickDatasetUrl(ds);
  datasetDetailsEl.innerHTML = `
    <p><strong>ID:</strong> ${safe(ds.id)}</p>
    <p><strong>Name:</strong> ${safe(ds.name)}</p>
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
  const metaBits = [
    ind.id ? `ID: ${ind.id}` : null,
    ind.category ? `Category: ${ind.category}` : null,
  ].filter(Boolean).join(' • ');
  indicatorIdEl.textContent = metaBits;
  indicatorDescEl.innerHTML = formatDescription(ind.description);

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

  datasetDetailsEl.textContent = 'Select a dataset to see details';
}

function highlightSelectedIndicator() {
  const buttons = indicatorButtonsEl.querySelectorAll('button[data-id]');
  buttons.forEach(b => {
    if (b.dataset.id === selectedIndicatorId) b.classList.add('selected');
    else b.classList.remove('selected');
  });
}

function renderCategoryFilter() {
  const categories = getCategories();
  categorySelectEl.innerHTML = '<option value="">All categories</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (category === selectedCategory) option.selected = true;
    categorySelectEl.appendChild(option);
  });

  categorySelectEl.onchange = () => {
    selectedCategory = categorySelectEl.value;
    renderIndicators();
  };
}

function getFilteredIndicators() {
  if (!selectedCategory) return catalog;
  return catalog.filter(ind => ind.category === selectedCategory);
}

function renderIndicators() {
  indicatorButtonsEl.innerHTML = '';
  const filteredIndicators = getFilteredIndicators();

  filteredIndicators.forEach(ind => {
    const btn = document.createElement('button');
    btn.textContent = ind.indicator;
    btn.dataset.id = ind.id;
    btn.tabIndex = 0;
    btn.setAttribute('aria-pressed', String(ind.id === selectedIndicatorId));
    btn.onclick = () => renderDatasets(ind);
    btn.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { renderDatasets(ind); } };
    indicatorButtonsEl.appendChild(btn);
  });
  highlightSelectedIndicator();
}

function updateHash() {
  const parts = [];
  if (selectedIndicatorId) parts.push(`indicator=${encodeURIComponent(selectedIndicatorId)}`);
  if (selectedDatasetId) parts.push(`dataset=${encodeURIComponent(selectedDatasetId)}`);
  const hash = parts.join('&');
  if (hash) window.location.hash = hash; else window.location.hash = '';
}

function applyHash() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const indId = params.get('indicator');
  const dsId = params.get('dataset');
  if (!catalog.length) return;

  let ind = catalog.find(i => i.id === indId);
  if (ind) {
    // If the indicator exists, check if we need to update the category filter
    if (selectedCategory && ind.category !== selectedCategory) {
      selectedCategory = ind.category;
      renderCategoryFilter();
      renderIndicators();
    }
  } else {
    // Fallback to first available indicator (considering filter)
    const filteredIndicators = getFilteredIndicators();
    ind = filteredIndicators[0] || catalog[0];
  }

  selectedDatasetId = dsId || null;
  if (ind) renderDatasets(ind);
  if (selectedDatasetId && ind && ind.datasets) {
    const ds = ind.datasets.find(d => d.id === selectedDatasetId);
    if (ds) renderDatasetDetails(ds);
  }
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
    if (!Array.isArray(data)) throw new Error('Catalog format invalid');
    catalog = data;
  initResizers();
    renderCategoryFilter();
    renderIndicators();
    // Apply deep link if present, else select first indicator by default
    if (window.location.hash) applyHash();
    else if (catalog[0]) renderDatasets(catalog[0]);
    window.addEventListener('hashchange', applyHash);
  })
  .catch(err => {
    indicatorListEl.textContent = 'Failed to load catalog.';
    indicatorListEl.setAttribute('role', 'alert');
    console.error(err);
  });
