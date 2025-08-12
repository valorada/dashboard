#!/usr/bin/env python3
"""
Generate docs/catalog.json by joining three CSVs from valorada/catalog:
  - indicators.csv (indicator_id, category, name, source, description)
  - datasets.csv (dataset_id, name, description, source, citation, license)
  - links_indicator_to_data.csv (indicator_id, dataset_id)

Writes a JSON array with shape:
[
  {
    "id": "I1001",
    "indicator": "Number of households affected by drought",
    "category": "Exposure",
    "source": "...",
    "description": "...",
    "datasets": [
      {
        "id": "D0005",
        "name": "Areas affected by drought ...",
        "description": "...",
        "source": "...",
        "citation": "...",
        "license": "..."
      }
    ]
  }
]

The output matches the dashboard UI while enriching fields for details.
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from pathlib import Path
from typing import Dict, List

BASE = "https://raw.githubusercontent.com/valorada/catalog/main/data"
URLS = {
    "indicators": f"{BASE}/indicators.csv",
    "datasets": f"{BASE}/datasets.csv",
    "links": f"{BASE}/links_indicator_to_data.csv",
}


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url) as r:  # nosec - public data
        # Try to detect encoding; default to utf-8
        charset = r.headers.get_content_charset() or "utf-8"
        return r.read().decode(charset, errors="replace")


def read_csv(url: str) -> List[dict]:
    text = fetch_text(url)
    # Use io.StringIO to handle multi-line fields properly
    buf = io.StringIO(text, newline="")
    reader = csv.DictReader(buf)
    rows: List[dict] = []
    for row in reader:
        # Normalize whitespace: strip spaces around values
        cleaned = {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        rows.append(cleaned)
    return rows


def build_catalog() -> List[dict]:
    indicators = read_csv(
        URLS["indicators"]
    )  # indicator_id, category, name, source, description
    datasets = read_csv(
        URLS["datasets"]
    )  # dataset_id, name, description, source, citation, license
    links = read_csv(URLS["links"])  # indicator_id, dataset_id

    # Index datasets by id
    ds_by_id: Dict[str, dict] = {}
    for ds in datasets:
        ds_id = ds.get("dataset_id")
        if not ds_id:
            continue
        # Keep only known fields and standardize keys
        ds_entry = {
            "id": ds_id,
            "name": ds.get("name", "").strip(),
            "description": ds.get("description", "").strip(),
            "source": ds.get("source", "").strip(),
            "citation": ds.get("citation", "").strip(),
            "license": ds.get("license", "").strip(),
        }
        ds_by_id[ds_id] = ds_entry

    # Build mapping from indicator to datasets
    link_map: Dict[str, List[str]] = {}
    for lk in links:
        ind_id = lk.get("indicator_id")
        ds_id = lk.get("dataset_id")
        if not ind_id or not ds_id:
            continue
        link_map.setdefault(ind_id, []).append(ds_id)

    # Compose catalog
    catalog: List[dict] = []

    # Sort indicators by category then name for stable order
    def ind_sort_key(ind: dict):
        return (ind.get("category", ""), ind.get("name", ""))

    for ind in sorted(indicators, key=ind_sort_key):
        ind_id = ind.get("indicator_id")
        if not ind_id:
            continue
        datasets_ids = link_map.get(ind_id, [])
        # Deduplicate while preserving insertion order
        seen = set()
        ds_list: List[dict] = []
        for ds_id in datasets_ids:
            if ds_id in seen:
                continue
            seen.add(ds_id)
            ds_entry = ds_by_id.get(ds_id)
            if ds_entry:
                ds_list.append(ds_entry)
        # Sort datasets by name
        ds_list.sort(key=lambda d: d.get("name", ""))

        entry = {
            "id": ind_id,
            # Keep the UI-compatible key name for display
            "indicator": ind.get("name", "").strip(),
            "category": ind.get("category", "").strip(),
            "source": ind.get("source", "").strip(),
            "description": ind.get("description", "").strip(),
            "datasets": ds_list,
        }
        catalog.append(entry)

    return catalog


def main(argv: List[str]) -> int:
    out_path = Path(__file__).resolve().parents[1] / "docs" / "catalog.json"
    catalog = build_catalog()
    out_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {out_path} with {len(catalog)} indicators.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
