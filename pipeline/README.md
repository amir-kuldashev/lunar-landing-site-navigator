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
| LOLA GDR south polar, 80 m/pixel (80S to pole) | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG | build_horizons.py |
| LOLA GDR south polar, 240 m/pixel (75S to pole) | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG | build_horizons.py |
| LOLA GDR global, 16 pixels/degree (about 1.9 km) | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_16.IMG | build_horizons.py |
| NASA SVS CGI Moon Kit (colour and elevation textures) | https://svs.gsfc.nasa.gov/4720 | web/public/textures |
| NASA SVS Blue Marble Earth map (visualization 3615) | https://svs.gsfc.nasa.gov/3615 | web/public/textures/earth_color.jpg |

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
Per-site terrain skyline:
```json
{
  "id": "im-2", "lat": -84.7906, "lon": 29.1957,
  "az_step_deg": 0.5, "mast_m": 2.0,
  "elev_deg": [ "...720 floats, north first, clockwise..." ],
  "site_height_m": 5321.1, "resolution_m": 80,
  "source": "LOLA GDR (LDEM_80S_80M, LDEM_75S_240M, LDEM_16); finest model covering each point"
}
```
720 rays out to 250 km, sampled every 40 m near the site and more coarsely far away, seen from 2 m above the
ground. Each sample uses the finest model that covers it. The elevation angle uses exact spherical geometry.

Limits: sites south of 80S use the 80 m polar model. Everywhere else uses the global model at about 1.9 km
per pixel, so crater rims and hills smaller than a few km are not resolved there. Terrain features smaller
than the model's pixel (boulders, small craters) are never resolved. Custom points in the app have no
terrain skyline at all.

### `web/src/core/fixtures/horizons.json`
JPL Horizons API test fixtures: Sun and Earth az/el at 10 geometry test points, 53 times each over a year,
sampled off the hour so interpolation is tested too (1060 rows). `npm test` in `web/` checks the core math
against them (tolerance 0.05 deg; current worst error 0.0001 deg).
