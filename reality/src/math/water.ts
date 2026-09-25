// Water normal modes in a harmonic picture. Frequencies are the measured gas-phase fundamentals
// (ν1 = 3657, ν2 = 1595, ν3 = 3756 cm⁻¹); mode shapes are the textbook symmetric stretch, bend and
// antisymmetric stretch with the O atom recoiling so that the centre of mass stays fixed.
export const NU = { bend: 1595, sym: 3657, asym: 3756 } as const; // cm⁻¹
export const R_OH = 0.9572; // Å
export const ANGLE = (104.52 * Math.PI) / 180;
const MH = 1.008, MO = 15.999;

export type V2 = [number, number];
export function equilibrium(): { O: V2; H1: V2; H2: V2 } {
  const h = ANGLE / 2;
  return { O: [0, 0], H1: [R_OH * Math.sin(h), -R_OH * Math.cos(h)], H2: [-R_OH * Math.sin(h), -R_OH * Math.cos(h)] };
}

/** unit displacement patterns (H1, H2, O) for each mode, momentum-balanced */
export function modeVectors() {
  const e = equilibrium();
  const u1: V2 = [e.H1[0] / R_OH, e.H1[1] / R_OH], u2: V2 = [e.H2[0] / R_OH, e.H2[1] / R_OH];
  const perp = (v: V2): V2 => [-v[1], v[0]];
  const mk = (h1: V2, h2: V2) => {
    const O: V2 = [-(MH / MO) * (h1[0] + h2[0]), -(MH / MO) * (h1[1] + h2[1])];
    return { H1: h1, H2: h2, O };
  };
  return {
    sym: mk(u1, u2),
    asym: mk(u1, [-u2[0], -u2[1]]),
    bend: mk(perp(u1), [-perp(u2)[0], -perp(u2)[1]]),
  };
}

const C_CM = 2.99792458e10; // cm/s
/** physical frequency (Hz) of a wavenumber (cm⁻¹) */
export const hz = (nu: number) => nu * C_CM;

export interface WaterMotion { amp: Record<'sym' | 'asym' | 'bend', number>; phase: Record<'sym' | 'asym' | 'bend', number>; slow: number }
/** display-time slow-down so that the bend oscillates at `bendHz` displayed Hz */
export function makeMotion(bendHz = 0.8): WaterMotion {
  return { amp: { sym: 0.055, asym: 0.05, bend: 0.075 }, phase: { sym: 0.4, asym: 2.1, bend: 1.2 }, slow: bendHz / hz(NU.bend) };
}

/** signal: x-displacement of H1 at displayed time t (Å) */
export function signal(m: WaterMotion, t: number) {
  const v = modeVectors();
  let s = 0;
  for (const k of ['sym', 'asym', 'bend'] as const) s += m.amp[k] * v[k].H1[0] * Math.cos(2 * Math.PI * hz(NU[k]) * m.slow * t + m.phase[k]);
  return s;
}

export function positions(m: WaterMotion, t: number) {
  const e = equilibrium(), v = modeVectors();
  const out = { O: [...e.O] as V2, H1: [...e.H1] as V2, H2: [...e.H2] as V2 };
  for (const k of ['sym', 'asym', 'bend'] as const) {
    const c = m.amp[k] * Math.cos(2 * Math.PI * hz(NU[k]) * m.slow * t + m.phase[k]);
    for (const a of ['O', 'H1', 'H2'] as const) { out[a][0] += c * v[k][a][0]; out[a][1] += c * v[k][a][1]; }
  }
  return out;
}
