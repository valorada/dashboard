# dashboard

A simple static catalog dashboard served from `docs/` (ready for GitHub Pages).

## Quick start

- Open `docs/index.html` in a browser, or serve locally to avoid CORS issues with `fetch`:

```bash
cd docs
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Structure

- `docs/index.html` – layout and markup
- `docs/style.css` – styling
- `docs/script.js` – interactivity and rendering
- `docs/catalog.json` – catalog data (indicators and datasets)

## Deploy (GitHub Pages)

1. Push to `main` with the site under `docs/`.
2. In GitHub: Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` and folder `docs/`.
3. Your site will be available at `https://<org-or-user>.github.io/<repo>/`.

## Editing the catalog

Update `docs/catalog.json` with your indicators and datasets. Minimal shape:

```json
[
	{
		"id": "ind001",
		"indicator": "Name",
		"description": "Markdown-like paragraphs separated by blank lines.",
		"datasets": [
			{ "id": "ds1", "name": "Dataset name", "description": "...", "url": "https://..." }
		]
	}
]
```

Deep-link support: you can link to a specific indicator or dataset using the hash, e.g. `#indicator=ind001&dataset=ds1`.

## Generate catalog.json from CSVs

Source CSVs live in `valorada/catalog` under `data/`:
- indicators.csv
- datasets.csv
- links_indicator_to_data.csv

To regenerate `docs/catalog.json` by joining these three files:

```bash
python3 code/generate_catalog.py
```

This script fetches the CSVs from GitHub, builds the combined structure, and overwrites `docs/catalog.json`.

## Acknowledgments

We acknowledge the use of GitHub Copilot, an AI-based code completion tool, which assisted in the development of the code used in this research.

## References

GitHub Copilot. GitHub, Inc. Available at: https://github.com/features/copilot
