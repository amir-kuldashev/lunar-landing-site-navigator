# Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 — "Lunar Landing Site Navigator".

A web app for comparing lunar landing sites and dates quickly. Pick a site and a date, and see where the Sun and Earth sit relative to the local horizon, how long until sunset and Earthset, and what that means for solar power and direct-to-Earth communication.

**Live site:** https://amir-kuldashev.github.io/lunar-landing-site-navigator/

## Start here

- **Plan, team briefs, timeline:** [docs/PLAN.md](docs/PLAN.md). Find your card under "Team briefs".
- **Data contracts** (file formats and the three core functions every view calls) are in the same document. Do not change one without telling the team.

## Layout

```
web/        Vite + React + TypeScript app (static site)
  src/core/     astronomy math, pure functions, unit tested
  src/views/    Panorama, Timeline, Metrics, Globe, CompareBoard, SitePicker
  public/data/  generated data files (committed)
pipeline/   Python scripts that generate the data files (SPICE ephemeris, LOLA terrain horizons)
docs/       plan, slides, demo script
```

## Working together

- `main` is always deployable. Work on a short-lived branch (`yourname/what-it-does`), open a pull request, merge quickly.
- Pull before you start, and again before you push.
- Raw DEMs and SPICE kernels are large and stay out of git (see `.gitignore`). Only the generated files in `web/public/data/` are committed.
- Views never do their own astronomy; they call `topo()`, `events()`, and `summary()` from `web/src/core/`.

## Data sources

- [Detailed References & Used Resources List (Person C / Antigravity Pro)](docs/REFERENCES_ANTIGRAVITY_PRO.md)
- JPL Horizons (validation of Sun/Earth positions): https://ssd.jpl.nasa.gov/horizons/
- NAIF SPICE generic kernels (ephemeris): https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- LOLA south pole DEMs, NASA GSFC PGDA (terrain horizons): https://pgda.gsfc.nasa.gov/
- LROC Quickmap (site coordinates, visual checks): https://quickmap.lroc.im-ldi.com/
- NASA Moon Trek (3D terrain reference): https://trek.nasa.gov/moon/
- CSA Moon Exploration (background): https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/
