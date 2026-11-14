# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy"]
# ///
"""Compute terrain-horizon profiles from LOLA elevation models.

For each site in web/public/data/sites.json this casts 720 rays (0.5 degree spacing,
north first, clockwise) out to 250 km and records the highest elevation angle of the
terrain along each ray, as seen from 2 m above the ground at the site.

Elevation models, finest first. Each sample point uses the finest model that covers it:
  LDEM_80S_80M   south polar stereographic, 80 m/pixel, 80S to the pole   (optional, 115 MB)
  LDEM_75S_240M  south polar stereographic, 240 m/pixel, 75S to the pole  (29 MB)
  LDEM_16        global cylindrical, 16 pixels/degree, about 1.9 km       (33 MB)

Output, web/public/data/horizons/{id}.json (field names per the data contract in docs/PLAN.md):
  {"id", "lat", "lon", "az_step_deg": 0.5, "mast_m": 2.0, "elev_deg": [720 floats],
   "site_height_m", "resolution_m", "source"}

Run:  uv run pipeline/build_horizons.py            (downloads the 240 m and global models)
      uv run pipeline/build_horizons.py --fine     (also downloads the 80 m polar model)
Models are cached in pipeline/dem/ (git-ignored).

Original version by kamilovmuzaffarali (PR #2); extended with the polar models.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np

R_M = 1737400.0
HERE = Path(__file__).resolve().parent
SITES_JSON = HERE.parent / "web" / "public" / "data" / "sites.json"
OUT_DIR = HERE.parent / "web" / "public" / "data" / "horizons"
DEM_DIR = HERE / "dem"
BASE = "https://imbrium.mit.edu/DATA/LOLA_GDR"

N_AZ = 720
MAST_M = 2.0
# Ray sample distances in metres: dense near the site, coarser far away.
DIST_M = np.unique(
    np.concatenate(
        [
            np.arange(40.0, 4000.0, 40.0),
            np.arange(4000.0, 30000.0, 120.0),
            np.arange(30000.0, 250001.0, 500.0),
        ]
    )
)


def _label(text: str, key: str) -> float:
    m = re.search(rf"^\s*{re.escape(key)}\s*=\s*([-+0-9.eE]+)", text, re.MULTILINE)
    if not m:
        raise KeyError(key)
    return float(m.group(1))


@dataclass
class Dem:
    name: str
    url: str
    kind: str  # "polar_south" or "global"
    data: np.ndarray | None = None
    lines: int = 0
    samples: int = 0
    scale: float = 0.5  # metres per DN
    l0: float = 0.0  # LINE_PROJECTION_OFFSET
    s0: float = 0.0  # SAMPLE_PROJECTION_OFFSET
    map_scale_m: float = 0.0  # polar: metres per pixel
    ppd: float = 0.0  # global: pixels per degree
    max_lat: float = 90.0

    @property
    def resolution_m(self) -> float:
        return self.map_scale_m if self.kind == "polar_south" else (np.pi * R_M / 180.0) / self.ppd

    def load(self) -> "Dem":
        DEM_DIR.mkdir(exist_ok=True)
        img, lbl = DEM_DIR / f"{self.name}.IMG", DEM_DIR / f"{self.name}.LBL"
        for dest, ext in ((lbl, "LBL"), (img, "IMG")):
            if not dest.exists():
                print(f"downloading {self.name}.{ext} ...", flush=True)
                tmp = dest.with_suffix(dest.suffix + ".part")
                urllib.request.urlretrieve(f"{self.url}/{self.name}.{ext}", tmp)
                tmp.rename(dest)
        text = lbl.read_text("latin-1")
        self.lines = int(_label(text, "LINES"))
        self.samples = int(_label(text, "LINE_SAMPLES"))
        self.scale = _label(text, "SCALING_FACTOR")
        self.l0 = _label(text, "LINE_PROJECTION_OFFSET")
        self.s0 = _label(text, "SAMPLE_PROJECTION_OFFSET")
        if self.kind == "polar_south":
            self.map_scale_m = _label(text, "MAP_SCALE")
            self.max_lat = _label(text, "MAXIMUM_LATITUDE")
        else:
            self.ppd = _label(text, "MAP_RESOLUTION")
        self.data = np.memmap(img, dtype="<i2", mode="r", shape=(self.lines, self.samples))
        return self

    def pixel(self, lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Fractional 0-based (line, sample) of each point and a mask of points this model covers."""
        if self.kind == "polar_south":
            # PDS polar stereographic about the south pole (see DSMAP_POLAR.CAT):
            # x = (sample - S0) * scale, y = (L0 - line) * scale, lon = atan2(x, y).
            r = 2.0 * R_M * np.tan(np.radians(90.0 + lat) / 2.0)
            x = r * np.sin(np.radians(lon))
            y = r * np.cos(np.radians(lon))
            col = x / self.map_scale_m + self.s0
            row = self.l0 - y / self.map_scale_m
            ok = (lat <= self.max_lat) & (row >= 0) & (row <= self.lines - 1) & (col >= 0) & (col <= self.samples - 1)
            return row, col, ok
        # Global cylindrical, pixel-registered: the first sample is centred half a pixel in from the edge.
        col = (np.mod(lon, 360.0) * self.ppd - 0.5) % self.samples
        row = np.clip((90.0 - lat) * self.ppd - 0.5, 0, self.lines - 1)
        return row, col, np.ones(lat.shape, dtype=bool)

    def height(self, row: np.ndarray, col: np.ndarray) -> np.ndarray:
        """Bilinear height in metres above the 1737.4 km sphere."""
        assert self.data is not None
        r0 = np.clip(np.floor(row).astype(np.int64), 0, self.lines - 1)
        c0 = np.floor(col).astype(np.int64)
        fr, fc = row - r0, col - c0
        r1 = np.clip(r0 + 1, 0, self.lines - 1)
        if self.kind == "global":
            c0, c1 = c0 % self.samples, (c0 + 1) % self.samples
        else:
            c0 = np.clip(c0, 0, self.samples - 1)
            c1 = np.clip(c0 + 1, 0, self.samples - 1)
        d = self.data
        h = (
            d[r0, c0] * (1 - fr) * (1 - fc)
            + d[r0, c1] * (1 - fr) * fc
            + d[r1, c0] * fr * (1 - fc)
            + d[r1, c1] * fr * fc
        )
        return h * self.scale


def heights(dems: list[Dem], lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Height of each point from the finest model covering it, and the index of the model used."""
    out = np.full(lat.shape, np.nan)
    used = np.full(lat.shape, -1, dtype=np.int64)
    for i, dem in enumerate(dems):
        row, col, ok = dem.pixel(lat, lon)
        take = ok & np.isnan(out)
        if take.any():
            out[take] = dem.height(row[take], col[take])
            used[take] = i
    return out, used


def destination(lat0: float, lon0: float, az: np.ndarray, dist_m: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Great-circle destination points; az and dist broadcast against each other."""
    d = dist_m / R_M
    p0, l0 = np.radians(lat0), np.radians(lon0)
    sin_p1 = np.sin(p0) * np.cos(d) + np.cos(p0) * np.sin(d) * np.cos(az)
    p1 = np.arcsin(np.clip(sin_p1, -1.0, 1.0))
    l1 = l0 + np.arctan2(np.sin(az) * np.sin(d) * np.cos(p0), np.cos(d) - np.sin(p0) * sin_p1)
    return np.degrees(p1), np.degrees(l1)


def horizon(dems: list[Dem], lat: float, lon: float) -> tuple[np.ndarray, float, float]:
    site_h, site_used = heights(dems, np.array([lat]), np.array([lon]))
    h0 = float(site_h[0]) + MAST_M
    az = np.radians(np.arange(N_AZ) * 360.0 / N_AZ)[:, None]
    dist = DIST_M[None, :]
    plat, plon = destination(lat, lon, az, dist)
    hp, _ = heights(dems, plat, plon)
    # Exact elevation angle of a point at ground distance d and height hp, seen from height h0.
    ang = dist / R_M
    el = np.degrees(np.arctan2((R_M + hp) * np.cos(ang) - (R_M + h0), (R_M + hp) * np.sin(ang)))
    return el.max(axis=1), float(site_h[0]), dems[int(site_used[0])].resolution_m


def main() -> int:
    fine = "--fine" in sys.argv or (DEM_DIR / "LDEM_80S_80M.IMG").exists()
    dems = [
        Dem("LDEM_75S_240M", f"{BASE}/POLAR/IMG", "polar_south"),
        Dem("LDEM_16", f"{BASE}/CYLINDRICAL/IMG", "global"),
    ]
    if fine:
        dems.insert(0, Dem("LDEM_80S_80M", f"{BASE}/POLAR/IMG", "polar_south"))
    for dem in dems:
        dem.load()
    names = ", ".join(d.name for d in dems)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for site in json.loads(SITES_JSON.read_text()):
        lat, lon = float(site["lat"]), float(site["lon"])
        el, site_h, res = horizon(dems, lat, lon)
        out = {
            "id": site["id"],
            "lat": lat,
            "lon": lon,
            "az_step_deg": 360.0 / N_AZ,
            "mast_m": MAST_M,
            "elev_deg": [round(float(v), 4) for v in el],
            "site_height_m": round(site_h, 1),
            "resolution_m": round(res),
            "source": f"LOLA GDR ({names}); finest model covering each point",
        }
        (OUT_DIR / f"{site['id']}.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
        print(
            f"{site['id']:24s} height {site_h:8.1f} m  skyline {el.min():6.2f} .. {el.max():5.2f} deg  "
            f"({res:.0f} m model at the site)",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
