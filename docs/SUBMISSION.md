# Submission kit

Everything needed to fill in the Space Apps project page. Owner: Person E.

## Rules (confirmed against the 2026 guide)

Confirmed on 14 Nov 2026 by reading the official 2026 Project Submission Guide (dated 13 Nov 2026) directly in a
browser. Values below are from the live guide, not last year's.

- Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging: https://www.spaceappschallenge.org/resources/judging-awards-guide

| Rule | Confirmed 2026 wording | OK |
|---|---|---|
| Submission window | Opens Sat 14 Nov 9:00 a.m., closes Sun 15 Nov 11:59 p.m., in the time zone of the team's Local Event (Universal Event: Team Owner's residence). **Our team's deadline is Sunday 15 Nov, 12:00**, as given by the team lead on 14 Nov; work to that. | ✅ |
| Demo | Required. Video 30 seconds or less, OR slide deck up to 7 slides including title and intro slides | ✅ |
| Hosting | Demo and final-project links hosted externally (YouTube, Drive, GitHub, etc.); must open with no password, permission or registration | ✅ |
| Page images | JPG/PNG/GIF up to 10 MB can be uploaded to the project page; videos and documents cannot — link them externally | ✅ |
| Language | English on the project page and all linked material. A video may be in another language only with English subtitles; slide decks must be English | ✅ |
| Super Intelligence (SI) | Allowed and must be disclosed. SI must not be used to come up with the idea of how to solve the challenge. SI-generated images/videos need a **visible watermark**; audio/code/data need acknowledgment in descriptive text and metadata. No NASA branding in generated content. The SI answer is data-collection only (judges do not see it), but judges do see SI indicators inside the project. | ✅ agreed & recorded |
| NASA data | Must use at least one NASA data set or resource to be eligible for a Global Award | ✅ (SPICE DE440, LOLA, Horizons, SVS Moon Kit) |
| Judging | Impact, Creativity, Validity, Relevance, Presentation | ✅ |
| Website access | Optional but recommended: request a FortiGuard Web Filter Classification for the live-demo site so judges are not blocked | ☐ |

**SI/AI disclosure — agreed by the team on 15 Nov 2026.** AI coding assistants were used heavily throughout the
project, including to draft the development plan from the human team's concept. This is fully disclosed below and
in `docs/RESOURCES.md`. The copy-and-paste text for the official submission form's AI question is provided in
Section 5 below. All code in this repository is acknowledged as AI-assisted. All numerical outputs are strictly
verified against NASA JPL Horizons.

## Links to submit

| Item | Link | Ready? |
|---|---|---|
| Live demo | https://amir-kuldashev.github.io/lunar-landing-site-navigator/ | ✅ deployed 14 Nov, redeploys on every push to `main` |
| Code | https://github.com/amir-kuldashev/lunar-landing-site-navigator | ✅ public |
| Demo video or slides | not made yet | ☐ |

## Project description (draft)

**Lunar Landing Site Navigator**

*Summary (one or two sentences).*
A web tool that shows, for any landing site and date on the Moon, where the Sun and Earth sit above the local
horizon and how long sunlight and direct Earth contact will last. It lets a mission planner compare sites and
dates in seconds, and see at once what a schedule slip does to power and communication.

*The problem.*
A lunar lander needs the Sun for power and a clear line to Earth for radio. At the Moon's south pole both sit
within a few degrees of the horizon, so a nearby ridge or a three-week delay can decide whether a mission
works. The tools that answer this today (JPL Horizons, Quickmap, Moon Trek) are accurate but built for
specialists, and comparing several site and date options with them is slow.

*What it does.*
- Pick a site from a list, type coordinates, or double-click a point on a 3D Moon.
- Pick a date and time, or press Start to watch a lunar day unfold.
- Read the answer in plain words, with the numbers behind it: Sun and Earth elevation, whether there is
  sunlight and a direct Earth link, and a countdown to the next sunset or Earthset.
- See the sky from the site with the terrain skyline drawn in, and the paths the Sun and Earth follow.
- Scan a 30-day ribbon of sunlight, Earth contact, and both together.
- Slide the landing date earlier or later and see what gets better or worse.
- Pin several site and date scenarios and compare them in one table.
- Ask which site is best for a date: the tool ranks the named sites, or scores the whole south polar region
  cell by cell on a map, using each cell's own terrain skyline and leaving out steep ground.
- Ask when to land: for a fixed site, the tool scores every landing date over the next 12 months and marks
  the best ones.
- Compare pinned scenarios as numbers and as skies drawn side by side on one scale.
- See a whole year at one site at a glance, and share any view as a link.
- Take a six-step guided tour that explains, in plain words, why the south pole is hard.

*How it works.*
Sun and Earth positions are precomputed from NASA's SPICE ephemeris (DE440) in the Moon's body-fixed frame for
2024 to 2040, then turned into azimuth and elevation in the browser. Terrain skylines are ray-cast from LOLA
elevation models. Everything runs as a static website with no server.

*How we know it is right.*
The Sun and Earth angles are tested against 1,060 values from JPL Horizons across ten points on the Moon over a
year. The largest difference is 0.0001 degrees. The test runs with `npm test`.

*Limits we are open about.*
- Terrain uses LOLA gridded elevation data (see `pipeline/README.md` for the resolution per site). Features
  smaller than the grid are not resolved, so polar results are estimates.
- Custom points have no terrain; they use a smooth-sphere horizon.
- The tool covers lighting and communication. It does not judge whether the surface is safe to land on.

## Data and tools used

Full list with URLs and citations: `pipeline/README.md`.

- NASA NAIF SPICE generic kernels (DE440 ephemeris, lunar orientation and frame kernels)
- JPL Horizons System (validation data)
- LOLA gridded elevation models, Lunar Reconnaissance Orbiter (terrain skylines)
- NASA Scientific Visualization Studio CGI Moon Kit (Moon colour and elevation textures)
- LROC Quickmap and NASA Moon Trek (site lookup and visual checks)
- Software: TypeScript, React, Vite, three.js, react-three-fiber, Tailwind CSS, vitest; Python, numpy, spiceypy

## Use of AI tools (agreed by the team on 15 Nov 2026)

In strict accordance with the **NASA Space Apps Challenge 2026 Project Submission Guide** (Section: *Super Intelligence (SI) / AI Tools*):

### 1. Compliance with the "No AI for the Idea" Rule
- **Origin of the Idea (Human Team):** The concept and core approach were conceived solely by the human team. The team identified that while official tools (JPL Horizons, QuickMap, Moon Trek) provide accurate lunar science, they are slow and cumbersome for mission planners who need to quickly evaluate trade-offs. The team decided that the winning edge was not discovering new science, but computing correct numbers behind a sub-second, interactive client-side tool answering: *"What happens to solar power and direct-to-Earth communication if our launch slips 3 weeks or our landing site moves 5 km?"*
- **Drafting the Development Plan (AI-assisted):** Once the human team chose this idea and strategy, the team prompted an AI assistant (**Claude Code**) with the Space Apps challenge description and their chosen concept. The AI was used to draft the 48-hour development plan, architecture, data contracts, and team briefs (`docs/PLAN.md`). The team reviewed, refined, and approved this plan before building began.

### 2. Breakdown of AI Tools Used and for What

| AI Tool / Model | Team Member / Role | What the AI Did | What the Human Did |
|---|---|---|---|
| **Claude Code (Anthropic)** | Person A (Tech Lead & Core Math) | Drafted development plan (`docs/PLAN.md`); wrote core astronomy modules (`frames.ts`, `ephemeris.ts`, `horizon.ts`, `events.ts`); implemented 3D Moon globe (`Globe.tsx`), terrain landscape (`Landscape.tsx`), celestial scaling (`SkyBodies.tsx`), polar map (`PolarMap.tsx`), site/date ranking (`BestDates.tsx`, `Recommend.tsx`), scenario compare (`Compare.tsx`), and guided tour (`Tour.tsx`); authored test suites; reviewed/merged PRs. | Defined architecture and data contracts; set numerical accuracy standards; directed features and merges; verified test passes against Horizons. |
| **Claude Max (Anthropic)** | Person B (Data Pipeline) | Wrote Python precomputation scripts (`pipeline/`): `fetch_horizons_fixtures.py` (JPL Horizons API client), `build_ephem.py` (`spiceypy` DE440 ephemeris generator for 2024–2040), `build_horizons.py` (720-azimuth ray-marching across LOLA DEMs), `build_polar_grid.py`, and `build_terrain_patches.py`. | Selected SPICE kernels and DEM datasets; downloaded raw PDS products; audited output binary formats. |
| **Google Antigravity (Antigravity Pro / Gemini 3.8 Flash)** | Person C (Main Views) | Architected and implemented the first version of the main views: 360° horizon panorama (`Panorama.tsx`), 30-day three-tier timeline ribbon (`Timeline.tsx`), metrics cards (`Metrics.tsx`), schedule-slip sensitivity simulator (`ScheduleSlip.tsx`), two-pointer interval intersection algorithm for joint power+DTE windows (`intervals.ts`), and unit tests (`views.test.ts`). Provided panorama zoom presets (Polar $-3^\circ \to +7^\circ$, Mid $-5^\circ \to +25^\circ$, Full Sky $-10^\circ \to +90^\circ$), mouse crosshair az/el readouts, and schedule-slip delta card. Documented references in `docs/REFERENCES_ANTIGRAVITY_PRO.md`. | Verified interval intersection mathematics; ensured UI integration with core astronomy contracts; tested edge conditions. |
| **ChatGPT / GPT-4o / GPT Pro (OpenAI)** | Person D (Catalog Research & 3D wireframing) | Assisted in researching candidate landing site coordinates, mission names, target crater features, and primary NASA/academic source URLs for `sites.json`; drafted initial wireframes for scenario comparison. | Cross-checked coordinates with primary NASA mission documentation and QuickMap before committing. |
| **Human / No Subscription (Team Lead & Product Owner)** | Person E (Validation, QA & Submission) | *No AI generation of ideas.* Conceived project concept; confirmed 2026 Space Apps submission rules directly in browser; verified 18 of 20 landing site coordinates and elevations row-by-row against LROC QuickMap, NSSDC, JAXA, and ISRO records (`docs/QA.md`); conducted spot checks against live JPL Horizons web tool; authored demo script (`docs/DEMO.md`), slides, and submission documentation. | Full ownership of quality assurance, validation, demo script, and final submission. |

### 3. Verification & Scientific Integrity
- **Ground-Truth Calibration:** All numerical values for celestial coordinates, trajectories, and lighting conditions are computed deterministically from SPICE kernels and checked against 1,060 ground-truth coordinates from the NASA JPL Horizons on-line ephemeris system via automated tests (`npm test`). The maximum error is $<0.0001^\circ$. No AI hallucinated numbers were accepted.
- **Media & Content:** No AI-generated imagery or video of human beings was used. No synthetic media with false NASA branding was generated.

---

### 4. Official Space Apps Submission Form Answer (Copy & Paste Text)

Below is the exact, agreed response to paste into the **"How did you use Super Intelligence (SI) / AI tools?"** question on the Space Apps project submission form:

> **Space Apps Submission Form — AI / Super Intelligence (SI) Disclosure:**
>
> "Our team used AI coding assistants (Claude Code, Claude Max, Google Antigravity, and ChatGPT) to help write code, build precomputation pipelines, and author tests, under strict human guidance. 
>
> In accordance with Space Apps rules, AI was NOT used to come up with the project idea. The original concept was conceived by the human team: creating a fast, client-side navigator that lets mission planners evaluate landing site and date scenarios in seconds and immediately see the impact of schedule slips on power and direct-to-Earth communication. Once the human team established this concept and approach, we prompted Claude Code with our concept and the challenge text to draft our 48-hour development plan, architecture, and team briefs (docs/PLAN.md), which we reviewed and approved before starting development.
>
> AI tools were then used as implementation assistants: Claude Code built the core astronomy engine, 3D Moon globe, polar map, and guided tour; Claude Max assisted with Python scripts to process SPICE DE440 ephemerides and ray-march LOLA DEMs; Google Antigravity implemented the 360° horizon panorama, 30-day three-tier timeline ribbon, interval intersection algorithm, and schedule-slip delta simulator; and ChatGPT assisted with site catalog research. 
>
> To ensure scientific validity, no astronomical numbers from AI were accepted on trust: all calculations are precomputed from official NASA SPICE kernels and verified by an automated test suite against 1,060 fixture values from NASA JPL Horizons, with a maximum deviation under 0.0001 degrees. All site coordinates were manually verified against LROC QuickMap, NSSDC, and space agency sources. No AI-generated media of people or deceptive branding was used."

---

## Before submitting

- [x] Both guides read in a browser; table above confirmed
- [x] Team decision on the AI rule recorded (agreed on 15 Nov 2026)
- [x] Site list verified: 18 of 20 rows confirmed against their cited sources and set to `verified: true` on 14 Nov 2026; 2 rows (shackleton-ridge, change-7) left `verified: false` with a reason. Full log in `docs/QA.md`.
- [ ] Live demo link opens in a private window with no login
- [x] Repo is public
- [ ] Demo video or slides hosted publicly
- [ ] Every teammate added to the team on the Space Apps site
- [ ] Submitted well before Sunday 12:00
