# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Fetch Sun and Earth azimuth/elevation at lunar surface sites from JPL Horizons.

These are the ground truth the web app's core math is tested against.
Output: web/src/core/fixtures/horizons.json

Run:  uv run pipeline/fetch_horizons_fixtures.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
OUT = Path(__file__).resolve().parent.parent / "web" / "src" / "core" / "fixtures" / "horizons.json"

# (label, east longitude deg, latitude deg, altitude km). Geometry test points, not mission sites.
SITES = [
    ("south-pole-ridge", 225.0, -89.5, 0.0),
    ("south-85", 31.0, -85.0, 0.0),
    ("south-85-high", 31.0, -85.0, 5.0),
    ("north-pole", 10.0, 89.0, 0.0),
    ("sub-earth", 0.0, 0.0, 0.0),
    ("east-limb", 85.0, 10.0, 0.0),
    ("west-limb", 275.0, -20.0, 0.0),
    ("farside", 180.0, -45.0, 0.0),
    ("mid-north", 23.47, 0.67, -1.9),
    ("mid-south", 32.3, -69.4, 0.0),
]
BODIES = {"sun": "10", "earth": "399"}
START, STOP, STEP = "2026-12-01", "2027-12-01", "13 d"

MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def query(command: str, lon: float, lat: float, alt: float) -> list[dict]:
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},{alt}'",
        "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        text = r.read().decode()
    if "$$SOE" not in text:
        raise RuntimeError(f"Horizons returned no table:\n{text[-800:]}")
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        date, hm = cells[0].split()
        y, mon, d = date.split("-")
        h, m = hm.split(":")
        t = datetime(int(y), MONTHS[mon], int(d), int(h), int(m), tzinfo=timezone.utc)
        nums = [float(c) for c in cells[1:] if c and c.replace(".", "").replace("-", "").isdigit()]
        rows.append({"t": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "az": nums[-2], "el": nums[-1]})
    return rows


def main() -> None:
    out = {
        "source": "JPL Horizons API, OBSERVER table, quantity 4 (apparent azimuth/elevation, airless)",
        "fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cases": [],
    }
    for label, lon, lat, alt in SITES:
        for body, cmd in BODIES.items():
            print(f"{label} / {body}", flush=True)
            rows = query(cmd, lon, lat, alt)
            out["cases"].append(
                {"site": label, "lon": lon, "lat": lat, "alt_m": alt * 1000, "body": body, "rows": rows}
            )
            time.sleep(0.5)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {sum(len(c['rows']) for c in out['cases'])} rows -> {OUT}")


if __name__ == "__main__":
    main()
