const indicatorListEl = document.getElementById('indicator-list');
const indicatorDetailsEl = document.getElementById('dataset-list');
const datasetListEl = indicatorDetailsEl.querySelector('ul');
const indicatorTitleEl = indicatorDetailsEl.querySelector('h2');
const indicatorIdEl = document.getElementById('indicator-id');
const indicatorDescEl = document.getElementById('indicator-description');
const datasetDetailsEl = document.getElementById('details-content');

let catalog = [];

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
}

function renderDatasets(ind) {
  indicatorTitleEl.textContent = ind.indicator;
  indicatorIdEl.textContent = `ID: ${ind.id}`;
  indicatorDescEl.innerHTML = formatDescription(ind.description);

  datasetListEl.innerHTML = '';
  ind.datasets.forEach(ds => {
    const li = document.createElement('li');
    li.textContent = ds.name;
    li.tabIndex = 0;
    li.style.cursor = 'pointer';
    li.onclick = () => renderDatasetDetails(ds);
    li.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { renderDatasetDetails(ds); } };
    datasetListEl.appendChild(li);
  });

  datasetDetailsEl.textContent = 'Select a dataset to see details';
}

function renderIndicators() {
  catalog.forEach(ind => {
    const btn = document.createElement('button');
    btn.textContent = ind.indicator;
    btn.tabIndex = 0;
    btn.onclick = () => renderDatasets(ind);
    btn.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { renderDatasets(ind); } };
    indicatorListEl.appendChild(btn);
  });
}

// Fetch and initialize
fetch('catalog.json')
  .then(res => res.json())
  .then(data => {
    catalog = data;
    renderIndicators();
  })
  .catch(err => {
    indicatorListEl.textContent = 'Failed to load catalog.';
    console.error(err);
  });