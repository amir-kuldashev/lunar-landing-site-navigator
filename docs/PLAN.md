# Lunar Landing Site Navigator — 48-hour development plan

## Context

NASA Space Apps 2026 (Nov 14–15), challenge "Lunar Landing Site Navigator". Team of 5: the user (Claude Code), three teammates with GPT Pro / Antigravity Pro / Claude Max, one without a subscription. The project folder is empty, so this is a greenfield build.

The challenge asks for one thing above all: **fast, intuitive comparison of site + date scenarios**, showing where the Sun and Earth sit relative to the horizon, and what that means for power and direct-to-Earth (DTE) comms. Existing tools (Quickmap, Moon Trek, Horizons) are accurate but slow to use. So our edge is not new science; it is correct numbers behind a UI that answers "what happens if we slip 3 weeks or move 5 km?" in seconds.

Judging criteria (from the 2025 guide; 2026 guide could not be fetched, see Open items): Impact, Creativity, Validity, Relevance, Presentation. The plan is weighted toward Validity (numbers checked against Horizons) and Presentation (a working public demo).

## Product in one paragraph

A static web app. Pick a site (curated list or custom lat/lon) and a date. See a **horizon panorama** (terrain silhouette with Sun and Earth disks and their tracks), **countdown metrics** (time to sunset, time to Earthset, Sun elevation, lit fraction of the solar disk, DTE window length), a **30-day timeline ribbon** of sunlight and comms, and a **3D Moon globe** with terminator and sub-Earth point. Pin up to 4 scenarios side by side. A "schedule slip" slider shifts the date and shows what changed.

## Architecture

Everything heavy is precomputed; the browser only interpolates and rotates vectors. No backend is required for the demo to work.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript, Tailwind | Fast to scaffold, all the AI tools know it well |
| 3D | three.js via react-three-fiber | Globe, terminator, site markers |
| Charts | Hand-drawn Canvas/SVG | Panorama and ribbons are custom shapes; a chart library would fight us |
| Ephemeris | Python + `spiceypy` precompute → `ephem.bin` | Matches Horizons exactly; table is tiny |
| Terrain horizon | Python precompute from LOLA DEM → one JSON per site | Terrain decides everything at the south pole |
| Custom-site horizon | Optional FastAPI endpoint; fallback is smooth-sphere horizon | Stretch; app must work without it |
| Hosting | Vercel or GitHub Pages (static) | Public demo link is a submission requirement |

### Ephemeris (the core calculation)

- Precompute Sun and Earth position vectors **in the Moon's Mean-Earth body-fixed frame** (`MOON_ME`), hourly, 2024–2040. That is about 140k samples × 6 float32 ≈ 3.4 MB (store as Float32Array; halve it with 2 h steps if needed).
- Kernels: `de440s.bsp`, `moon_pa_de440_200625.bpc`, the matching `moon_de440_*.tf` frame kernel, `pck00011.tpc`, `naif0012.tls` (all from naif.jpl.nasa.gov/pub/naif/generic_kernels; confirm exact filenames when downloading).
- In the browser: interpolate the vectors at time *t*, subtract the site's position vector (this matters for Earth: about 0.26° of parallax), rotate into the local East-North-Up frame, read off azimuth and elevation.
- Sun is a 0.27° radius disk and Earth about 0.95°. At the pole the Sun skims the horizon for days, so compute the **visible fraction of the solar disk** above the terrain, not a binary lit/dark.
- No atmosphere, so no refraction correction.
- Pin Python to 3.12 with `uv` (system Python is 3.14; `spiceypy` wheels may not exist for it yet).

### Terrain horizon

- For each curated site, ray-march 720 azimuths (0.5° step) out to 200 km over the LOLA DEM, including lunar curvature, and store the maximum elevation angle per azimuth. Observer height is a parameter (default 2 m mast).
- Elevation angle of a terrain point at ground distance *d* with height *h_p*, from observer at *h_0*: `atan2((R+h_p)·cos(d/R) − (R+h_0), (R+h_p)·sin(d/R))`, R = 1737.4 km.
- DEM sources: polar LOLA gridded DEMs in polar stereographic (PDS `LDEM_80S_80M` class products, or PGDA product 81 "South Pole LOLA DEM Mosaic"). Avoid the 3.3 GB 5 m/px 87°S mosaic; if time allows, use the individual 20×20 km 5 m site tiles from pgda.gsfc.nasa.gov/data/LOLA_5mpp/ for the near field only.
- Non-polar sites (Apollo etc.): smooth-sphere horizon is fine; terrain barely matters there. Say so in the UI.

### Data contracts (agree in hour 1, then people work in parallel)

```
public/data/sites.json            [{id, name, lat, lon, alt_m, category, mission, source_url}]
public/data/ephem.bin + .json     header {t0_utc, step_s, n}; Float32 [sunXYZ, earthXYZ] km, MOON_ME
public/data/horizons/{id}.json    {az_step_deg: 0.5, mast_m: 2, elev_deg: [720 values]}
```

```ts
// src/core/  (pure functions, no React, unit tested)
topo(site, t)            -> { sun: {az, el, visibleFraction}, earth: {az, el, visible} }
events(site, t0, t1)     -> { sunlight: Interval[], dte: Interval[], nextSunset, nextEarthset }
summary(site, t0, days)  -> { litPct, dtePct, longestNight_h, maxSunEl }
```

### Repo layout

```
web/            Vite app
  src/core/     ephemeris.ts, frames.ts, horizon.ts, events.ts  (+ *.test.ts)
  src/views/    Panorama, Timeline, Globe, CompareBoard, SitePicker, Metrics
  public/data/  generated files (committed)
pipeline/       build_ephem.py, build_horizons.py, fetch_horizons_fixtures.py
docs/           README assets, slides, demo script
```

## Team briefs (send one card to each person)

Shared rules: one `main` branch, short-lived feature branches, deploy on every merge. Nobody changes a data contract (see "Data contracts" above) without telling the channel. Views only call the three `core` functions; they never do their own astronomy.

How the four official resources are used:

| Resource | Role in our project | Who uses it |
|---|---|---|
| JPL Horizons — https://ssd.jpl.nasa.gov/horizons/ | Ground truth for Sun/Earth azimuth and elevation. We test against it; we do not call it live from the app. | A, B, E |
| LROC Quickmap — https://quickmap.lroc.im-ldi.com/ | Read site coordinates and elevations, look at terrain, sanity-check our horizons and lighting | B, E |
| Moon Trek — https://trek.nasa.gov/moon/ | 3D look at a site to check the terrain silhouette; source of screenshots for slides | D, E |
| CSA Moon Exploration — https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ | Background for the story and explain-mode text; Canadian missions for the site list | E |

---

### Person A — Tech lead and core math (you, Claude Code)

**Owns:** the repo, `web/src/core/`, integration, deployment.

**Tasks**
1. Hour 0–2: `git init`, scaffold `web/` (Vite + React + TS + Tailwind + vitest), deploy a hello page, publish the data contracts.
2. Write `core/frames.ts` (lat/lon to site vector, East-North-Up rotation), `core/ephemeris.ts` (load and interpolate `ephem.bin`), `core/horizon.ts` (terrain lookup, visible fraction of the Sun's disk), `core/events.ts` (rise/set times, intervals, summaries).
3. Make the Horizons fixture test pass within 0.05°.
4. Ship mock data on day one so C and D are not blocked.
5. Review and merge everyone's branches; own the freeze at hours 24 and 40.

**Delivers:** `topo()`, `events()`, `summary()` with tests; live URL.

**Sources**
- Horizons API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Horizons manual (azimuth convention, quantity codes): https://ssd.jpl.nasa.gov/horizons/manual.html
- Fixture values already in the Verification section below.

---

### Person B — Data pipeline (Claude Max)

**Owns:** `pipeline/` and everything in `web/public/data/` except `sites.json`.

**Tasks**
1. Hour 0–2: set up Python 3.12 with `uv`, install `spiceypy`, `numpy`, `rasterio`. Start kernel and DEM downloads immediately; they are the slow part.
2. `fetch_horizons_fixtures.py`: pull Sun (`COMMAND='10'`) and Earth (`COMMAND='399'`) azimuth/elevation for about 10 sites × 20 times into `fixtures.json`. Hand to A by hour 4.
3. `build_ephem.py`: hourly Sun and Earth vectors in the `MOON_ME` frame, 2024–2040, into `ephem.bin` + header JSON. Hand to A by hour 8.
4. `build_horizons.py`: for each site in `sites.json`, ray-march 720 azimuths to 200 km over the LOLA DEM and write `horizons/{id}.json`. First 5 south-pole sites by hour 20, the rest by hour 30.
5. Stretch: wrap `build_horizons.py` in a FastAPI endpoint for custom coordinates.

**Delivers:** `fixtures.json`, `ephem.bin`, `horizons/*.json`, a short `pipeline/README.md` naming every dataset used (needed for the submission).

**Sources**
- Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- SPICE kernels: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ (`spk/planets/de440s.bsp`, `pck/moon_pa_de440_200625.bpc`, `fk/satellites/moon_de440_*.tf`, `pck/pck00011.tpc`, `lsk/naif0012.tls`; confirm names in the directory listing)
- South pole LOLA DEM mosaic: https://pgda.gsfc.nasa.gov/products/81
- High-resolution 5 m site DEMs (near field only, optional): https://pgda.gsfc.nasa.gov/products/78 and https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
- LOLA polar illumination maps, to check our lit %: https://pgda.gsfc.nasa.gov/products/69
- Quickmap, to spot-check a horizon by eye: https://quickmap.lroc.im-ldi.com/

---

### Person C — Main views (Antigravity Pro)

**Owns:** `web/src/views/Panorama`, `Timeline`, `Metrics`.

**Tasks**
1. Hour 2–10, against A's mock data: **horizon panorama**, a 360° strip with azimuth on x and elevation on y, terrain silhouette filled in, Sun and Earth drawn as disks at true angular size, and their tracks for the next lunar day. The elevation axis needs a zoom, because at the pole everything happens between −2° and +5°.
2. **Metrics cards:** Sun elevation, lit fraction, countdown to sunset/sunrise, Earth elevation, countdown to Earthset/Earthrise, 30-day lit % and DTE %. Colour states for good / marginal / bad.
3. **Timeline ribbon:** 30 days, three rows (sunlight, DTE comms, both), with a draggable time cursor that drives the whole app.
4. Hour 24+: date/time picker with play and scrub; schedule-slip slider and "what changed" card.

**Delivers:** the three views wired to real `core` functions by hour 20.

**Sources**
- A's data contracts and mock data in the repo.
- Quickmap and Moon Trek only as visual reference for what a polar horizon looks like.

---

### Person D — 3D globe, compare board, site catalog research (GPT Pro)

**Owns:** `web/src/views/Globe`, `CompareBoard`, `SitePicker`, URL state.

**Tasks**
1. Hour 0–4: run deep research to draft the site catalog (name, lat, lon, elevation, mission, date, source URL per row). Hand the draft to E for verification. Do not commit unverified coordinates.
2. Hour 2–12: **3D Moon globe** (react-three-fiber): textured sphere, site markers, day/night terminator, sub-solar and sub-Earth points, click a marker to select the site, south-pole camera preset.
3. **Site picker:** searchable list grouped by category, plus custom lat/lon entry with validation.
4. Hour 24–34: **compare board:** pin 2–4 scenarios (site + date), each showing a mini panorama and the key metrics in aligned columns so differences are obvious.
5. Encode the full state in the URL so a comparison can be shared as a link.

**Delivers:** globe, picker, compare board, shareable links.

**Sources**
- Moon colour and elevation textures: NASA SVS CGI Moon Kit, https://svs.gsfc.nasa.gov/4720
- CLPS landing sites: https://www.nasa.gov/commercial-lunar-payload-services/clps-landing-sites/
- Moon Trek for a 3D reference of each site: https://trek.nasa.gov/moon/
- Catalog research: NASA mission pages, NSSDC, CSA Moon Exploration, ISRO/CNSA/JAXA mission pages. Every row needs a URL.

---

### Person E — Product owner, validation, presentation (no subscription needed)

**Owns:** `web/public/data/sites.json`, QA, `docs/`, the submission.

**Tasks**
1. **Hour 0–1, most urgent:** read the 2026 Project Submission Guide and Judging & Awards Guide on spaceappschallenge.org. Post in the channel: demo format and length, required links, the AI-use disclosure rule, and the exact local deadline.
2. Hour 1–8: verify D's site catalog row by row. Look each site up in Quickmap, confirm lat/lon and read the elevation, keep the source URL. Target about 20 sites: Apollo 11–17, Chang'e 3/4/5/6, Chandrayaan-3, SLIM, IM-1, IM-2, Blue Ghost M1, Griffin target at Mons Mouton, Shackleton rim, Malapert massif, Nobile rim, de Gerlache rim, Artemis III candidate regions.
3. Hour 10 onward, continuous QA: pick a site and time, run it in the Horizons web app, compare with what our app shows, log mismatches for A. Check two or three terrain horizons against Moon Trek.
4. Write the plain-language text: explain-mode captions, tooltips, the "why the south pole is hard" intro.
5. Hour 20–24: draft the demo script (90 seconds: a mission slips three weeks, show how the answer changes, pick an alternative site). Record a backup screen capture at hour 24 and again at hour 40.
6. Hour 36–46: slides or video, README, list of data and tools used (get it from B), AI-use statement, fill and submit the form by hour 46.

**Delivers:** verified `sites.json`, QA log, demo, submission.

**Sources**
- Space Apps guides: https://www.spaceappschallenge.org/resources/project-submission-guide/ and https://www.spaceappschallenge.org/resources/judging-awards-guide
- Quickmap for coordinates and elevation: https://quickmap.lroc.im-ldi.com/
- Horizons web app for spot checks: https://ssd.jpl.nasa.gov/horizons/ (observer location `coord@301`, geodetic, east longitude, latitude, altitude in km; target Sun or Earth; quantity 4 = azimuth and elevation)
- Moon Trek for terrain views and slide imagery: https://trek.nasa.gov/moon/
- CSA Moon Exploration for background and narrative: https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/
- CLPS landing sites: https://www.nasa.gov/commercial-lunar-payload-services/clps-landing-sites/

---

### Hand-offs (who is waiting on whom)

| By hour | From → To | What |
|---|---|---|
| 1 | E → all | Submission rules and deadline |
| 2 | A → all | Repo, contracts, mock data |
| 4 | B → A | Horizons fixtures |
| 4 | D → E | Draft site catalog |
| 8 | B → A | `ephem.bin` |
| 8 | E → B, D | Verified `sites.json` |
| 20 | B → A | First 5 terrain horizons |
| 20 | C, D → A | Views on real data |
| 24 | E | Backup demo recording of the MVP |
| 44 | B → E | Dataset and tool list for the submission |

## Timeline

| Hours | Goal | Exit check |
|---|---|---|
| 0–2 | Repo, scaffold, deploy "hello", agree contracts. E reads the 2026 submission and judging guides. | Public URL live |
| 2–10 | **Vertical slice**: one site, one date, Sun/Earth az/el on screen from `ephem.bin`. B ships ephem table + 10 Horizons fixtures. C and D build against mock data. | Core test passes against Horizons within 0.05° |
| 10–20 | Panorama with smooth-sphere horizon, metrics + countdowns, site picker, date picker, globe. First terrain horizons for 5 south-pole sites. | A stranger can pick a site and date and read the answer |
| 20–24 | Integrate terrain horizons, timeline ribbon. **MVP freeze at hour 24.** | Deployed MVP; record a backup screen capture |
| 24–34 | Compare board (2–4 scenarios), schedule-slip slider, all curated sites, time animation | Demo script runs end to end |
| 34–40 | Stretch items in priority order, then polish, empty/error states, mobile sanity | **Hard feature freeze at hour 40** |
| 40–46 | Bug fixes only. README, slides, demo video, submission form | Everything uploaded |
| 46–48 | Buffer. Submit by hour 46, not 47:59 | Confirmation received |

Sleep: stagger so two people are always awake; everyone gets at least 5 hours before hour 36.

## Scope

**MVP (must ship)**
1. Curated sites (about 20: Apollo 11–17, Chang'e 3/4/5/6, Chandrayaan-3, SLIM, IM-1, IM-2, Blue Ghost M1, Griffin/Mons Mouton target, Shackleton rim, Malapert, Nobile rim, de Gerlache rim, Artemis III candidate regions) plus custom lat/lon. E must cite a source per coordinate; do not ship coordinates from an AI tool unverified.
2. Date/time picker with play/scrub.
3. Horizon panorama with terrain silhouette, Sun and Earth disks, tracks for the next lunar day.
4. Metrics: Sun elevation, lit fraction, time to sunset/sunrise, Earth elevation, time to Earthset/Earthrise, 30-day lit % and DTE %.
5. 30-day timeline ribbon (sunlight, comms, both).
6. Compare board, 2–4 scenarios.
7. 3D globe with terminator and sub-Earth point.

**Stretch, in order**
1. Schedule-slip slider with a "what changed" delta card.
2. Year heatmap: site × date coloured by lit % (shows the seasonal effect at a glance).
3. "Best window" finder: longest stretch with both sunlight and DTE in a date range.
4. Explain mode for the public: plain-language captions ("why does the Sun never get above 2° here?").
5. Custom-site terrain horizon via the FastAPI endpoint.
6. CSV/PNG export of a comparison.

**Cut without regret**: first-person 3D terrain flyover, accounts, LLM chat, thermal modelling.

## Risks

| Risk | Mitigation |
|---|---|
| Frame or sign mistake in the math (east vs west longitude, azimuth convention) | Horizons fixtures from hour 2; nothing ships until they pass |
| DEM download or processing eats the night | Smooth-sphere horizon is the default path; terrain is an upgrade per site |
| Integration crunch at the end | Vertical slice by hour 10, deploy on every merge, freeze at 40 |
| Five AI tools produce five code styles | A owns `core/` and reviews merges; views only call the three core functions |
| Demo breaks live | Backup video recorded at hour 24 and again at hour 40 |

## Verification

- **Unit tests** (`vitest`, `web/src/core/*.test.ts`): compare `topo()` against Horizons fixtures. Known-good reference already obtained from the live API (Sun from lon 225°E, lat −89.5°, alt 0, airless):
  - 2027-01-01 00:00 UT → az 38.1222°, el 1.4073°
  - 2027-01-02 00:00 UT → az 25.9535°, el 1.4476°
  - 2027-01-03 00:00 UT → az 13.7787°, el 1.4685°
  - Query form: `horizons.api?COMMAND='10'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='lon,lat,alt_km'&QUANTITIES='4'`; use `COMMAND='399'` for Earth. `pipeline/fetch_horizons_fixtures.py` pulls about 10 sites × 20 times for both bodies.
  - Tolerance: 0.05° in both azimuth and elevation.
- **Sanity checks**: Earth stays within a few degrees of a fixed sky position at every site (libration only); Apollo 11 landing time shows a low morning Sun (about 10°); a Shackleton-rim site shows far higher yearly lit % than a crater-floor point.
- **Terrain check**: overlay one computed horizon on a Quickmap or Moon Trek view of the same site; compare lit % against published LOLA illumination maps (PGDA product 69).
- **End to end**: run the 90-second demo script on the deployed URL in a fresh browser, on a laptop and a phone.

## Open items (first hour)

- E: read the 2026 Project Submission Guide and Judging & Awards Guide on spaceappschallenge.org (automated fetch failed with a certificate error). Confirm demo format and length, required links, AI-use disclosure rules, and the local deadline. Every teammate is using AI tools, so the disclosure rule matters.
- B: confirm exact kernel and DEM filenames and sizes before the long downloads start.
- All: agree the app name.

## First build steps after approval

0. **Create the GitHub repo first** so all five can work at once:
   - `git init -b main` in the project folder; add `README.md` (project summary + the team briefs from this plan as `docs/TEAM_BRIEFS.md`), `.gitignore` (node, python, large DEM/kernel files), and the empty `web/`, `pipeline/`, `docs/` folders.
   - `gh repo create lunar-landing-site-navigator --private --source . --push` under the logged-in account `amir-kuldashev`. Private for now; switch to public before submission (Space Apps needs a public project link).
   - Invite teammates as collaborators with `gh api repos/amir-kuldashev/lunar-landing-site-navigator/collaborators/<username> -X PUT` once their GitHub usernames are known.
   - Raw DEMs and SPICE kernels stay out of git (too large); only the generated files in `web/public/data/` are committed.
1. Scaffold `web/` (Vite React TS), add `vitest`, push, connect to Vercel.
2. Write `src/core/` with the three functions against a mocked ephemeris, plus the fixture test (failing).
3. Write `pipeline/build_ephem.py` and `fetch_horizons_fixtures.py`; generate `ephem.bin`; make the test pass.
4. Stub the views with mock data so C and D can start immediately.
