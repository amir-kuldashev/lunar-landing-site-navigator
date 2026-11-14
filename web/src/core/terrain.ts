import type { TerrainPatch } from './types'

/** Terrain blocks around the named sites, built by pipeline/build_terrain_patches.py. */

type Entry = Omit<TerrainPatch, 'heights'> & { offset: number }

export async function loadTerrain(baseUrl = `${import.meta.env.BASE_URL}data`): Promise<Map<string, TerrainPatch>> {
  const out = new Map<string, TerrainPatch>()
  try {
    const [j, b] = await Promise.all([fetch(`${baseUrl}/terrain.json`), fetch(`${baseUrl}/terrain.bin`)])
    if (!j.ok || !b.ok) return out
    const index = (await j.json()) as Record<string, Entry>
    const buf = await b.arrayBuffer()
    for (const [id, e] of Object.entries(index)) {
      const { offset, ...rest } = e
      // Copy out of the shared buffer: offsets are even, but a copy keeps each block independent.
      out.set(id, { ...rest, heights: new Int16Array(buf.slice(offset, offset + e.n * e.n * 2)) })
    }
  } catch (err) {
    // The landscape view is an extra; the rest of the app works without it.
    console.warn('Terrain blocks not loaded:', err)
  }
  return out
}

/** Height of the block at fractional grid position, bilinear. */
export function patchHeight(p: TerrainPatch, row: number, col: number): number {
  const r0 = Math.min(Math.max(Math.floor(row), 0), p.n - 2)
  const c0 = Math.min(Math.max(Math.floor(col), 0), p.n - 2)
  const fr = Math.min(Math.max(row - r0, 0), 1)
  const fc = Math.min(Math.max(col - c0, 0), 1)
  const h = p.heights
  const a = h[r0 * p.n + c0]
  const b = h[r0 * p.n + c0 + 1]
  const c = h[(r0 + 1) * p.n + c0]
  const d = h[(r0 + 1) * p.n + c0 + 1]
  return a * (1 - fr) * (1 - fc) + b * (1 - fr) * fc + c * fr * (1 - fc) + d * fr * fc
}
