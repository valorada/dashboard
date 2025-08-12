const indicatorListEl = document.getElementById('indicator-list');
const indicatorDetailsEl = document.getElementById('dataset-list');
const datasetListEl = indicatorDetailsEl.querySelector('ul');
const indicatorTitleEl = indicatorDetailsEl.querySelector('h2');
const indicatorIdEl = document.getElementById('indicator-id');
const indicatorDescEl = document.getElementById('indicator-description');
const datasetDetailsEl = document.getElementById('details-content');

let catalog = [];
let selectedIndicatorId = null;
let selectedDatasetId = null;

// Utility: format multiline description with paragraphs
function formatDescription(text) {
  return text
    .split('\n\n')
    .map(para => `<p>${para}</p>`)
    .join('');
}

function renderDatasetDetails(ds) {
  datasetDetailsEl.innerHTML = `
    <p><strong>ID:</strong> ${ds.id}</p>
    <p><strong>Name:</strong> ${ds.name}</p>
    <div><strong>Description:</strong> ${formatDescription(ds.description)}</div>
    <p><a href="${ds.url}" target="_blank" rel="noopener noreferrer">View dataset</a></p>
  `;
  selectedDatasetId = ds.id;
  updateHash();
}

function renderDatasets(ind) {
  indicatorTitleEl.textContent = ind.indicator;
  indicatorIdEl.textContent = `ID: ${ind.id}`;
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
  const buttons = indicatorListEl.querySelectorAll('button[data-id]');
  buttons.forEach(b => {
    if (b.dataset.id === selectedIndicatorId) b.classList.add('selected');
    else b.classList.remove('selected');
  });
}

function renderIndicators() {
  indicatorListEl.innerHTML = '';
  catalog.forEach(ind => {
    const btn = document.createElement('button');
    btn.textContent = ind.indicator;
    btn.dataset.id = ind.id;
    btn.tabIndex = 0;
    btn.setAttribute('aria-pressed', String(ind.id === selectedIndicatorId));
    btn.onclick = () => renderDatasets(ind);
    btn.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { renderDatasets(ind); } };
    indicatorListEl.appendChild(btn);
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
  const ind = catalog.find(i => i.id === indId) || catalog[0];
  selectedDatasetId = dsId || null;
  renderDatasets(ind);
  if (selectedDatasetId && ind.datasets) {
    const ds = ind.datasets.find(d => d.id === selectedDatasetId);
    if (ds) renderDatasetDetails(ds);
  }
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