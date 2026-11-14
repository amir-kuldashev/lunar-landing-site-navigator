import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Site, TerrainPatch, Topo } from '../core'
import { latLon } from '../lib/format'
import { heightColour } from '../lib/heightColours'

/**
 * The ground around the landing site as a 3D block, cut from LOLA elevation data.
 *
 * True to life: the shape of the terrain at true vertical scale, north at the far edge, and the
 * Sun shining from its real compass direction and height for the chosen time, with the shadows the
 * terrain inside the block casts. Not shown: shadows from terrain outside the block, and anything
 * smaller than the block's sample spacing (rocks, small craters).
 *
 * Block units: the block is SIZE wide; east is +x, up is +y, north is -z.
 */

const SIZE = 10
const SUN = '#f4c55a'
const EARTH = '#58a6e8'

/** Unit vector toward a compass direction and elevation, in block coordinates. */
function skyDir(azDeg: number, elDeg: number): THREE.Vector3 {
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}

/**
 * Fill in between samples with a smooth (Catmull-Rom) surface. Used for coarse blocks so they do not
 * show as flat facets. It adds no detail the data does not have; it only rounds the joins.
 */
function upsample(heights: ArrayLike<number>, n: number, factor: number): { heights: Float32Array; n: number } {
  if (factor <= 1) return { heights: Float32Array.from(heights), n }
  const m = (n - 1) * factor + 1
  const at = (r: number, c: number) => heights[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))]
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  const out = new Float32Array(m * m)
  for (let R = 0; R < m; R++) {
    const r = Math.min(Math.floor(R / factor), n - 2)
    const tr = R / factor - r
    for (let C = 0; C < m; C++) {
      const c = Math.min(Math.floor(C / factor), n - 2)
      const tc = C / factor - c
      const rows = [-1, 0, 1, 2].map((dr) => cr(at(r + dr, c - 1), at(r + dr, c), at(r + dr, c + 1), at(r + dr, c + 2), tc))
      out[R * m + C] = cr(rows[0], rows[1], rows[2], rows[3], tr)
    }
  }
  return { heights: out, n: m }
}

/** Fine speckle for the surface colour, so sunlit ground reads as dust and not as plastic. Colour only, no shape. */
function useGrainTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(size, size)
    let seed = 1337
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(255 * (0.86 + 0.14 * rnd()))
      img.data.set([v, v, v, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(14, 14)
    tex.anisotropy = 8
    return tex
  }, [])
}

function useTerrainGeometry(patch: TerrainPatch, coded: boolean) {
  return useMemo(() => {
    const h0 = patch.height_m
    const scale = SIZE / (patch.width_km * 1000) // metres to block units, same horizontally and vertically
    // Coarse blocks are rounded off to about 250 samples a side; fine ones are drawn as they are.
    const { heights, n } = upsample(patch.heights, patch.n, Math.max(1, Math.round(256 / patch.n)))
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1)
    // The plane is built in x/y facing +z; rows run from the top (north) down, as the data does.
    const pos = geo.attributes.position as THREE.BufferAttribute
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < heights.length; i++) {
      lo = Math.min(lo, heights[i])
      hi = Math.max(hi, heights[i])
    }
    const colors = new Float32Array(heights.length * 3)
    const low = new THREE.Color('#77736c')
    const high = new THREE.Color('#d2cec5')
    const c = new THREE.Color()
    let iLo = 0
    let iHi = 0
    for (let i = 0; i < heights.length; i++) {
      pos.setZ(i, (heights[i] - h0) * scale)
      if (heights[i] < heights[iLo]) iLo = i
      if (heights[i] > heights[iHi]) iHi = i
      const v = hi > lo ? (heights[i] - lo) / (hi - lo) : 0.5
      if (coded) {
        // Height on NASA's kind of colour scale: blue low, red and white high.
        const [r, g, b] = heightColour(v)
        c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
      } else {
        // Natural grey, slightly lighter with height so relief still reads on the night side.
        c.copy(low).lerp(high, v)
      }
      colors.set([c.r, c.g, c.b], i * 3)
    }
    // Where the lowest and highest ground in the block are, in block coordinates.
    const place = (i: number): [number, number, number] => [
      -SIZE / 2 + ((i % n) / (n - 1)) * SIZE,
      (heights[i] - h0) * scale,
      -SIZE / 2 + (Math.floor(i / n) / (n - 1)) * SIZE,
    ]
    const lowest = place(iLo)
    const highest = place(iHi)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.rotateX(-Math.PI / 2) // lay it flat: heights now point up, north is -z
    geo.computeVertexNormals()

    // Walls down to a flat base, so the terrain reads as a block cut out of the Moon.
    const baseY = (lo - h0) * scale - 0.35
    const half = SIZE / 2
    const wall: number[] = []
    const y = (r: number, col: number) => (heights[r * n + col] - h0) * scale
    const quad = (x0: number, z0: number, y0: number, x1: number, z1: number, y1: number) =>
      wall.push(x0, y0, z0, x1, y1, z1, x1, baseY, z1, x0, y0, z0, x1, baseY, z1, x0, baseY, z0)
    const px = (col: number) => -half + (col / (n - 1)) * SIZE
    const pz = (r: number) => -half + (r / (n - 1)) * SIZE
    for (let k = 0; k < n - 1; k++) {
      quad(px(k + 1), -half, y(0, k + 1), px(k), -half, y(0, k)) // north edge
      quad(px(k), half, y(n - 1, k), px(k + 1), half, y(n - 1, k + 1)) // south edge
      quad(-half, pz(k), y(k, 0), -half, pz(k + 1), y(k + 1, 0)) // west edge
      quad(half, pz(k + 1), y(k + 1, n - 1), half, pz(k), y(k, n - 1)) // east edge
    }
    const walls = new THREE.BufferGeometry()
    walls.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3))
    walls.computeVertexNormals()
    return { geo, walls, scale, lo, hi, baseY, lowest, highest }
  }, [patch, coded])
}

export default function Landscape({
  site,
  now,
  coded,
}: {
  site: Site
  now: Topo
  /** True: colour the ground by height under even map lighting. False: natural grey under the real Sun. */
  coded: boolean
}) {
  const patch = site.terrain!
  const { geo, walls, scale, lo, hi, baseY, lowest, highest } = useTerrainGeometry(patch, coded)
  const grain = useGrainTexture()

  const sunDir = skyDir(now.sun.az, now.sun.el)
  const earthDir = skyDir(now.earth.az, now.earth.el)
  const sunUp = now.sun.visibleFraction > 0
  const earthUp = now.earth.visible
  const half = SIZE / 2
  const mast = Math.max(0.12, 2 * scale * 40) // the lander marker is enlarged; a real lander would be invisible
  const origin = new THREE.Vector3(0, mast, 0)
  const reach = 2.4
  const edgeY = baseY

  return (
    <group>
      {/*
        Real sunlight: a faint fill so the shape is readable at night, and the Sun does the rest.
        Height colours: an even map light from the north-west, always on, so the colours can be read
        at any time. The Sun and Earth pointers still show the real directions.
      */}
      <ambientLight intensity={coded ? 0.62 : 0.22} />
      <directionalLight
        position={coded ? [-14, 16, -14] : sunDir.clone().multiplyScalar(30)}
        intensity={coded ? 1.9 : 3.3 * now.sun.visibleFraction}
        color={coded ? '#ffffff' : '#fff4e0'}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.012}
        shadow-radius={2.5}
        shadow-camera-left={-7.4}
        shadow-camera-right={7.4}
        shadow-camera-top={7.4}
        shadow-camera-bottom={-7.4}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />

      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial key={coded ? 'coded' : 'natural'} vertexColors map={coded ? null : grain} roughness={1} metalness={0} />
      </mesh>
      {/* The cut faces of the block. */}
      <mesh geometry={walls}>
        <meshStandardMaterial color="#3a3835" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Frame at the base of the block, with north marked. */}
      <Line
        points={[
          [-half, edgeY, -half],
          [half, edgeY, -half],
          [half, edgeY, half],
          [-half, edgeY, half],
          [-half, edgeY, -half],
        ]}
        color="#5b606b"
        lineWidth={1}
      />
      {(
        [
          ['N', 0, -half - 0.45],
          ['E', half + 0.45, 0],
          ['S', 0, half + 0.45],
          ['W', -half - 0.45, 0],
        ] as const
      ).map(([label, x, z]) => (
        <Html key={label} position={[x, edgeY, z]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <span className={`text-xs ${label === 'N' ? 'font-semibold text-ink' : 'text-muted'}`}>{label}</span>
        </Html>
      ))}

      {/* The lander, much enlarged. */}
      <mesh position={[0, mast / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, mast, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={origin}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html position={[0, mast + 0.3, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <span className="block whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-center text-xs text-ink">
          {site.name}
          <span className="num block text-[10px] text-muted">{latLon(site.lat, site.lon)}</span>
        </span>
      </Html>

      {/* The highest and lowest ground in the block. */}
      {(
        [
          ['Highest', highest, hi],
          ['Lowest', lowest, lo],
        ] as const
      ).map(([word, p, h]) => (
        <group key={word} position={p}>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html position={[0, 0.28, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[15, 0]}>
            <span className="num whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-ink">
              {word} {h >= 0 ? '+' : '−'}
              {Math.abs(Math.round(h)).toLocaleString('en-GB')} m
            </span>
          </Html>
        </group>
      ))}

      {/* Where the Sun and Earth are from here. */}
      <Line
        points={[origin, origin.clone().addScaledVector(sunDir, reach)]}
        color={SUN}
        lineWidth={sunUp ? 2.5 : 1.25}
        dashed={!sunUp}
        dashSize={0.12}
        gapSize={0.1}
        transparent
        opacity={sunUp ? 1 : 0.5}
      />
      <Html position={origin.clone().addScaledVector(sunDir, reach + 0.3)} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span className="whitespace-nowrap text-[11px] font-medium text-sun">Sun{sunUp ? '' : ' (hidden)'}</span>
      </Html>
      <Line
        points={[origin, origin.clone().addScaledVector(earthDir, reach)]}
        color={EARTH}
        lineWidth={earthUp ? 2.5 : 1.25}
        dashed={!earthUp}
        dashSize={0.12}
        gapSize={0.1}
        transparent
        opacity={earthUp ? 1 : 0.5}
      />
      <Html position={origin.clone().addScaledVector(earthDir, reach + 0.3)} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span className="whitespace-nowrap text-[11px] font-medium text-earth">Earth{earthUp ? '' : ' (hidden)'}</span>
      </Html>

      <Html position={[half, edgeY, half + 0.9]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span className="num whitespace-nowrap text-[11px] text-muted">
          {patch.width_km} km across, {(hi - lo).toFixed(0)} m from lowest to highest
        </span>
      </Html>
    </group>
  )
}
