# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["spiceypy>=6", "numpy"]
# ///
"""Build the Sun/Earth ephemeris table used by the web app.

Output (in web/public/data/):
  ephem.bin   n records of 6 little-endian float32: sunXYZ, earthXYZ in km,
              relative to the Moon's centre, in the MOON_ME (Mean Earth / polar axis)
              body-fixed frame, apparent (light-time and stellar aberration corrected).
  ephem.json  {t0_utc, step_s, n, frame, source}

Run:  uv run pipeline/build_ephem.py
Kernels are downloaded once into pipeline/kernels/ (git-ignored, about 45 MB).
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import spiceypy as sp

HERE = Path(__file__).resolve().parent
KERNEL_DIR = HERE / "kernels"
OUT_DIR = HERE.parent / "web" / "public" / "data"

NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
KERNELS = [
    "lsk/naif0012.tls",
    "pck/pck00011.tpc",
    "pck/moon_pa_de440_200625.bpc",
    "fk/satellites/moon_de440_250416.tf",
    "spk/planets/de440s.bsp",
]

T0_UTC = "2024-01-01T00:00:00Z"
T1_UTC = "2040-01-01T00:00:00Z"
STEP_S = 3600


def fetch_kernels() -> list[Path]:
    KERNEL_DIR.mkdir(exist_ok=True)
    paths = []
    for rel in KERNELS:
        dest = KERNEL_DIR / Path(rel).name
        if not dest.exists():
            print(f"downloading {rel} ...", flush=True)
            tmp = dest.with_suffix(dest.suffix + ".part")
            urllib.request.urlretrieve(f"{NAIF}/{rel}", tmp)
            tmp.rename(dest)
        paths.append(dest)
    return paths


def main() -> None:
    for k in fetch_kernels():
        sp.furnsh(str(k))

    et0 = sp.str2et(T0_UTC.replace("Z", " UTC").replace("T", " "))
    et1 = sp.str2et(T1_UTC.replace("Z", " UTC").replace("T", " "))
    n = int(round((et1 - et0) / STEP_S)) + 1
    out = np.empty((n, 6), dtype="<f4")
    for i in range(n):
        et = et0 + i * STEP_S
        sun, _ = sp.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")
        earth, _ = sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")
        out[i, :3] = sun
        out[i, 3:] = earth
        if i % 20000 == 0:
            print(f"  {i}/{n}", flush=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out.tofile(OUT_DIR / "ephem.bin")
    header = {
        "t0_utc": T0_UTC,
        "step_s": STEP_S,
        "n": n,
        "frame": "MOON_ME",
        "source": "NAIF SPICE: " + ", ".join(Path(k).name for k in KERNELS),
    }
    (OUT_DIR / "ephem.json").write_text(json.dumps(header, indent=2) + "\n")
    print(f"wrote {n} samples, {out.nbytes / 1e6:.1f} MB -> {OUT_DIR}")


if __name__ == "__main__":
    sys.exit(main())
