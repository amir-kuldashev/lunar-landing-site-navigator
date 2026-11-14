# Submission kit

Everything needed to fill in the Space Apps project page. Owner: Person E.

## Rules (confirmed against the 2026 guide)

Confirmed on 14 Nov 2026 by reading the official 2026 Project Submission Guide (dated 13 Nov 2026) directly in a
browser. Values below are from the live guide, not last year's.

- Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging: https://www.spaceappschallenge.org/resources/judging-awards-guide

| Rule | Confirmed 2026 wording | OK |
|---|---|---|
| Submission window | Opens Sat 14 Nov 9:00 a.m., closes Sun 15 Nov 11:59 p.m., in the time zone of the team's Local Event (Universal Event: Team Owner's residence) | ✅ |
| Demo | Required. Video 30 seconds or less, OR slide deck up to 7 slides including title and intro slides | ✅ |
| Hosting | Demo and final-project links hosted externally (YouTube, Drive, GitHub, etc.); must open with no password, permission or registration | ✅ |
| Page images | JPG/PNG/GIF up to 10 MB can be uploaded to the project page; videos and documents cannot — link them externally | ✅ |
| Language | English on the project page and all linked material. A video may be in another language only with English subtitles; slide decks must be English | ✅ |
| Super Intelligence (SI) | Allowed and must be disclosed. SI must not be used to come up with the idea of how to solve the challenge. SI-generated images/videos need a **visible watermark**; audio/code/data need acknowledgment in descriptive text and metadata. No NASA branding in generated content. The SI answer is data-collection only (judges do not see it), but judges do see SI indicators inside the project. | ⚠️ action |
| NASA data | Must use at least one NASA data set or resource to be eligible for a Global Award | ✅ (SPICE DE440, LOLA, Horizons, SVS Moon Kit) |
| Judging | Impact, Creativity, Validity, Relevance, Presentation | ✅ |
| Website access | Optional but recommended: request a FortiGuard Web Filter Classification for the live-demo site so judges are not blocked | ☐ |

**SI/AI disclosure — action before submit.** AI assistants were used heavily (including to draft the dev plan),
which is allowed. Two concrete to-dos from the 2026 wording: (1) the SI question in the form must be answered
truthfully (it is data-collection only, judges do not see it); (2) any SI-generated media shown in the demo
needs a visible watermark, and SI-written code/data needs a note in descriptive text/metadata — our code is
AI-assisted, so add that acknowledgment line. Draft disclosure is below.

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

## Use of AI tools (draft, to be completed truthfully by the team)

AI coding assistants were used throughout this project:

- **Claude Code (Anthropic):** drafted the development plan and task split from the challenge text, wrote
  most of the core astronomy module, the tests, the 3D Moon view and page layout, reviewed and merged teammates'
  pull requests, and drafted this document.
- **Google Antigravity (Antigravity Pro / Gemini):** architected and implemented the core main views
  (`views/Panorama.tsx`, `views/Timeline.tsx`, `views/Metrics.tsx`, `views/ScheduleSlip.tsx`, `views/intervals.ts`),
  including the true-angular-scale horizon panorama, 30-day three-tier timeline ribbon, interactive schedule-slip
  scenario comparison engine, and corresponding unit tests. Full details in `docs/REFERENCES_ANTIGRAVITY_PRO.md`.
- **Other assistants used by teammates:** ChatGPT, Claude.

All numerical results were checked against JPL Horizons by an automated test, not accepted on the AI's word.
No AI-generated images, audio or video of people were used.

## Before submitting

- [ ] Both guides read in a browser; table above confirmed
- [ ] Team decision on the AI rule recorded
- [x] Site list verified: 18 of 20 rows confirmed against their cited sources and set to `verified: true` on 14 Nov 2026; 2 rows (shackleton-ridge, change-7) left `verified: false` with a reason. Full log in `docs/QA.md`.
- [ ] Live demo link opens in a private window with no login
- [x] Repo is public
- [ ] Demo video or slides hosted publicly
- [ ] Every teammate added to the team on the Space Apps site
- [ ] Submitted with at least two hours to spare
