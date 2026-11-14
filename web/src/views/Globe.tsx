import { Html, Line, OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { getEphemeris, siteVector, type Site, type Topo, type Vec3 } from '../core'
import { useReducedMotion } from '../lib/motion'
import { Sky, SYSTEM_VIEW_DISTANCE } from './SkyBodies'

/**
 * 3D Moon lit by the real Sun direction for the selected time, so the day/night line is true.
 * Scene units: 1 = one lunar radius. Body frame (x to Earth, z north) maps to three.js as (x, z, -y).
 */

const SUN = '#f4c55a'
const EARTH = '#58a6e8'

const b2t = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0], v[2], -v[1])
const unit = (v: Vec3): THREE.Vector3 => b2t(v).normalize()

function useMoonTextures() {
  const [maps, setMaps] = useState<{ color?: THREE.Texture; bump?: THREE.Texture }>({})
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const base = `${import.meta.env.BASE_URL}textures/`
    loader.load(
      `${base}moon_color_2k.jpg`,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        setMaps((m) => ({ ...m, color: t }))
      },
      undefined,
      () => console.warn('Moon colour texture missing; using a plain grey sphere'),
    )
    loader.load(
      `${base}moon_elev.jpg`,
      (t) => setMaps((m) => ({ ...m, bump: t })),
      undefined,
      () => undefined,
    )
  }, [])
  return maps
}

function Moon({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  const { color, bump } = useMoonTextures()
  return (
    <mesh
      onDoubleClick={(e) => {
        e.stopPropagation()
        const p = e.point.clone().normalize()
        // three (x, y, z) back to body (x, -z, y)
        const lat = (Math.asin(p.y) * 180) / Math.PI
        const lon = (Math.atan2(-p.z, p.x) * 180) / Math.PI
        onPick(lat, lon)
      }}
    >
      <sphereGeometry args={[1, 160, 80]} />
      <meshStandardMaterial
        key={`${color ? 'c' : ''}${bump ? 'b' : ''}`}
        map={color ?? null}
        bumpMap={bump ?? null}
        bumpScale={bump ? 6 : 0}
        color={color ? '#ffffff' : '#8f8c86'}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

function SitePin({
  site,
  selected,
  onSelect,
}: {
  site: Site
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const pos = useMemo(() => unit(siteVector(site.lat, site.lon, 0)).multiplyScalar(1.004), [site.lat, site.lon])
  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hover])
  return (
    <group position={pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect(site.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[selected ? 0.014 : 0.011, 16, 16]} />
        <meshBasicMaterial color={selected ? '#ffffff' : hover ? '#ffffff' : '#d8d5ce'} />
      </mesh>
      {(selected || hover) && (
        <Html center distanceFactor={undefined} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="relative">
            {selected && (
              <span
                className="absolute left-1/2 top-1/2 -ml-3 -mt-3 block h-6 w-6 rounded-full border border-white motion-safe:animate-[pulse-ring_2.4s_ease-out_infinite]"
                aria-hidden
              />
            )}
            <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-xs text-ink">
              {site.name}
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

/** Local horizon disc and pointers toward the Sun and Earth from the selected site. */
function SiteGeometry({ site, now }: { site: Site; now: Topo }) {
  const { sun, earth } = getEphemeris().sunEarth(now.t)
  const sv = siteVector(site.lat, site.lon, site.alt_m)
  const origin = unit(sv).multiplyScalar(1.006)
  const normal = unit(sv)
  const dirTo = (b: Vec3) => b2t([b[0] - sv[0], b[1] - sv[1], b[2] - sv[2]]).normalize()
  const sunDir = dirTo(sun)
  const earthDir = dirTo(earth)
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    [normal.x, normal.y, normal.z], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const len = 0.42
  const end = (d: THREE.Vector3) => origin.clone().addScaledVector(d, len)
  const sunUp = now.sun.visibleFraction > 0
  const earthUp = now.earth.visible
  return (
    <group>
      <mesh position={origin} quaternion={quat}>
        <ringGeometry args={[0.118, 0.122, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={origin} quaternion={quat}>
        <circleGeometry args={[0.118, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line
        points={[origin, end(sunDir)]}
        color={SUN}
        lineWidth={sunUp ? 2.5 : 1.25}
        dashed={!sunUp}
        dashSize={0.02}
        gapSize={0.02}
        transparent
        opacity={sunUp ? 1 : 0.45}
      />
      <Line
        points={[origin, end(earthDir)]}
        color={EARTH}
        lineWidth={earthUp ? 2.5 : 1.25}
        dashed={!earthUp}
        dashSize={0.02}
        gapSize={0.02}
        transparent
        opacity={earthUp ? 1 : 0.45}
      />
      <Html position={end(sunDir)} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span className="block translate-y-3 whitespace-nowrap text-[11px] font-medium text-sun">Sun{sunUp ? '' : ' (below horizon)'}</span>
      </Html>
      <Html position={end(earthDir)} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <span className="block -translate-y-3 whitespace-nowrap text-[11px] font-medium text-earth">
          Earth{earthUp ? '' : ' (below horizon)'}
        </span>
      </Html>
    </group>
  )
}

/** Flies the camera to look down on the selected site; a drag by the visitor cancels the flight. */
function CameraRig({ site, flyKey, view, t }: { site: Site; flyKey: string; view: GlobeView; t: number }) {
  const { camera } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const reduced = useReducedMotion()
  const flight = useRef<{ dir: THREE.Vector3; dist: number } | null>(null)

  useEffect(() => {
    let dir = unit(siteVector(site.lat, site.lon, 0))
    let dist = 3.1
    if (view === 'system') {
      // Stand back, square-on to the plane holding the Sun, Moon and Earth, on the site's side of it.
      const { sun, earth } = getEphemeris().sunEarth(t)
      const normal = unit(earth).cross(unit(sun))
      if (normal.lengthSq() < 1e-4) normal.set(0, 1, 0)
      normal.normalize()
      if (normal.dot(dir) < 0) normal.negate()
      dir = normal
      dist = SYSTEM_VIEW_DISTANCE
    } else {
      // Sit a little off the vertical so the horizon disc and pointers read in perspective.
      const side = new THREE.Vector3(0, 1, 0).cross(dir)
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
      dir.addScaledVector(side.normalize(), 0.35).normalize()
    }
    if (reduced) {
      camera.position.copy(dir.multiplyScalar(dist))
      camera.lookAt(0, 0, 0)
      flight.current = null
    } else {
      flight.current = { dir, dist }
    }
  }, [flyKey, view, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const f = flight.current
    if (!f) return
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 2.6)
    const cur = camera.position.clone().normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(cur, f.dir)
    cur.applyQuaternion(new THREE.Quaternion().slerp(q, k))
    const dist = THREE.MathUtils.lerp(camera.position.length(), f.dist, k)
    camera.position.copy(cur.multiplyScalar(dist))
    camera.lookAt(0, 0, 0)
    if (cur.normalize().angleTo(f.dir) < 0.002 && Math.abs(dist - f.dist) < 0.005) flight.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      minDistance={1.35}
      maxDistance={80}
      onStart={() => {
        flight.current = null
      }}
    />
  )
}

/** "site" looks down on the landing site; "system" pulls back to show the Moon, Earth and Sun together. */
export type GlobeView = 'site' | 'system'

export interface GlobeProps {
  view: GlobeView
  sites: Site[]
  site: Site
  now: Topo
  onSelect: (id: string) => void
  onPick: (lat: number, lon: number) => void
}

export default function Globe({ sites, site, now, view, onSelect, onPick }: GlobeProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 7.5], fov: 34, near: 0.05, far: 400 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      aria-label={`3D view of the Moon showing ${site.name}, lit by the Sun as it is at the selected time`}
      role="img"
    >
      <color attach="background" args={['#000000']} />
      {/*
        Workaround: with this React and drei pairing, the first <Html> mounted in the scene renders an
        empty container (seen in the page's DOM), so whichever label came first went missing. An empty
        one goes first to take that slot. Remove once the libraries are updated and labels survive without it.
      */}
      <Html style={{ display: 'none' }} />
      <Stars radius={120} depth={40} count={2600} factor={3.2} saturation={0} fade speed={0} />
      <Sky t={now.t} />
      <Moon onPick={onPick} />
      {sites.map((s) => (
        <SitePin key={s.id} site={s} selected={s.id === site.id} onSelect={onSelect} />
      ))}
      <SiteGeometry site={site} now={now} />
      <CameraRig site={site} view={view} t={now.t} flyKey={`${site.id}:${site.lat.toFixed(3)}:${site.lon.toFixed(3)}`} />
    </Canvas>
  )
}
