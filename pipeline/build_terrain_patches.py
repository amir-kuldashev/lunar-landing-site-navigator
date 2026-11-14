# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy"]
# ///
"""Cut a square block of terrain around each named site, for the 3D landscape view.

For every site in web/public/data/sites.json this samples a grid of heights centred on the site,
aligned to local east and north, from the finest LOLA model covering each point.

  South of 80S (80 m polar model):  60 km across, 97 x 97 samples (625 m apart)
  Elsewhere (1.9 km global model): 160 km across, 81 x 81 samples (2 km apart)

It also records a few facts about the ground at the site itself: height, slope, and the lowest and
highest ground within 10 km.

Output, web/public/data/:
  terrain.bin   for each site in turn, n*n little-endian int16 heights in metres above the 1737.4 km
                sphere, row by row from the north edge to the south edge, each row west to east
  terrain.json  {id: {offset, n, width_km, spacing_m, resolution_m, height_m, slope_deg,
                      slope_baseline_m, low_10km_m, high_10km_m}}

Run:  uv run pipeline/build_terrain_patches.py     (needs the LOLA models from build_horizons.py --fine)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from build_horizons import BASE, R_M, Dem, destination, heights

HERE = Path(__file__).resolve().parent
SITES_JSON = HERE.parent / "web" / "public" / "data" / "sites.json"
OUT_DIR = HERE.parent / "web" / "public" / "data"


def local_points(lat: float, lon: float, east_m: np.ndarray, north_m: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Latitude and longitude of points given as east/north offsets from a site, along great circles."""
    dist = np.hypot(east_m, north_m)
    az = np.arctan2(east_m, north_m)
    return destination(lat, lon, az, dist)


def main() -> int:
    dems = [
        Dem("LDEM_80S_80M", f"{BASE}/POLAR/IMG", "polar_south").load(),
        Dem("LDEM_75S_240M", f"{BASE}/POLAR/IMG", "polar_south").load(),
        Dem("LDEM_16", f"{BASE}/CYLINDRICAL/IMG", "global").load(),
    ]
    index: dict[str, dict] = {}
    blobs: list[bytes] = []
    offset = 0
    for site in json.loads(SITES_JSON.read_text()):
        lat, lon = float(site["lat"]), float(site["lon"])
        _, used = heights(dems, np.array([lat]), np.array([lon]))
        res = dems[int(used[0])].resolution_m
        polar = res < 500
        n, width_m = (97, 60_000.0) if polar else (81, 160_000.0)

        axis = (np.arange(n) / (n - 1) - 0.5) * width_m
        east, north = np.meshgrid(axis, -axis)  # row 0 is the north edge
        plat, plon = local_points(lat, lon, east, north)
        h, _ = heights(dems, plat, plon)

        # Ground at the site: slope across two model pixels, by central differences.
        b = res
        e = np.array([b, -b, 0.0, 0.0])
        nn = np.array([0.0, 0.0, b, -b])
        slat, slon = local_points(lat, lon, e, nn)
        sh, _ = heights(dems, slat, slon)
        slope = float(np.degrees(np.arctan(np.hypot((sh[0] - sh[1]) / (2 * b), (sh[2] - sh[3]) / (2 * b)))))
        h0 = float(heights(dems, np.array([lat]), np.array([lon]))[0][0])
        near = np.hypot(east, north) <= 10_000.0

        data = np.clip(np.round(h), -32768, 32767).astype("<i2").tobytes()
        index[site["id"]] = {
            "offset": offset,
            "n": n,
            "width_km": width_m / 1000.0,
            "spacing_m": round(width_m / (n - 1)),
            "resolution_m": round(res),
            "height_m": round(h0, 1),
            "slope_deg": round(slope, 1),
            "slope_baseline_m": round(2 * b),
            "low_10km_m": round(float(h[near].min())),
            "high_10km_m": round(float(h[near].max())),
        }
        blobs.append(data)
        offset += len(data)
        print(
            f"{site['id']:20s} {n}x{n} over {width_m / 1000:.0f} km  height {h0:8.1f} m  slope {slope:4.1f} deg  "
            f"within 10 km: {h[near].min():7.0f} .. {h[near].max():6.0f} m",
            flush=True,
        )

    (OUT_DIR / "terrain.bin").write_bytes(b"".join(blobs))
    (OUT_DIR / "terrain.json").write_text(json.dumps(index, indent=1) + "\n")
    print(f"wrote {len(index)} blocks, {offset / 1e3:.0f} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
