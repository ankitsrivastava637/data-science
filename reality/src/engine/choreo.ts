// Camera/parameter choreography: every animated value is a pure function of t.
import * as THREE from 'three';
import { EASES, type Ease, type EaseName } from './ease';

export type Key<V> = [t: number, v: V, ease?: EaseName | Ease];

function easeOf(e: EaseName | Ease | undefined): Ease {
  if (!e) return EASES.sineInOut;
  return typeof e === 'function' ? e : EASES[e];
}

/** Piecewise track of numbers; the ease on key i shapes the segment arriving at key i. */
export function track(keys: Key<number>[]): (t: number) => number {
  const ks = [...keys].sort((a, b) => a[0] - b[0]);
  return (t: number) => {
    if (t <= ks[0][0]) return ks[0][1];
    const n = ks.length - 1;
    if (t >= ks[n][0]) return ks[n][1];
    let i = 1;
    while (ks[i][0] < t) i++;
    const [t0, v0] = ks[i - 1];
    const [t1, v1, e] = ks[i];
    const u = easeOf(e)((t - t0) / (t1 - t0));
    return v0 + (v1 - v0) * u;
  };
}

/** Track in log space (for scales/zooms): interpolates log10 values, i.e. exponential zoom. */
export function logTrack(keys: Key<number>[]): (t: number) => number {
  const inner = track(keys.map(([t, v, e]) => [t, Math.log10(v), e] as Key<number>));
  return (t) => Math.pow(10, inner(t));
}

export type V3 = [number, number, number];
export function track3(keys: Key<V3>[]): (t: number, out?: THREE.Vector3) => THREE.Vector3 {
  const xs = track(keys.map(([t, v, e]) => [t, v[0], e] as Key<number>));
  const ys = track(keys.map(([t, v, e]) => [t, v[1], e] as Key<number>));
  const zs = track(keys.map(([t, v, e]) => [t, v[2], e] as Key<number>));
  return (t, out = new THREE.Vector3()) => out.set(xs(t), ys(t), zs(t));
}

/** Orbit rig: camera on a sphere around a target. All angles in radians, radius in scene units. */
export interface OrbitSpec {
  target: (t: number) => THREE.Vector3;
  radius: (t: number) => number;
  azimuth: (t: number) => number;
  elevation: (t: number) => number;
  fov?: (t: number) => number;
  roll?: (t: number) => number;
}

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

export function evalOrbit(spec: OrbitSpec, t: number, out?: CameraPose): CameraPose {
  const o = out ?? { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 40 };
  const tg = spec.target(t);
  const r = spec.radius(t), az = spec.azimuth(t), el = spec.elevation(t);
  o.target.copy(tg);
  o.position.set(tg.x + r * Math.cos(el) * Math.sin(az), tg.y + r * Math.sin(el), tg.z + r * Math.cos(el) * Math.cos(az));
  o.fov = spec.fov ? spec.fov(t) : 40;
  const roll = spec.roll ? spec.roll(t) : 0;
  o.up.set(Math.sin(roll), Math.cos(roll), 0);
  return o;
}

/** Registry so the Synthesis chapter can re-sample earlier camera paths. */
const rigs = new Map<string, (t: number) => CameraPose>();
export function registerRig(name: string, f: (t: number) => CameraPose) { rigs.set(name, f); }
export function getRig(name: string) { return rigs.get(name); }

/** Free-camera offsets applied on top of any rig (user controlled, never affects t). */
export const freeCam = {
  enabled: false,
  yaw: 0, pitch: 0, dolly: 0, // user deltas
  blend: 0, // 0 = pure choreography, 1 = full user offset (eased toward target each frame, UI only)
};

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
/** Apply free-camera offsets (orbit around pose.target). Pure given the offsets. */
export function applyFreeCam(pose: CameraPose): CameraPose {
  const b = freeCam.blend;
  if (b <= 0) return pose;
  _v.copy(pose.position).sub(pose.target);
  const r = _v.length();
  _q.setFromAxisAngle(pose.up, freeCam.yaw * b);
  _v.applyQuaternion(_q);
  _axis.crossVectors(pose.up, _v).normalize();
  const maxPitch = 1.3;
  _q.setFromAxisAngle(_axis, -Math.max(-maxPitch, Math.min(maxPitch, freeCam.pitch * b)));
  _v.applyQuaternion(_q);
  _v.setLength(r * Math.exp(-freeCam.dolly * b));
  pose.position.copy(pose.target).add(_v);
  return pose;
}

export function poseToCamera(p: CameraPose, cam: THREE.PerspectiveCamera) {
  cam.position.copy(p.position);
  cam.up.copy(p.up);
  cam.lookAt(p.target);
  if (cam.fov !== p.fov) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
}
