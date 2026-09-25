// One deterministic description of "the cell" shared by Chapter 1 (its image on the retina)
// and Chapter 2 (its 3D rendering), so the image the mosaic records is the cell we then enter.
// Units: µm. The cell lies in the xy plane (an adherent cell), thickness along z.
import { Rng } from '../engine/prng';

export interface Mito { x: number; y: number; z: number; ang: number; len: number; w: number; tilt: number }
export interface Fibre { pts: Float32Array } // polyline xyz
export interface CellModel {
  outline: (theta: number) => number; // membrane radius at angle
  thickness: (x: number, y: number) => number; // half-thickness at (x,y) — dome shaped
  nucleus: { x: number; y: number; z: number; a: number; b: number; c: number; ang: number };
  nucleoli: { x: number; y: number; z: number; r: number }[];
  centrosome: { x: number; y: number; z: number };
  mitos: Mito[];
  microtubules: Fibre[];
  /** zoom focus inside the nucleus (where Chapter 2 dives) */
  focus: { x: number; y: number; z: number };
}

export function makeCell(seed: number): CellModel {
  const rng = new Rng(seed, 202);
  const lobes = [
    { k: 2, a: 0.16, p: rng.range(0, 6.28) },
    { k: 3, a: 0.07, p: rng.range(0, 6.28) },
    { k: 5, a: 0.035, p: rng.range(0, 6.28) },
    { k: 7, a: 0.02, p: rng.range(0, 6.28) },
  ];
  const R = 12.5;
  const outline = (th: number) => {
    let r = 1;
    for (const l of lobes) r += l.a * Math.cos(l.k * th + l.p);
    return R * r;
  };
  const thickness = (x: number, y: number) => {
    const th = Math.atan2(y, x);
    const q = Math.hypot(x, y) / outline(th);
    return q >= 1 ? 0 : 3.2 * Math.sqrt(1 - q * q) * (0.35 + 0.65 * (1 - q * q));
  };
  const nucleus = { x: -1.2, y: 0.8, z: 0.4, a: 5.0, b: 3.9, c: 2.4, ang: 0.35 };
  const nucleoli = [
    { x: nucleus.x + 1.3, y: nucleus.y + 0.6, z: 0.5, r: 0.9 },
    { x: nucleus.x - 1.6, y: nucleus.y - 0.9, z: 0.3, r: 0.65 },
  ];
  const centrosome = { x: nucleus.x + 5.6, y: nucleus.y - 1.4, z: 0.3 };
  const inNucleus = (x: number, y: number) => {
    const c = Math.cos(-nucleus.ang), s = Math.sin(-nucleus.ang);
    const dx = x - nucleus.x, dy = y - nucleus.y;
    const u = (dx * c - dy * s) / (nucleus.a + 0.6), v = (dx * s + dy * c) / (nucleus.b + 0.6);
    return u * u + v * v < 1;
  };
  const mitos: Mito[] = [];
  let guard = 0;
  while (mitos.length < 70 && guard++ < 5000) {
    const th = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.range(0.04, 0.8)) * outline(th);
    const x = rr * Math.cos(th), y = rr * Math.sin(th);
    if (inNucleus(x, y)) continue;
    const h = thickness(x, y);
    if (h < 0.6) continue;
    // mitochondria tend to align with the radial microtubule tracks
    const radial = Math.atan2(y - centrosome.y, x - centrosome.x);
    mitos.push({ x, y, z: rng.range(-0.4, 0.4) * h, ang: radial + rng.normal() * 0.5, len: rng.range(1.0, 3.2), w: rng.range(0.38, 0.55), tilt: rng.normal() * 0.2 });
  }
  const microtubules: Fibre[] = [];
  // microtubules radiate from the centrosome; near the nucleus they slide along its envelope
  const nucDist = (x: number, y: number) => {
    const c = Math.cos(-nucleus.ang), s = Math.sin(-nucleus.ang);
    const dx = x - nucleus.x, dy = y - nucleus.y;
    const u = (dx * c - dy * s) / (nucleus.a + 0.5), v = (dx * s + dy * c) / (nucleus.b + 0.5);
    return Math.hypot(u, v);
  };
  for (let i = 0; i < 46; i++) {
    const th0 = (i / 46) * Math.PI * 2 + rng.normal() * 0.05;
    const pts: number[] = [];
    let x = centrosome.x, y = centrosome.y, z = centrosome.z, dir = th0;
    for (let k = 0; k < 120; k++) {
      pts.push(x, y, z);
      dir += rng.normal() * 0.05;
      let nx = x + Math.cos(dir) * 0.32, ny = y + Math.sin(dir) * 0.32;
      if (nucDist(nx, ny) < 1) {
        // replace the heading by the tangent to the envelope that keeps moving forward
        const rx = x - nucleus.x, ry = y - nucleus.y;
        const t1 = [-ry, rx], t2 = [ry, -rx];
        const fwd = [Math.cos(dir), Math.sin(dir)];
        const t = t1[0] * fwd[0] + t1[1] * fwd[1] > t2[0] * fwd[0] + t2[1] * fwd[1] ? t1 : t2;
        dir = Math.atan2(t[1], t[0]) + 0.08 * Math.sign(nucDist(x, y) - 1.05);
        nx = x + Math.cos(dir) * 0.32; ny = y + Math.sin(dir) * 0.32;
      }
      x = nx; y = ny;
      const th = Math.atan2(y, x);
      if (Math.hypot(x, y) > outline(th) * 0.96) break;
      const h = thickness(x, y);
      z = Math.max(-h * 0.6, Math.min(h * 0.6, z + rng.normal() * 0.04));
    }
    if (pts.length >= 12) microtubules.push({ pts: new Float32Array(pts) });
  }
  const focus = { x: nucleus.x + 0.6, y: nucleus.y - 0.4, z: nucleus.z + 0.2 };
  return { outline, thickness, nucleus, nucleoli, centrosome, mitos, microtubules, focus };
}

/** Fluorescence-style image of the cell (linear RGB emission), sampled at (x, y) µm. Used as
 *  photon rates for Chapter 1. Nucleus: DAPI-like blue; mitochondria: orange-red; microtubules: green. */
export function cellImage(cell: CellModel, x: number, y: number): [number, number, number] {
  let r = 0.004, g = 0.004, b = 0.006; // dark background
  const th = Math.atan2(y, x);
  const R = cell.outline(th);
  const q = Math.hypot(x, y) / R;
  if (q < 1.02) {
    const edge = Math.exp(-((q - 1) ** 2) / 0.0006);
    r += 0.03 + 0.04 * edge; g += 0.035 + 0.05 * edge; b += 0.04 + 0.05 * edge;
  }
  const n = cell.nucleus;
  const c = Math.cos(-n.ang), s = Math.sin(-n.ang);
  const dx = x - n.x, dy = y - n.y;
  const u = (dx * c - dy * s) / n.a, v = (dx * s + dy * c) / n.b;
  const d2 = u * u + v * v;
  if (d2 < 1.15) {
    const k = Math.max(0, Math.min(1, (1.08 - d2) / 0.16));
    const tex = 0.75 + 0.25 * Math.sin(x * 3.1 + Math.sin(y * 2.3)) * Math.cos(y * 2.7 - x * 0.7);
    r += 0.06 * k * tex; g += 0.16 * k * tex; b += 0.62 * k * tex;
    for (const nu of cell.nucleoli) {
      const e = Math.exp(-((x - nu.x) ** 2 + (y - nu.y) ** 2) / (nu.r * nu.r));
      r -= 0.03 * e; g -= 0.08 * e; b -= 0.3 * e;
    }
  }
  for (const m of cell.mitos) {
    const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
    const px = x - m.x, py = y - m.y;
    const along = px * ca + py * sa, across = -px * sa + py * ca;
    const hl = m.len / 2;
    const cl = Math.max(-hl, Math.min(hl, along));
    const dd = (along - cl) ** 2 + across ** 2;
    if (dd < 1) {
      const e = Math.exp(-dd / (m.w * m.w * 0.35));
      r += 0.75 * e; g += 0.26 * e; b += 0.03 * e;
    }
  }
  for (const f of cell.microtubules) {
    const p = f.pts;
    for (let i = 0; i + 5 < p.length; i += 6) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 3], by = p[i + 4];
      const ex = bx - ax, ey = by - ay;
      const l2 = ex * ex + ey * ey;
      const tt = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
      const qx = ax + ex * tt - x, qy = ay + ey * tt - y;
      const dd = qx * qx + qy * qy;
      if (dd < 0.2) { const e = Math.exp(-dd / 0.012); r += 0.05 * e; g += 0.22 * e; b += 0.06 * e; }
    }
  }
  return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
}
