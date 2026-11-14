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
