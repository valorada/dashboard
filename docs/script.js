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

// Fetch and initialize
fetch('catalog.json', { cache: 'no-cache' })
  .then(res => {
    if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
    return res.json();
  })
  .then(data => {
    if (!Array.isArray(data)) throw new Error('Catalog format invalid');
    catalog = data;
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
