# Demo script

Two versions: a 30-second cut for the submission video, and a 90-second walkthrough for live judging.
Record from the live site, in a window at least 1440 px wide, so the Moon and the readouts sit side by side.

Live site: https://amir-kuldashev.github.io/lunar-landing-site-navigator/

Each shot below has a link that opens the app already set up for it. Open the link, wait for the Moon to load,
then record.

## 30-second video

| Time | Shot | Open this | Caption or voice |
|---|---|---|---|
| 0–5 s | The 3D Moon flies to the south pole; the verdict sentence and the Sun and Earth cards | [Shackleton ridge, 1 Jan 2027](https://amir-kuldashev.github.io/lunar-landing-site-navigator/?site=shackleton-ridge&t=2027-01-01T00:00) | "A Moon lander needs sunlight for power and a view of Earth for radio. At the south pole, both sit right at the horizon." |
| 5–10 s | Click **Landscape**: the crater and ridge in height colours; drag to rotate | [Landscape view](https://amir-kuldashev.github.io/lunar-landing-site-navigator/?site=shackleton-ridge&t=2027-01-18T00:00&view=terrain) | "Terrain decides everything. This is real NASA elevation data around the site." |
| 10–15 s | Press **Start** in the top bar; scroll to the sky strip: the Sun skims the hills, Earth sinks behind them | same link as the first shot | "Pick a site and a date. See exactly when you have Sun and Earth, and for how long." |
| 15–21 s | **Best sites for this date**, **Whole south pole**: the map and its numbered best areas | [South-pole map, 18 Jan 2027](https://amir-kuldashev.github.io/lunar-landing-site-navigator/?site=shackleton-ridge&t=2027-01-18T00:00&rank=map) | "Ask where to land: every 4 km of the polar region is scored. It finds the regions NASA is considering." |
| 21–26 s | **The best dates to land at this site**: the chart and numbered dates; then drag the slip slider | [IM-2, 18 Jan 2027](https://amir-kuldashev.github.io/lunar-landing-site-navigator/?site=im-2&t=2027-01-18T00:00) | "Ask when to land, and what a three-week delay costs." |
| 26–30 s | **Compare scenarios** with three pins: the table and the skies side by side | [Three pinned scenarios](https://amir-kuldashev.github.io/lunar-landing-site-navigator/?site=im-2&t=2027-01-18T00:00&pins=im-2@2027-01-18T00:00~shackleton-ridge@2027-01-18T00:00~malapert@2027-01-18T00:00) | "Compare options side by side. Sun and Earth positions are checked against NASA JPL Horizons." |

If a slide deck is easier than a video (up to 7 slides), use one screenshot per row above plus a title slide.

## 90-second live walkthrough

1. **The problem (10 s).** A lander needs the Sun and a line to Earth. At the south pole both sit within a few
   degrees of the horizon, so a ridge or a three-week delay can decide the mission.
2. **One site, one date (15 s).** Shackleton connecting ridge. Read the plain-language sentence, then the cards:
   the Sun about 1.4° up, Earth below the skyline, a countdown to Earthrise.
3. **Why terrain matters (20 s).** Open **Landscape**. The crater is a deep blue bowl, the ridge red and white
   beside it. Switch to **Real sunlight** to show the true lighting and shadows. Then open the Malapert crater
   floor: no Sun and no Earth all year.
4. **Where to land (15 s).** **Whole south pole** map. Point at the numbered best areas: the tool was never told
   where to look, and it picks out Malapert Massif and Mons Mouton, both NASA Artemis candidate regions.
5. **When to land (15 s).** The best-dates chart for IM-2. Drag across it to zoom into a month. Then move the
   slip slider to 21 days later and read one card aloud.
6. **Compare and trust (15 s).** Pin two scenarios and show the skies side by side. Close on the validation:
   1,060 Sun and Earth angles checked against JPL Horizons, largest difference 0.0001°. Say what the tool does
   not do: it does not judge whether the ground is safe to land on.

For a first-time audience, the built-in tour covers most of this:
https://amir-kuldashev.github.io/lunar-landing-site-navigator/?tour=1

## Recording checklist

- [ ] Use the live site, not localhost
- [ ] Browser zoom 100 %, bookmarks bar hidden, window at least 1440 px wide
- [ ] Wait for the Moon and the Landscape button to finish loading before recording
- [ ] Captions in English; no people on camera
- [ ] Nothing in the video is AI-generated imagery; if any is added, it needs a visible watermark
- [ ] Upload somewhere that opens without a login (YouTube unlisted or public, or a Drive link set to "anyone")
- [ ] Paste the link into `docs/SUBMISSION.md` and the submission form
