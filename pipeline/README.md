# pipeline

Python scripts that generate the data files in `web/public/data/`. Owner: Person B (see `docs/PLAN.md`).

Planned scripts:

- `fetch_horizons_fixtures.py` — pull Sun and Earth azimuth/elevation from JPL Horizons for test fixtures
- `build_ephem.py` — hourly Sun and Earth vectors in the `MOON_ME` frame, 2024–2040 → `ephem.bin`
- `build_horizons.py` — terrain horizon per site from the LOLA DEM → `horizons/{id}.json`

Use Python 3.12 via `uv`. Put downloaded kernels in `pipeline/kernels/` and DEMs in `pipeline/dem/`; both are git-ignored.

List every dataset you use here, with its URL. The submission needs it.
