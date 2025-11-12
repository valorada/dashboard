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

The dashboard now expects an object with indicators, datasets (nested per indicator), and climate impact chains (CICs). Minimal shape:

```json
{
	"generated_at": "2025-11-12T12:00:00Z",
	"indicators": [
		{
			"id": "ind001",
			"indicator": "Indicator name",
			"category": "Exposure",
			"description": "Paragraphs separated by a blank line.",
			"datasets": [
				{
					"id": "ds1",
					"name": "Dataset name",
					"description": "...",
					"source": "...",
					"citation": "...",
					"license": "...",
					"url": "https://example.org/dataset"
				}
			],
			"cic_ids": ["CIC01", "CIC03"]
		}
	],
	"cics": [
		{
			"id": "CIC01",
			"name": "Heatwave health impacts",
			"description": "Chain description...",
			"indicator_ids": ["ind001"],
			"indicator_count": 1
		}
	]
}
```

Deep-link support: link to indicator, dataset and optionally CIC via hash, e.g. `#indicator=ind001&dataset=ds1&cic=CIC01`.

## Generate catalog.json from CSVs

Source CSVs live in `valorada/catalog` under `data/`:
- indicators.csv
- datasets.csv
- links_indicator_to_data.csv
- cic.csv
- links_indicator_to_cic.csv

To regenerate `docs/catalog.json` by joining these three files:

```bash
python3 code/generate_catalog.py
```

This script fetches the CSVs from GitHub, builds the combined structure (including CICs), and overwrites `docs/catalog.json`.

After regeneration:
- CIC chips appear in indicator details.
- You can filter by CIC using the new Impact chain dropdown or by clicking a CIC chip.

## Acknowledgments

We acknowledge the use of GitHub Copilot, an AI-based code completion tool, which assisted in the development of the code used in this research.

## References

GitHub Copilot. GitHub, Inc. Available at: https://github.com/features/copilot
