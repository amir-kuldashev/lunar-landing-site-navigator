# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy"]
# ///
"""Build a grid of terrain skylines and slopes over the lunar south pole.

Lets the web app score every cell of the polar region for a chosen date, instead of only named sites.

Grid: square cells in south polar stereographic projection, SPACING_KM apart, covering everything
south of LAT_MAX. For each cell centre:
  - skyline: highest terrain elevation angle along AZ_N compass directions out to 250 km, seen from
    2 m above the ground (same method as build_horizons.py, coarser sampling)
  - height: terrain height above the 1737.4 km sphere
  - slope: mean surface slope inside the cell, measured over a 160 m baseline on the 80 m LOLA model

Output, web/public/data/:
  polar_grid.json  header: counts, spacing, encodings and byte offsets
  polar_grid.bin   lat  float32[n] | lon float32[n] | height_m int16[n] | slope uint8[n] (0.5 deg units)
                   | skyline int8[n * az_n] (0.1 deg units, clipped to -12.8..12.7)

Run:  uv run pipeline/build_polar_grid.py     (needs the LOLA models; build_horizons.py --fine fetches them)
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

from build_horizons import BASE, MAST_M, R_M, Dem, destination, heights

OUT_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

LAT_MAX = -83.0
SPACING_KM = 4.0
AZ_N = 180
DIST_M = np.unique(
    np.concatenate(
        [np.arange(80.0, 4000.0, 80.0), np.arange(4000.0, 30000.0, 300.0), np.arange(30000.0, 250001.0, 1000.0)]
    )
)
SLOPE_BASE_M = 80.0  # half-baseline: slope is measured between points 160 m apart
SUB = 9  # slope sample points per cell side


def xy_to_latlon(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    r = np.hypot(x, y)
    lat = -90.0 + np.degrees(2.0 * np.arctan(r / (2.0 * R_M)))
    lon = np.degrees(np.arctan2(x, y))
    return lat, lon


def main() -> int:
    dems = [
        Dem("LDEM_80S_80M", f"{BASE}/POLAR/IMG", "polar_south").load(),
        Dem("LDEM_75S_240M", f"{BASE}/POLAR/IMG", "polar_south").load(),
        Dem("LDEM_16", f"{BASE}/CYLINDRICAL/IMG", "global").load(),
    ]

    r_max = 2.0 * R_M * np.tan(np.radians(90.0 + LAT_MAX) / 2.0)
    step = SPACING_KM * 1000.0
    half = int(np.floor(r_max / step))
    axis = np.arange(-half, half + 1) * step
    gx, gy = np.meshgrid(axis, axis)
    keep = np.hypot(gx, gy) <= r_max
    cx, cy = gx[keep], gy[keep]
    n = cx.size
    lat, lon = xy_to_latlon(cx, cy)
    print(f"{n} cells, {SPACING_KM} km apart, south of {LAT_MAX} deg", flush=True)

    # Slope: finite differences on a sub-grid inside each cell.
    off = (np.arange(SUB) + 0.5) / SUB * step - step / 2.0
    ox, oy = np.meshgrid(off, off)
    slope = np.empty(n, dtype=np.float64)
    height = np.empty(n, dtype=np.float64)

    def h_at(x: np.ndarray, y: np.ndarray) -> np.ndarray:
        la, lo = xy_to_latlon(x, y)
        return heights(dems, la, lo)[0]

    for i in range(n):
        sx, sy = cx[i] + ox, cy[i] + oy
        dzdx = (h_at(sx + SLOPE_BASE_M, sy) - h_at(sx - SLOPE_BASE_M, sy)) / (2 * SLOPE_BASE_M)
        dzdy = (h_at(sx, sy + SLOPE_BASE_M) - h_at(sx, sy - SLOPE_BASE_M)) / (2 * SLOPE_BASE_M)
        slope[i] = np.degrees(np.arctan(np.hypot(dzdx, dzdy))).mean()
    print("slopes done", flush=True)

    az = np.radians(np.arange(AZ_N) * 360.0 / AZ_N)[:, None]
    dist = DIST_M[None, :]
    ang = dist / R_M
    cos_a, sin_a = np.cos(ang), np.sin(ang)
    sky = np.empty((n, AZ_N), dtype=np.float64)
    t0 = time.time()
    for i in range(n):
        h0 = float(heights(dems, lat[i : i + 1], lon[i : i + 1])[0][0])
        height[i] = h0
        plat, plon = destination(float(lat[i]), float(lon[i]), az, dist)
        hp, _ = heights(dems, plat, plon)
        el = np.degrees(np.arctan2((R_M + hp) * cos_a - (R_M + h0 + MAST_M), (R_M + hp) * sin_a))
        sky[i] = el.max(axis=1)
        if i % 1000 == 0:
            print(f"  skylines {i}/{n}  ({time.time() - t0:.0f} s)", flush=True)

    lat32 = lat.astype("<f4")
    lon32 = lon.astype("<f4")
    h16 = np.clip(np.round(height), -32768, 32767).astype("<i2")
    s8 = np.clip(np.round(slope * 2.0), 0, 255).astype(np.uint8)
    k8 = np.clip(np.round(sky * 10.0), -128, 127).astype(np.int8)

    parts = [lat32.tobytes(), lon32.tobytes(), h16.tobytes(), s8.tobytes(), k8.tobytes()]
    offsets, pos = [], 0
    for p in parts:
        offsets.append(pos)
        pos += len(p)
    (OUT_DIR / "polar_grid.bin").write_bytes(b"".join(parts))
    header = {
        "n": int(n),
        "az_n": AZ_N,
        "spacing_km": SPACING_KM,
        "lat_max": LAT_MAX,
        "mast_m": MAST_M,
        "offsets": dict(zip(["lat", "lon", "height_m", "slope", "skyline"], offsets)),
        "slope_unit_deg": 0.5,
        "skyline_unit_deg": 0.1,
        "slope_baseline_m": 2 * SLOPE_BASE_M,
        "source": "LOLA GDR (LDEM_80S_80M, LDEM_75S_240M, LDEM_16)",
    }
    (OUT_DIR / "polar_grid.json").write_text(json.dumps(header, indent=2) + "\n")
    clipped = float((sky > 12.7).mean() * 100)
    print(
        f"wrote {n} cells, {pos / 1e6:.2f} MB. slope median {np.median(slope):.1f} deg, "
        f"over 15 deg: {(slope > 15).mean() * 100:.0f}% of cells. skyline values clipped at 12.7 deg: {clipped:.2f}%"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
