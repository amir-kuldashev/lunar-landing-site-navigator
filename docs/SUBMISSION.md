# Submission kit

Everything needed to fill in the Space Apps project page. Owner: Person E.

## Rules to check first

These come from a web search of the official pages on 14 Nov 2026. The Space Apps site could not be opened
directly from the dev machine (certificate error), and the submission-guide text the search found may be last
year's version. **Someone must open the two guides in a browser and confirm every line below.**

- Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging: https://www.spaceappschallenge.org/resources/judging-awards-guide

| Rule | What the search found | Confirmed in the 2026 guide? |
|---|---|---|
| Deadline | Submissions close Sunday 15 Nov, 11:59 PM local time | ☐ |
| Demo | Required. A video of 30 seconds or less, or a slide deck of up to 7 slides including title and intro | ☐ |
| Hosting | Demo and project links are hosted elsewhere and must open with no login, permission or registration | ☐ |
| Language | English on the project page and in all linked material | ☐ |
| People | No images or likenesses of anyone under 18 | ☐ |
| AI tools | Allowed, and the submission must describe how they were used. The guide text says AI should not be used to come up with the idea for how to solve the challenge | ☐ |
| Judging | Impact, Creativity, Validity, Relevance, Presentation | ☐ |

**The AI rule needs a team decision before submitting.** AI tools were used heavily on this project, including
for the development plan. Read the exact 2026 wording, then describe the use truthfully (draft below). Do not
understate it.

## Links to submit

| Item | Link | Ready? |
|---|---|---|
| Live demo | not deployed yet | ☐ |
| Code | https://github.com/amir-kuldashev/lunar-landing-site-navigator (must be made public) | ☐ |
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
- Pick a date and time, or press Play to watch a lunar day unfold.
- Read the answer in plain words, with the numbers behind it: Sun and Earth elevation, whether there is
  sunlight and a direct Earth link, and a countdown to the next sunset or Earthset.
- See the sky from the site with the terrain skyline drawn in, and the paths the Sun and Earth follow.
- Scan a 30-day ribbon of sunlight, Earth contact, and both together.
- Slide the landing date earlier or later and see what gets better or worse.
- Pin several site and date scenarios and compare them in one table.

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
- **Other assistants used by teammates** (each person fills in what they used and for what): ChatGPT,
  Google Antigravity, Claude.

All numerical results were checked against JPL Horizons by an automated test, not accepted on the AI's word.
No AI-generated images, audio or video of people were used.

## Before submitting

- [ ] Both guides read in a browser; table above confirmed
- [ ] Team decision on the AI rule recorded
- [ ] Site list verified: every row in `web/public/data/sites.json` has a `source_url`; a person opens each source, confirms the numbers, and sets `verified` to true (rows with a `note` need extra care)
- [ ] Live demo link opens in a private window with no login
- [ ] Repo is public
- [ ] Demo video or slides hosted publicly
- [ ] Every teammate added to the team on the Space Apps site
- [ ] Submitted with at least two hours to spare
