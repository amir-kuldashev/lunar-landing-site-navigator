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

**SI/AI disclosure.** We used AI coding assistants heavily throughout the project, including to draft our
development plan and the first design of the tool. We disclose this in "Use of AI tools" below, which also has
the text for the submission form's AI question. All the code in our repository is AI-assisted.

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

## Use of AI tools

Three of us committed to this project, and all three of us used AI coding assistants. We used no other AI
tools. We checked this section against our repository's commit history on 15 Nov 2026.

### Where the idea came from

- The problem and the kind of tool wanted are NASA's: they are set out in the "Lunar Landing Site Navigator"
  challenge. We chose this challenge.
- We gave Claude Code the challenge text and asked it to draft a development plan. That plan (`docs/PLAN.md`)
  proposed the first design of our tool: the views, the architecture, the data files and the split of work. We
  reviewed and approved it.
- From there we directed the work. We asked for these features during the build: suggesting the best landing
  site for a date; scoring the whole south-polar surface instead of only named points; zooming to a selected
  point and showing its terrain in 3D; the height-colour look of the landscape; the design of the guided tour;
  the zoomable date chart; the pinned control bar; the redesign of the Sun and Earth; and the Moon loading
  indicator.

### Who used what

| Tool | Who on our team | What we used the AI for | What we did ourselves |
|---|---|---|---|
| **Claude Code (Anthropic)** | Team lead | Drafting the development plan. Writing the core astronomy module and its tests; the 3D Moon, landscape and Sun-Moon-Earth views; the sky panorama, timeline and readouts in the final app; the south-pole map; the site and date rankings; the scenario comparison; the guided tour. Writing `fetch_horizons_fixtures.py`, `build_ephem.py`, `build_polar_grid.py` and `build_terrain_patches.py`, and rewriting `build_horizons.py` for the polar elevation models. Compiling the 20-site catalog with a source for each. Reviewing and merging pull requests. Drafting the demo script, this document and the project summary. | Chose the challenge; approved the plan; decided which features to build and asked for the ones listed above; reviewed the site in the browser and reported what to fix; decided on hosting and publication. |
| **Claude (Anthropic)** | Data pipeline and QA | Writing the first version of `build_horizons.py` (terrain skylines from LOLA data), fixing and running `build_ephem.py`, regenerating the Horizons fixtures. Checking 18 of the 20 site coordinates against their cited sources and writing the QA log. Confirming the submission rules against the official guide. Writing `docs/RESOURCES.md`. | Ran the pipeline and downloads; directed and reviewed the checks. |
| **Google Antigravity (Gemini)** | Views | Writing a first version of the main views (panorama, timeline, metrics, schedule-slip simulator) and the interval-intersection helper with its unit tests. In our final app, the interval helper and its tests are used as written; the schedule-slip simulator and the panorama's zoom presets and pointer readout were carried over and rewritten; the other views were replaced. Writing `docs/REFERENCES_ANTIGRAVITY_PRO.md`. | Directed and reviewed that work. |

All the code in our repository is AI-assisted.

### How we checked the results

- Our Sun and Earth positions are computed from NASA SPICE kernels, not produced by an AI. Our automated test
  (`npm test`) compares them with 1,060 values from NASA JPL Horizons; the largest difference is 0.0001 degrees.
- We checked 18 of our 20 site coordinates against their cited sources (NSSDC, JAXA and mission pages). The
  other two are marked unverified in the app.
- We use no AI-generated images, audio or video. The Moon and Earth imagery is NASA's.

### Text for the submission form's AI question

> We used AI coding assistants throughout this project: Claude Code and Claude (Anthropic), and Google
> Antigravity (Gemini). All code in our repository is AI-assisted.
>
> The problem and the kind of tool wanted come from NASA's challenge, which our team chose. We gave Claude Code
> the challenge text and asked it to draft a development plan; that plan proposed the first design of the tool
> and the split of work, and we reviewed and approved it. From there we directed the work and asked for
> features during the build, including the best-site ranking for a date, scoring the whole south-polar
> surface, the 3D terrain view and the guided tour.
>
> We used Claude Code to write the astronomy calculations and their tests, the 3D views, the maps, the rankings
> and most of the interface, to compile the site list, and to draft our documentation. We used Claude to write
> the first terrain-skyline script, run the data pipeline, check site coordinates against their sources and
> write the resource list. We used Google Antigravity to write first versions of the main views; its interval
> helper and tests are in our final app and its schedule-slip simulator was carried over.
>
> We accepted no numbers on an AI's word. Our Sun and Earth positions are computed from NASA SPICE data and
> checked by our automated test against 1,060 values from NASA JPL Horizons (largest difference 0.0001 degrees).
> We checked 18 of our 20 site coordinates against their cited sources. We use no AI-generated images, audio or
> video.

## Before submitting

- [x] Both guides read in a browser; table above confirmed
- [ ] Each of us has read "Use of AI tools" below and confirmed our own row is accurate
- [x] Site list verified: 18 of 20 rows confirmed against their cited sources and set to `verified: true` on 14 Nov 2026; 2 rows (shackleton-ridge, change-7) left `verified: false` with a reason. Full log in `docs/QA.md`.
- [ ] Live demo link opens in a private window with no login
- [x] Repo is public
- [ ] Demo video or slides hosted publicly
- [ ] Every teammate added to the team on the Space Apps site
- [ ] Submitted well before Sunday 12:00
