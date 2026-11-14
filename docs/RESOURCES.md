# Resources, data and open-source used

Complete list of everything this project uses: NASA data and resources, space-agency partner data, reference
sources for each landing site, and every open-source software dependency with its licence. This is the
"Space Agency Partner Data & Other References" and "NASA Data" material for the submission.

Short data list is also in `pipeline/README.md`; this file is the full consolidated reference.

## NASA data and resources

To be eligible for a Global Award the project must use at least one NASA data set or resource. This project
uses several.

| Resource | What it is | How we use it | URL |
|---|---|---|---|
| NAIF SPICE generic kernels — LSK `naif0012.tls` | Leap-seconds kernel | Time conversion in `build_ephem.py` | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls |
| NAIF SPICE — PCK `pck00011.tpc` | Planetary constants | Body orientation | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc |
| NAIF SPICE — Moon PA `moon_pa_de440_200625.bpc` | Lunar orientation (DE440) | MOON_ME body-fixed frame | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc |
| NAIF SPICE — Moon FK `moon_de440_250416.tf` | Lunar frame kernel (DE440) | Frame definitions | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf |
| JPL DE440s SPK `de440s.bsp` | Planetary/lunar ephemeris | Sun and Earth positions 2024-2040 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp |
| JPL Horizons API | On-line ephemeris service | Validation fixtures (`horizons.json`) | https://ssd.jpl.nasa.gov/api/horizons.api |
| LOLA GDR polar 80 m/px `LDEM_80S_80M` | LRO laser altimeter DEM | Terrain skylines south of 80S | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG |
| LOLA GDR polar 240 m/px `LDEM_75S_240M` | LRO laser altimeter DEM | Terrain skylines 75-80S | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG |
| LOLA GDR global 16 px/deg `LDEM_16` | LRO laser altimeter DEM | Terrain skylines elsewhere | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_16.IMG |
| NASA SVS CGI Moon Kit | Moon colour + displacement textures | 3D Moon globe | https://svs.gsfc.nasa.gov/4720 |
| NSSDC Lunar Landing Site coordinates | Apollo landing coordinates | Apollo 11-17 site coordinates | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| LROC Quickmap | LRO map/coordinate tool | Coordinate and elevation checks | https://quickmap.lroc.im-ldi.com/ |
| NASA Moon Trek | 3D Moon reference | Visual site checks | https://trek.nasa.gov/moon/ |

NASA data is generally free to use. Credit: NASA/JPL-Caltech; LOLA data from the Lunar Reconnaissance Orbiter
(NASA GSFC); SVS CGI Moon Kit by NASA's Scientific Visualization Studio.

## Space-agency partner data and references

| Agency | Mission / data | Used for | URL |
|---|---|---|---|
| JAXA (Japan) | SLIM landing-site press material | SLIM target coordinates | https://global.jaxa.jp/press/2024/01/file/jaxa_doc01_20240125_e.pdf |
| ISRO (India) | Chandrayaan-3 / Statio Shiv Shakti | Landing coordinates | https://en.wikipedia.org/wiki/Statio_Shiv_Shakti |
| CNSA (China) | Chang'e 3/4/5/6/7 | Landing/planned coordinates | https://en.wikipedia.org/wiki/Chang%27e_4 |
| CSA (Canada) | Moon Exploration background | Narrative/context | https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ |

## Landing-site reference sources

Each row in `web/public/data/sites.json` carries its own `source_url`. Full per-site verification log is in
`docs/QA.md`. Primary sources: NSSDC (Apollo), JAXA (SLIM), Wikipedia mission/feature pages (Chang'e,
Chandrayaan-3, IM-1/IM-2, Blue Ghost, crater features), LROC illumination studies (Shackleton ridge).

NASA CLPS landing-sites page: https://www.nasa.gov/commercial-lunar-payload-services/clps-landing-sites/

## Open-source software

### Web app (`web/package.json`)

| Package | Version | Licence |
|---|---|---|
| react | ^19.3.1 | MIT |
| react-dom | ^19.3.1 | MIT |
| three | ^0.187.0 | MIT |
| @react-three/fiber | ^9.8.2 | MIT |
| @react-three/drei | ^10.7.9 | MIT |
| vite | ^8.3.6 | MIT |
| @vitejs/plugin-react | ^6.1.2 | MIT |
| vitest | ^5.1.0 | MIT |
| typescript | ~7.0.2 | Apache-2.0 |
| tailwindcss | ^4.3.5 | MIT |
| @tailwindcss/vite | ^4.3.5 | MIT |
| oxlint | ^1.90.0 | MIT |
| @types/node, @types/react, @types/react-dom, @types/three | — | MIT (DefinitelyTyped) |

### Data pipeline (`pipeline/`, Python 3.12 via uv)

| Tool | Licence | Use |
|---|---|---|
| Python 3.12 | PSF | Runtime |
| uv | MIT / Apache-2.0 | Environment + runner |
| numpy | BSD-3-Clause | Vector math, reading LOLA IMG arrays |
| spiceypy | MIT | Python wrapper around NASA SPICE Toolkit |
| NASA SPICE Toolkit (CSPICE, via spiceypy) | Free (NAIF/Caltech licence) | Ephemeris + frames |

Standard-library modules used: `json`, `re`, `sys`, `time`, `urllib`, `datetime`, `dataclasses`, `pathlib`.

## Citations

- Smith, D.E., et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance
  Orbiter Mission. *Space Sci. Rev.*, 150, 209-241. https://doi.org/10.1007/s11214-009-9512-y
- Acton, C.H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility.
  *Planet. Space Sci.*, 44(1), 65-70. https://doi.org/10.1016/0032-0633(95)00107-7
- Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography.
  *Icarus*, 211(2), 1066-1081. https://doi.org/10.1016/j.icarus.2010.10.030

## Use of AI assistants

AI coding assistants (Claude, ChatGPT, Google Antigravity) were used to plan and write code, as permitted by
the Space Apps rules. See the Super Intelligence (SI) disclosure in `docs/SUBMISSION.md`. All numerical output
is checked against JPL Horizons by an automated test, not accepted on the AI's word. No AI-generated imagery of
people is used.
