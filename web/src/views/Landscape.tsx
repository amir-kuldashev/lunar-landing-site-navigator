import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Site, TerrainPatch, Topo } from '../core'

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

function useTerrainGeometry(patch: TerrainPatch) {
  return useMemo(() => {
    const { n, heights, height_m: h0 } = patch
    const scale = SIZE / (patch.width_km * 1000) // metres to block units, same horizontally and vertically
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
    for (let i = 0; i < heights.length; i++) {
      pos.setZ(i, (heights[i] - h0) * scale)
      // Slightly lighter with height, so relief still reads on the night side.
      c.copy(low).lerp(high, hi > lo ? (heights[i] - lo) / (hi - lo) : 0.5)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.rotateX(-Math.PI / 2) // lay it flat: heights now point up, north is -z
    geo.computeVertexNormals()
    return { geo, scale, lo, hi }
  }, [patch])
}

export default function Landscape({ site, now }: { site: Site; now: Topo }) {
  const patch = site.terrain!
  const { geo, scale, lo, hi } = useTerrainGeometry(patch)

  const sunDir = skyDir(now.sun.az, now.sun.el)
  const earthDir = skyDir(now.earth.az, now.earth.el)
  const sunUp = now.sun.visibleFraction > 0
  const earthUp = now.earth.visible
  const half = SIZE / 2
  const mast = Math.max(0.12, 2 * scale * 40) // the lander marker is enlarged; a real lander would be invisible
  const origin = new THREE.Vector3(0, mast, 0)
  const reach = 2.4
  const edgeY = (lo - patch.height_m) * scale - 0.15

  return (
    <group>
      {/* Faint fill so the shape is readable at night; the Sun does the rest. */}
      <ambientLight intensity={0.22} />
      <directionalLight
        position={sunDir.clone().multiplyScalar(30)}
        intensity={3.3 * now.sun.visibleFraction}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />

      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
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
        <span className="whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-xs text-ink">{site.name}</span>
      </Html>

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
