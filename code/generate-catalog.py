#!/usr/bin/env python3
"""
Generate docs/catalog.json by joining CSVs from valorada/catalog:
    - indicators.csv (indicator_id, category, name, source, description)
    - datasets.csv (dataset_id, name, description, source, citation, license)
    - links_indicator_to_data.csv (indicator_id, dataset_id)
    - cic.csv (cic_id, name, description)
    - links_indicator_to_cic.csv (indicator_id, cic_id)

Writes a JSON object with shape:
{
    "generated_at": "2025-11-12T12:00:00Z",
    "indicators": [
        {
            "id": "I1001",
            "indicator": "Number of households affected by drought",
            "category": "Exposure",
            "source": "...",
            "description": "...",
            "datasets": [ { "id": "D0005", "name": "...", "description": "...", "source": "...", "citation": "...", "license": "..." } ],
            "cic_ids": ["CIC01", "CIC03"]
        }
    ],
    "cics": [
        { "id": "CIC01", "name": "Heatwave health impacts", "description": "...", "indicator_ids": ["I1001"], "indicator_count": 1 }
    ]
}

The dashboard can then show CIC chips and filter indicators by CIC.
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
    "links_data": f"{BASE}/links_indicator_to_data.csv",
    "cics": f"{BASE}/cic.csv",
    "links_cic": f"{BASE}/links_indicator_to_cic.csv",
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


def build_catalog() -> dict:
    indicators_rows = read_csv(
        URLS["indicators"]
    )  # indicator_id, category, name, source, description
    datasets_rows = read_csv(
        URLS["datasets"]
    )  # dataset_id, name, description, source, citation, license
    links_rows = read_csv(URLS["links_data"])  # indicator_id, dataset_id
    cics_rows = read_csv(URLS["cics"])  # cic_id, name, description
    links_cic_rows = read_csv(URLS["links_cic"])  # indicator_id, cic_id

    # Index datasets by id
    ds_by_id: Dict[str, dict] = {}
    for ds in datasets_rows:
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
    for lk in links_rows:
        ind_id = lk.get("indicator_id")
        ds_id = lk.get("dataset_id")
        if not ind_id or not ds_id:
            continue
        link_map.setdefault(ind_id, []).append(ds_id)

    # Compose catalog
    indicators_out: List[dict] = []

    # Pre-build CIC mapping indicator_id -> list[cic_id]
    cic_ids_by_indicator: Dict[str, List[str]] = {}
    for lk in links_cic_rows:
        ind_id = lk.get("indicator_id")
        cic_id = lk.get("cic_id")
        if not ind_id or not cic_id:
            continue
        cic_ids_by_indicator.setdefault(ind_id, []).append(cic_id)

    # CIC aggregation for reverse lookup
    indicators_by_cic: Dict[str, List[str]] = {}
    for ind_id, cic_list in cic_ids_by_indicator.items():
        for cic_id in cic_list:
            indicators_by_cic.setdefault(cic_id, []).append(ind_id)

    # Sort indicators by category then name for stable order
    def ind_sort_key(ind: dict):
        return (ind.get("category", ""), ind.get("name", ""))

    for ind in sorted(indicators_rows, key=ind_sort_key):
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
        # Attach cic ids (deduplicated, stable order)
        cic_list = cic_ids_by_indicator.get(ind_id, [])
        if cic_list:
            seen_cic = set()
            dedup_cic: List[str] = []
            for cid in cic_list:
                if cid in seen_cic:
                    continue
                seen_cic.add(cid)
                dedup_cic.append(cid)
            entry["cic_ids"] = dedup_cic
        indicators_out.append(entry)

    # Build CIC objects
    cics_out: List[dict] = []
    for cic in cics_rows:
        cic_id = cic.get("cic_id") or cic.get("id")
        if not cic_id:
            continue
        inds = indicators_by_cic.get(cic_id, [])
        # cic.csv columns: cic_id, area, description, impact
        raw_name = cic.get("name")  # may not exist
        area = (cic.get("area") or "").strip()
        impact = (cic.get("impact") or "").strip()
        desc = (cic.get("description") or "").strip()
        # Fallback order for display name: impact > area > cic_id
        display = (impact or area or cic_id).strip()
        obj = {
            "id": cic_id,
            "name": (raw_name or display).strip(),
            "area": area,
            "impact": impact,
            "description": desc,
            "indicator_ids": sorted(set(inds)),
            "indicator_count": len(set(inds)),
        }
        cics_out.append(obj)
    # Sort CICs by name
    cics_out.sort(key=lambda c: c.get("name", ""))

    return {
        "generated_at": __import__("datetime")
        .datetime.utcnow()
        .isoformat(timespec="seconds")
        + "Z",
        "indicators": indicators_out,
        "cics": cics_out,
    }


def main(argv: List[str]) -> int:
    out_path = Path(__file__).resolve().parents[1] / "docs" / "catalog.json"
    catalog_obj = build_catalog()
    out_path.write_text(
        json.dumps(catalog_obj, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {out_path} with {len(catalog_obj['indicators'])} indicators and {len(catalog_obj['cics'])} CICs."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
