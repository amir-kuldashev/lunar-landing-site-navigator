# web

Vite + React + TypeScript app.

```
npm install
npm run dev      # local dev server
npm test         # core math tests, including the JPL Horizons check
npm run build    # static build in dist/
```

- `src/core/` — astronomy math. Views import only from `src/core/index.ts`.
- `src/views/` — UI components (one folder per owner, see `docs/PLAN.md`).
- `public/data/` — generated data: `sites.json`, `ephem.bin`, `ephem.json`, `horizons/{id}.json`.
- `tests/` — vitest tests.

## Design rules (keep the site looking like one thing)

- Colours and motion timings are tokens in `src/index.css` (`@theme`). Use `text-sun` / `bg-sun` for anything about sunlight, `text-earth` / `bg-earth` for anything about Earth contact, `text-warn` for a blocked or dark state. No other accent colours.
- One typeface, Archivo. Headings use the `.display` class (wide), numbers use `.num` (tabular).
- Buttons are `.btn` or `.btn-primary`; inputs are `.field`.
- Motion only where it explains something: the camera flight to a site, time playback, the page's single load-in. Everything must rest under `prefers-reduced-motion`.
- Plain words in the UI: say what a number means ("until sunset"), no jargon without a reason.
