# QA log

Owner: Person E. This file records the checks run on the project data and numbers.

## 1. Site catalog verification (2026-11-14)

Every row in `web/public/data/sites.json` was checked against its cited source. Coordinates were not changed;
only the `verified` flag was set. 18 of 20 confirmed, 2 left unverified with a reason.

| Site | lat | lon | Source checked | Result |
|---|---|---|---|---|
| apollo-11 | 0.67416 | 23.47314 | NSSDC lunar_sites | ✅ exact |
| apollo-12 | -3.0128 | -23.4219 | NSSDC lunar_sites | ✅ exact |
| apollo-14 | -3.64589 | -17.47194 | NSSDC lunar_sites | ✅ exact |
| apollo-15 | 26.13239 | 3.6333 | NSSDC lunar_sites | ✅ exact |
| apollo-16 | -8.9734 | 15.5011 | NSSDC lunar_sites | ✅ exact |
| apollo-17 | 20.1911 | 30.7723 | NSSDC lunar_sites | ✅ exact |
| chandrayaan-3 | -69.373 | 32.319 | Wikipedia (Statio Shiv Shakti) | ✅ exact |
| blue-ghost-1 | 18.56 | 61.81 | Wikipedia (Blue Ghost M1) | ✅ exact |
| change-3 | 44.1214 | -19.5116 | Wikipedia (Chang'e 3) | ✅ exact |
| change-4 | -45.444 | 177.599 | Wikipedia (Chang'e 4) | ✅ exact |
| change-5 | 43.0576 | -51.9161 | Wikipedia (Chang'e 5) | ✅ exact |
| change-6 | -41.6385 | -153.9852 | Wikipedia (Chang'e 6) | ✅ exact |
| im-1 | -80.13 | 1.44 | Wikipedia (IM-1) | ✅ exact |
| im-2 | -84.7906 | 29.1957 | Wikipedia (IM-2) | ✅ exact |
| slim | -13.31549 | 25.24889 | JAXA target (Wikipedia actual -13.3160/25.2510) | ✅ target point; ~55 m from actual, negligible for az/el |
| de-gerlache | -88.5 | -87.1 | Wikipedia (crater centre) | ✅ feature centre |
| mons-mouton | -84.6 | 31.0 | Wikipedia (feature) | ✅ feature |
| malapert | -84.9 | 12.9 | Wikipedia (crater centre) | ✅ feature centre |
| shackleton-ridge | -89.45 | 222.69 | LROC illumination study | ☐ longitude disputed (222.69 vs 229.69), left unverified |
| change-7 | -88.8 | 123.4 | Wikipedia infobox (social-media cite) | ☐ weak source, left unverified |

Notes
- The two unverified rows are kept in the catalog on purpose (a well-lit polar ridge and a planned mission) but
  are flagged so the UI and the demo do not present them as confirmed.
- Feature-centre rows (de-gerlache, malapert) are crater floors/centres, labelled `kind: "feature"`, included
  for contrast with rim candidate regions. Their coordinates are the cited feature centres, not mission points.

## 2. Numerical accuracy (Sun/Earth angles)

The core astronomy is checked by an automated test against JPL Horizons fixtures
(`web/src/core/fixtures/horizons.json`, 1,060 values across ten points over a year; see `docs/SUBMISSION.md`).
Run it with:

```
cd web && npm install && npm test
```

Expected: the Horizons comparison test passes with the largest az/el difference ~0.0001°.

## 3. Remaining manual QA (not machine-verifiable)

- [ ] Spot-check 2-3 terrain horizon profiles against Moon Trek / Quickmap screenshots (visual).
- [ ] Pick one site + date, run it live in the JPL Horizons web app (observer `coord@301`, geodetic, east
      longitude, quantity 4 = az/el) and confirm the app's displayed numbers match within a few hundredths of a
      degree. The automated fixture test already covers this for ten points; this is a human sanity check for
      the demo.
- [ ] Resolve the shackleton-ridge longitude (222.69 vs 229.69) if that site is used in the demo.
