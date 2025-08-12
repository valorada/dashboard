let catalogData = [];

async function loadCatalog() {
  const res = await fetch('catalog.json');
  catalogData = await res.json();
  renderIndicators(catalogData);
}

function renderIndicators(data) {
  const indicatorList = document.getElementById('indicator-list');
  indicatorList.innerHTML = '';
  data.forEach(ind => {
    const btn = document.createElement('button');
    btn.textContent = ind.indicator;
    btn.onclick = () => renderDatasets(ind);
    indicatorList.appendChild(btn);
  });
}

function renderDatasets(ind) {
  const listContainer = document.querySelector('#dataset-list ul');
  document.querySelector('#dataset-list h2').textContent = ind.indicator;
  listContainer.innerHTML = '';
  ind.datasets.forEach(ds => {
    const li = document.createElement('li');
    li.textContent = ds.name;
    li.onclick = () => renderDatasetDetails(ds);
    listContainer.appendChild(li);
  });
}

function renderDatasetDetails(ds) {
  const details = document.getElementById('details-content');
  details.innerHTML = `
    <p><strong>ID:</strong> ${ds.id}</p>
    <p><strong>Name:</strong> ${ds.name}</p>
    <p><strong>Description:</strong> ${ds.description}</p>
    <p><a href="${ds.url}" target="_blank">View dataset</a></p>
  `;
}

loadCatalog();
