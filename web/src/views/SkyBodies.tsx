import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { getEphemeris, type Vec3 } from '../core'
import { useReducedMotion } from '../lib/motion'
import { EARTH_DISTANCE, EARTH_RADIUS, SUN_DISTANCE, SUN_RADIUS } from './skyScale'

/**
 * The Sun and Earth as seen from around the Moon, each in its true direction for the chosen time.
 *
 * What is real: the directions, and which side of Earth is lit.
 * What is not: sizes and distances. The order of sizes is right (Sun, then Earth, then Moon), but
 * Earth is really 3.7 times the Moon's width and the Sun 109 times Earth's, and both are far more
 * distant than drawn. Earth's spin runs at the right rate but does not show the exact face.
 *
 * Sizes and distances live in skyScale.ts, which also guarantees the bodies never touch.
 */
const EARTH_TILT = (23.4 * Math.PI) / 180
const EARTH_TURN_MS = 24.84 * 3600000 // one turn as seen from the Moon

const b2t = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0], v[2], -v[1])

/* ---------- Earth: day side from NASA's Blue Marble, soft twilight, ocean glint, air glow ---------- */

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const EARTH_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 sunDir;
  uniform float hasMap;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float ndl = dot(N, sunDir);
    float day = smoothstep(-0.12, 0.3, ndl);

    vec3 surface = mix(vec3(0.10, 0.28, 0.55), texture2D(map, vUv).rgb, hasMap);
    // Water is where blue clearly leads red; it catches the Sun's reflection.
    float water = smoothstep(0.02, 0.14, surface.b - surface.r);
    vec3 col = surface * (0.012 + 1.05 * day);
    float glint = pow(max(dot(reflect(-sunDir, N), V), 0.0), 48.0);
    col += vec3(1.0, 0.95, 0.85) * glint * water * day * 0.9;

    // Warm band along the day/night line, as sunlight passes through more air.
    float dusk = smoothstep(-0.12, 0.06, ndl) * (1.0 - smoothstep(0.06, 0.32, ndl));
    col += vec3(0.9, 0.38, 0.14) * dusk * 0.07;

    // Air thickens toward the limb.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vec3(0.30, 0.56, 1.0) * rim * (0.08 + 0.9 * day);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
const AIR_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vNormalV;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const AIR_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vNormalV;
  void main() {
    // Drawn on the inside of a slightly larger shell. Facing away from the camera, -z runs from 0 at
    // the shell's outline to about 0.5 at the planet's edge: the glow is strongest there and fades to
    // nothing at the outline, so the shell itself never shows as a ring.
    float halo = pow(smoothstep(0.0, 0.5, -vNormalV.z), 2.2);
    float lit = smoothstep(-0.45, 0.5, dot(normalize(vNormalW), sunDir));
    gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * halo * (0.06 + lit) * 1.5, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function useEarthTexture() {
  const [map, setMap] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}textures/earth_color.jpg`,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        setMap(t)
      },
      undefined,
      () => console.warn('Earth texture missing; using a plain blue sphere'),
    )
  }, [])
  return map
}

function Earth({ position, sunDir, spin }: { position: THREE.Vector3; sunDir: THREE.Vector3; spin: number }) {
  const map = useEarthTexture()
  const label = useTextTexture('Earth', '#58a6e8')
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
        uniforms: { map: { value: null }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, hasMap: { value: 0 } },
      }),
    [],
  )
  const air = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: AIR_VERT,
        fragmentShader: AIR_FRAG,
        uniforms: { sunDir: { value: new THREE.Vector3(1, 0, 0) } },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  surface.uniforms.sunDir.value.copy(sunDir)
  air.uniforms.sunDir.value.copy(sunDir)
  surface.uniforms.map.value = map
  surface.uniforms.hasMap.value = map ? 1 : 0

  return (
    <group position={position}>
      <group rotation={[EARTH_TILT, 0, 0]}>
        <mesh rotation={[0, spin, 0]} material={surface}>
          <sphereGeometry args={[EARTH_RADIUS, 128, 64]} />
        </mesh>
      </group>
      <mesh material={air}>
        <sphereGeometry args={[EARTH_RADIUS * 1.16, 96, 48]} />
      </mesh>
      <sprite scale={[5.4, 1.8, 1]} center={[0.5, 0.5 + (EARTH_RADIUS * 1.16 + 1.3) / 1.8]}>
        <spriteMaterial map={label} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  )
}

/* ---------- Sun: a hot sphere, darker and redder toward its edge, with a slow surface boil and a corona ---------- */

const SUN_VERT = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vPosL;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vPosL = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SUN_FRAG = /* glsl */ `
  uniform float time;
  varying vec3 vNormalV;
  varying vec3 vPosL;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 11.7;
      a *= 0.5;
    }
    return v;
  }
  void main() {
    float mu = clamp(vNormalV.z, 0.0, 1.0);
    // Limb darkening: white-gold in the middle, deep orange at the edge.
    vec3 centre = vec3(1.0, 0.93, 0.70);
    vec3 mid = vec3(1.0, 0.68, 0.22);
    vec3 edge = vec3(0.88, 0.28, 0.04);
    vec3 col = mix(edge, mid, smoothstep(0.0, 0.5, mu));
    col = mix(col, centre, smoothstep(0.35, 1.0, mu));
    // Granulation: slow, fine mottling of the surface.
    vec3 p = normalize(vPosL) * 5.5;
    float g = fbm(p + vec3(0.0, time * 0.05, time * 0.03));
    float cells = fbm(p * 2.6 - vec3(time * 0.04, 0.0, 0.0));
    col *= 0.72 + 0.40 * g + 0.18 * cells;
    gl_FragColor = vec4(col * 1.08, 1.0);
    #include <colorspace_fragment>
  }
`

/** Glow that hugs the Sun's edge and fades smoothly, drawn once on a canvas. */
function useCoronaTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(size, size)
    // The Sun's disc reaches CORONA_DISC of the sprite's half-width; the glow starts there.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5
        const dy = (y + 0.5) / size - 0.5
        const r = Math.hypot(dx, dy) * 2
        const outside = Math.max(0, r - CORONA_DISC) / (1 - CORONA_DISC)
        const fade = Math.pow(Math.max(0, 1 - outside), 3.2)
        // Faint streamers so the glow is not a perfect circle.
        const angle = Math.atan2(dy, dx)
        const streak = 1 + 0.1 * Math.sin(angle * 6 + 0.7) + 0.06 * Math.sin(angle * 13 + 2.1)
        const a = r < CORONA_DISC ? 1 : Math.min(1, fade * streak * (0.9 - 0.35 * outside))
        const i = (y * size + x) * 4
        img.data[i] = 255
        img.data[i + 1] = Math.round(200 + 40 * (1 - outside))
        img.data[i + 2] = Math.round(110 + 90 * Math.pow(1 - outside, 2))
        img.data[i + 3] = Math.round(255 * a * (r > 1 ? 0 : 1))
      }
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}
const CORONA_DISC = 0.34

function Sun({ position }: { position: THREE.Vector3 }) {
  const reduced = useReducedMotion()
  const corona = useCoronaTexture()
  const label = useTextTexture('Sun', '#f4c55a')
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { time: { value: 0 } }, toneMapped: false }),
    [],
  )
  const clock = useRef(0)
  useFrame((_, dt) => {
    if (reduced) return
    clock.current += Math.min(dt, 0.1)
    surface.uniforms.time.value = clock.current
  })
  const coronaSize = (2 * SUN_RADIUS) / CORONA_DISC
  return (
    <group position={position}>
      <mesh material={surface}>
        <sphereGeometry args={[SUN_RADIUS, 96, 48]} />
      </mesh>
      <sprite scale={[coronaSize, coronaSize, 1]}>
        <spriteMaterial map={corona} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} opacity={0.85} />
      </sprite>
      <sprite scale={[5.4, 1.8, 1]} center={[0.5, 0.5 + (SUN_RADIUS + 1.7) / 1.8]}>
        <spriteMaterial map={label} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  )
}

/** A short word as a texture, for labels that live in the 3D scene. */
function useTextTexture(text: string, color: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 384
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.font = '600 70px Archivo, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(text, 192, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text, color])
}

/** Sunlight for the Moon, plus the Sun and Earth themselves. */
export function Sky({ t }: { t: number }) {
  const { sun, earth } = getEphemeris().sunEarth(t)
  const sunDir = b2t(sun).normalize()
  const earthDir = b2t(earth).normalize()
  const spin = ((t % EARTH_TURN_MS) / EARTH_TURN_MS) * Math.PI * 2
  return (
    <>
      <ambientLight intensity={0.16} />
      <directionalLight position={sunDir.clone().multiplyScalar(60)} intensity={3.4} color="#fff6e6" />
      <Sun position={sunDir.clone().multiplyScalar(SUN_DISTANCE)} />
      <Earth position={earthDir.clone().multiplyScalar(EARTH_DISTANCE)} sunDir={sunDir} spin={spin} />
    </>
  )
}
