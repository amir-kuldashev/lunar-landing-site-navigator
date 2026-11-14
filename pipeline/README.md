# pipeline

Python scripts that generate the data files in `web/public/data/`. Owner: Person B (see `docs/PLAN.md`).

## Scripts

| Script | Output | Status |
|--------|--------|--------|
| `fetch_horizons_fixtures.py` | `web/src/core/fixtures/horizons.json` | done |
| `build_ephem.py` | `web/public/data/ephem.bin` + `ephem.json` | done |
| `build_horizons.py` | `web/public/data/horizons/{id}.json` | done |

Run each with `uv run pipeline/<script>.py` (Python 3.12 auto-provisioned by uv).

Downloaded artefacts are git-ignored:
- SPICE kernels → `pipeline/kernels/`
- LOLA DEM tile → `pipeline/dem/`

## Datasets used

| Dataset | URL | Used by |
|---------|-----|---------|
| NAIF LSK naif0012.tls | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls | build_ephem.py |
| NAIF PCK pck00011.tpc | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc | build_ephem.py |
| LOLA/Moon PA DE440 BPC | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc | build_ephem.py |
| Moon FK DE440 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf | build_ephem.py |
| JPL DE440s SPK | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp | build_ephem.py |
| JPL Horizons API | https://ssd.jpl.nasa.gov/api/horizons.api | fetch_horizons_fixtures.py |
| LOLA GDR 16ppd cylindrical IMG | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_16.IMG | build_horizons.py |

**LOLA GDR citation:**
Smith, D.E., et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission. *Space Sci Rev*, 150, 209-241. https://doi.org/10.1007/s11214-009-9512-y

**SPICE / JPL Horizons citation:**
Acton, C.H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planet. Space Sci.*, 44(1), 65-70. https://doi.org/10.1016/0032-0633(95)00107-7

## Output formats

### `web/public/data/ephem.bin`
Binary array, `n x 6` little-endian `float32`:
`[sunX, sunY, sunZ, earthX, earthY, earthZ]` in km, MOON_ME body-fixed frame, apparent (LT+S corrected).
Companion `ephem.json` has `{t0_utc, step_s, n, frame, source}`.
Coverage: 2024-01-01 to 2040-01-01, 1-hour steps, 140 257 records.

### `web/public/data/horizons/{id}.json`
Per-site terrain horizon profile:
```json
{
  "id": "apollo-11",
  "lat": 0.674, "lon": 23.473,
  "az_step_deg": 0.5,
  "mast_m": 2.0,
  "elev_deg": [ "...720 floats, north first, clockwise..." ],
  "source": "LOLA GDR 16ppd LDEM_16.IMG"
}
```
Ray-march parameters: 2 km step, 200 km max range, 2 m observer height, lunar curvature correction applied.

Limits: the DEM is about 1.9 km per pixel and the march starts 2 km out, so terrain closer than 2 km and
features smaller than a few km (crater rims, local ridges) are not resolved. At the south pole these matter;
treat polar skylines as a coarse first pass. A higher-resolution polar DEM is the next upgrade.

### `web/src/core/fixtures/horizons.json`
JPL Horizons API test fixtures: Sun and Earth az/el at 10 geometry test points, 53 times each over a year,
sampled off the hour so interpolation is tested too (1060 rows). `npm test` in `web/` checks the core math
against them (tolerance 0.05 deg; current worst error 0.0001 deg).
