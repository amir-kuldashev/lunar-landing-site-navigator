# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy"]
# ///
"""Compute terrain-horizon profiles from the LOLA GDR (16 ppd) DEM.

For each site in web/public/data/sites.json, ray-marches 720 azimuths
(0.5 degree spacing) out to 200 km, applying lunar-curvature correction,
and writes web/public/data/horizons/{id}.json.

Output per site:
  {
    "id": "...",
    "lat": ..., "lon": ...,
    "azimuth_step_deg": 0.5,
    "n_azimuths": 720,
    "elevations_deg": [...],   # 720 floats, one per 0.5-deg azimuth
    "source": "LOLA GDR 16ppd LDEM_16.IMG"
  }

Run:  uv run pipeline/build_horizons.py
DEM is downloaded once into pipeline/dem/ (~33 MB, git-ignored).
"""
from __future__ import annotations

import json
import math
import re
import sys
import urllib.request
from pathlib import Path
from typing import NamedTuple

import numpy as np

MOON_R_KM = 1737.4
D2R = math.pi / 180.0

HERE = Path(__file__).resolve().parent
SITES_JSON = HERE.parent / "web" / "public" / "data" / "sites.json"
OUT_DIR = HERE.parent / "web" / "public" / "data" / "horizons"
DEM_DIR = HERE / "dem"

DEM_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_16.IMG"
DEM_LBL_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_16.LBL"
DEM_PPD = 16

N_AZ = 720
AZ_STEP = 360.0 / N_AZ       # 0.5 degrees
MAX_RANGE_KM = 200.0
STEP_KM = 2.0                 # ray-march step
OBS_HEIGHT_M = 2.0            # observer height above terrain


class DEM(NamedTuple):
    data: np.ndarray
    ppd: int
    west_lon: float           # westernmost longitude (may be -180 or 0)
    north_lat: float          # topmost latitude (usually +90)
    H: int
    W: int


def _pds_val(text: str, key: str) -> str:
    m = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+)", text, re.MULTILINE)
    if not m:
        raise KeyError(key)
    return m.group(1).strip().strip('"').split()[0].rstrip(",")


def load_lola_img(img_path: Path, lbl_path: Path) -> DEM:
    """Load LOLA GDR with detached PDS3 label.

    LDEM_16.IMG is raw binary (no embedded header).
    HEIGHT (metres above reference sphere) = DN * SCALING_FACTOR.
    OFFSET in the label is the planetary radius reference — do NOT add it.
    WESTERNMOST_LONGITUDE = 0 deg (0–360 convention).
    """
    label_text = lbl_path.read_text("latin-1")

    H = int(_pds_val(label_text, "LINES"))
    W = int(_pds_val(label_text, "LINE_SAMPLES"))
    sample_type = _pds_val(label_text, "SAMPLE_TYPE")

    try:
        scale = float(_pds_val(label_text, "SCALING_FACTOR"))
    except KeyError:
        scale = 1.0
    try:
        west_lon = float(_pds_val(label_text, "WESTERNMOST_LONGITUDE"))
    except KeyError:
        west_lon = 0.0
    try:
        north_lat = float(_pds_val(label_text, "MAXIMUM_LATITUDE"))
    except KeyError:
        north_lat = 90.0

    dtype = np.int16 if "INTEGER" in sample_type.upper() else np.uint16
    raw = img_path.read_bytes()
    arr = np.frombuffer(raw, dtype=dtype)
    arr = arr.reshape(H, W).astype(np.float32)
    arr = arr * scale  # metres above reference sphere (height only, no radius offset)

    return DEM(data=arr, ppd=DEM_PPD, west_lon=west_lon, north_lat=north_lat, H=H, W=W)


def fetch_dem() -> DEM:
    DEM_DIR.mkdir(exist_ok=True)
    img_dest = DEM_DIR / "LDEM_16.IMG"
    lbl_dest = DEM_DIR / "LDEM_16.LBL"
    if not img_dest.exists():
        print("downloading LOLA GDR 16ppd (~33 MB) ...", flush=True)
        tmp = img_dest.with_suffix(".part")
        urllib.request.urlretrieve(DEM_URL, tmp)
        tmp.rename(img_dest)
        print("done.", flush=True)
    if not lbl_dest.exists():
        print("downloading LOLA label file ...", flush=True)
        urllib.request.urlretrieve(DEM_LBL_URL, lbl_dest)
    return load_lola_img(img_dest, lbl_dest)


def dem_elev(dem: DEM, lat: float, lon: float) -> float:
    """Bilinear-interpolated elevation in metres at (lat, lon)."""
    lon_n = ((lon - dem.west_lon) % 360.0) * dem.ppd
    lat_n = (dem.north_lat - lat) * dem.ppd
    r0 = max(0, min(int(lat_n), dem.H - 1))
    c0 = int(lon_n) % dem.W
    r1 = min(r0 + 1, dem.H - 1)
    c1 = (c0 + 1) % dem.W
    fr = lat_n - int(lat_n)
    fc = lon_n - int(lon_n)
    return float(
        dem.data[r0, c0] * (1 - fr) * (1 - fc)
        + dem.data[r0, c1] * (1 - fr) * fc
        + dem.data[r1, c0] * fr * (1 - fc)
        + dem.data[r1, c1] * fr * fc
    )


def dest_latlon(lat0: float, lon0: float, az_rad: float, r_km: float) -> tuple[float, float]:
    """Great-circle destination at bearing az_rad for r_km km."""
    d = r_km / MOON_R_KM
    lat0_r = lat0 * D2R
    lon0_r = lon0 * D2R
    lat1_r = math.asin(
        math.sin(lat0_r) * math.cos(d)
        + math.cos(lat0_r) * math.sin(d) * math.cos(az_rad)
    )
    lon1_r = lon0_r + math.atan2(
        math.sin(az_rad) * math.sin(d) * math.cos(lat0_r),
        math.cos(d) - math.sin(lat0_r) * math.sin(lat1_r),
    )
    return lat1_r / D2R, (lon1_r / D2R + 540) % 360 - 180


def horizon_elevations(dem: DEM, lat: float, lon: float) -> list[float]:
    obs_m = dem_elev(dem, lat, lon) + OBS_HEIGHT_M
    n_steps = int(MAX_RANGE_KM / STEP_KM)
    result = []
    for az_i in range(N_AZ):
        az_rad = az_i * AZ_STEP * D2R
        max_el = -90.0
        for step in range(1, n_steps + 1):
            r_km = step * STEP_KM
            t_lat, t_lon = dest_latlon(lat, lon, az_rad, r_km)
            t_m = dem_elev(dem, t_lat, t_lon)
            dh_m = t_m - obs_m - (r_km ** 2) / (2 * MOON_R_KM) * 1000.0
            el = math.degrees(math.atan2(dh_m, r_km * 1000.0))
            if el > max_el:
                max_el = el
        result.append(round(max_el, 4))
    return result


def main() -> int:
    sites = json.loads(SITES_JSON.read_text())
    dem = fetch_dem()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for site in sites:
        sid = site["id"]
        lat, lon = site["lat"], site["lon"]
        print(f"computing horizon: {sid} ({lat:.3f}, {lon:.3f}) ...", flush=True)
        elevs = horizon_elevations(dem, lat, lon)
        out = {
            "id": sid,
            "lat": lat,
            "lon": lon,
            "azimuth_step_deg": AZ_STEP,
            "n_azimuths": N_AZ,
            "elevations_deg": elevs,
            "source": "LOLA GDR 16ppd LDEM_16.IMG",
            "url": DEM_URL,
        }
        (OUT_DIR / f"{sid}.json").write_text(json.dumps(out, indent=2) + "\n")
        print(f"  wrote {OUT_DIR}/{sid}.json", flush=True)

    print("all horizons done.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
