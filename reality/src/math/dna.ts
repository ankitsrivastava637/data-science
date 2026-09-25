// Schematic B-DNA atomic model (Å). Helix axis = +x. Rise 3.38 Å, twist 360°/10.5 per bp,
// phosphates at r ≈ 8.9 Å, glycosidic bonds on the minor-groove side. Base geometry: ideal
// 1.39 Å rings with Watson–Crick H-bond partners ~2.9–3.0 Å apart (G–C: 3 bonds, A–T: 2).
// Positions are schematic (not crystallographic), as stated on screen.
import { Rng } from '../engine/prng';

export type Elem = 'C' | 'N' | 'O' | 'P' | 'H';
export interface Atom { x: number; y: number; z: number; e: Elem; bp: number; strand: 0 | 1; name: string }
export interface DNAModel { atoms: Atom[]; bonds: [number, number][]; hbonds: [number, number][]; seq: string; focusH1: number; focusN1: number; focusPair: number[] }

export const RISE = 3.38;
export const TWIST = (2 * Math.PI) / 10.5;

type P2 = [number, number];
// Both bases are rotated 12° about their central H-bond atom (N1 of the purine, N3 of the
// pyrimidine); a common rotation preserves all Watson–Crick H-bond distances and brings the two
// C1' atoms to near dyad symmetry, as in real pairs. The dyad line and shift are computed below.
const ROT = (12 * Math.PI) / 180;
function rotAbout(atoms: { p: P2 }[], c: P2) {
  const cs = Math.cos(ROT), sn = Math.sin(ROT);
  for (const a of atoms) { const x = a.p[0] - c[0], y = a.p[1] - c[1]; a.p = [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; }
}
let Y_DYAD = 0;
let SHIFT: P2 = [0, 0];
function hex(c: P2, s: number, startDeg: number): P2[] {
  const out: P2[] = [];
  for (let k = 0; k < 6; k++) { const a = ((startDeg - 60 * k) * Math.PI) / 180; out.push([c[0] + s * Math.cos(a), c[1] + s * Math.sin(a)]); }
  return out;
}
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const norm = (a: P2): P2 => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
const out = (atom: P2, center: P2, len: number): P2 => add(atom, norm(sub(atom, center)), len);

interface Tmpl { atoms: { n: string; e: Elem; p: P2 }[]; bonds: [string, string][]; c1: string }

/** purine on the +Y side (strand I) or mirrored to −Y (strand II) */
function purine(kind: 'G' | 'A'): Tmpl {
  const s = 1.39;
  const c: P2 = [0.3, 2.85];
  // hex vertices: N1 (bottom, toward partner), C6, C5, C4 (top), N3, C2
  const [N1, C2, N3, C4, C5, C6] = [270, 210, 150, 90, 30, 330].map((d) => [c[0] + s * Math.cos((d * Math.PI) / 180), c[1] + s * Math.sin((d * Math.PI) / 180)] as P2);
  const mid: P2 = [(C4[0] + C5[0]) / 2, (C4[1] + C5[1]) / 2];
  const n = norm(sub(mid, c));
  const e = norm(sub(C5, C4));
  const N9 = add(add(mid, n, 1.32 * s / 1.39), e, -1.125 * s / 1.39);
  const N7 = add(add(mid, n, 1.32 * s / 1.39), e, 1.125 * s / 1.39);
  const C8 = add(mid, n, 2.14 * s / 1.39);
  const pc = add(mid, n, 0.957);
  const C1 = out(N9, pc, 1.47);
  const atoms: { n: string; e: Elem; p: P2 }[] = [
    { n: 'N1', e: 'N', p: N1 }, { n: 'C2', e: 'C', p: C2 }, { n: 'N3', e: 'N', p: N3 }, { n: 'C4', e: 'C', p: C4 },
    { n: 'C5', e: 'C', p: C5 }, { n: 'C6', e: 'C', p: C6 }, { n: 'N7', e: 'N', p: N7 }, { n: 'C8', e: 'C', p: C8 }, { n: 'N9', e: 'N', p: N9 },
    { n: "C1'", e: 'C', p: C1 }, { n: 'H8', e: 'H', p: out(C8, pc, 1.0) },
  ];
  const bonds: [string, string][] = [['N1', 'C2'], ['C2', 'N3'], ['N3', 'C4'], ['C4', 'C5'], ['C5', 'C6'], ['C6', 'N1'], ['C5', 'N7'], ['N7', 'C8'], ['C8', 'N9'], ['N9', 'C4'], ['N9', "C1'"], ['C8', 'H8']];
  if (kind === 'G') {
    const O6 = out(C6, c, 1.23), N2 = out(C2, c, 1.34);
    atoms.push({ n: 'O6', e: 'O', p: O6 }, { n: 'N2', e: 'N', p: N2 }, { n: 'H1', e: 'H', p: [N1[0], N1[1] - 1.01] },
      { n: 'H21', e: 'H', p: [N2[0], N2[1] - 1.01] }, { n: 'H22', e: 'H', p: add(N2, norm([-0.86, 0.5]), 1.01) });
    bonds.push(['C6', 'O6'], ['C2', 'N2'], ['N1', 'H1'], ['N2', 'H21'], ['N2', 'H22']);
  } else {
    const N6 = out(C6, c, 1.34);
    atoms.push({ n: 'N6', e: 'N', p: N6 }, { n: 'H2', e: 'H', p: out(C2, c, 1.0) }, { n: 'H61', e: 'H', p: [N6[0], N6[1] - 1.01] }, { n: 'H62', e: 'H', p: add(N6, norm([0.86, 0.5]), 1.01) });
    bonds.push(['C6', 'N6'], ['C2', 'H2'], ['N6', 'H61'], ['N6', 'H62']);
  }
  rotAbout(atoms, N1);
  return { atoms, bonds, c1: "C1'" };
}

function pyrimidine(kind: 'C' | 'T'): Tmpl {
  const s = 1.39;
  const c: P2 = [0.3, -2.85];
  // vertices: N3 (top, toward partner), C4, C5, C6 (bottom), N1, C2
  const [N3, C4, C5, C6, N1, C2] = [90, 30, 330, 270, 210, 150].map((d) => [c[0] + s * Math.cos((d * Math.PI) / 180), c[1] + s * Math.sin((d * Math.PI) / 180)] as P2);
  const C1 = out(N1, c, 1.47);
  const O2 = out(C2, c, 1.24);
  const atoms: { n: string; e: Elem; p: P2 }[] = [
    { n: 'N1', e: 'N', p: N1 }, { n: 'C2', e: 'C', p: C2 }, { n: 'N3', e: 'N', p: N3 }, { n: 'C4', e: 'C', p: C4 }, { n: 'C5', e: 'C', p: C5 }, { n: 'C6', e: 'C', p: C6 },
    { n: 'O2', e: 'O', p: O2 }, { n: "C1'", e: 'C', p: C1 }, { n: 'H6', e: 'H', p: out(C6, c, 1.0) },
  ];
  const bonds: [string, string][] = [['N1', 'C2'], ['C2', 'N3'], ['N3', 'C4'], ['C4', 'C5'], ['C5', 'C6'], ['C6', 'N1'], ['C2', 'O2'], ['N1', "C1'"], ['C6', 'H6']];
  if (kind === 'C') {
    const N4 = out(C4, c, 1.33);
    atoms.push({ n: 'N4', e: 'N', p: N4 }, { n: 'H41', e: 'H', p: [N4[0], N4[1] + 1.01] }, { n: 'H42', e: 'H', p: add(N4, norm([0.86, -0.5]), 1.01) }, { n: 'H5', e: 'H', p: out(C5, c, 1.0) });
    bonds.push(['C4', 'N4'], ['N4', 'H41'], ['N4', 'H42'], ['C5', 'H5']);
  } else {
    const O4 = out(C4, c, 1.23), C7 = out(C5, c, 1.5);
    atoms.push({ n: 'O4', e: 'O', p: O4 }, { n: 'C7', e: 'C', p: C7 }, { n: 'H3', e: 'H', p: [N3[0], N3[1] + 1.01] });
    bonds.push(['C4', 'O4'], ['C5', 'C7'], ['N3', 'H3']);
  }
  rotAbout(atoms, N3);
  return { atoms, bonds, c1: "C1'" };
}

/** templates: purines authored on +Y, pyrimidines on −Y (H-bond midline at Y = 0). Mirror in the
 *  base-pair plane (the dyad maps (X,Y) → (X,−Y)) when the base belongs on the other side, then shift. */
function orient(t: Tmpl, natPlus: boolean, wantPlus: boolean): Tmpl {
  for (const a of t.atoms) {
    let [x, y] = a.p;
    if (natPlus !== wantPlus) y = 2 * Y_DYAD - y;
    a.p = [x + SHIFT[0], y + SHIFT[1]];
  }
  return t;
}

{
  const g = purine('G').atoms.find((a) => a.n === "C1'")!.p, c = pyrimidine('C').atoms.find((a) => a.n === "C1'")!.p;
  Y_DYAD = (g[1] + c[1]) / 2;
  // put the dyad on Y = 0 and the H-bonded centre of the pair on the helix axis
  SHIFT = [-0.3, -Y_DYAD];
}

export function makeBDNA(nbp: number, seed: number): DNAModel {
  const rng = new Rng(seed, 707);
  const center = Math.floor(nbp / 2);
  let seq = '';
  for (let i = 0; i < nbp; i++) seq += i === center ? 'G' : rng.pick(['G', 'C', 'A', 'T', 'A', 'T']);
  const atoms: Atom[] = [];
  const bonds: [number, number][] = [];
  const hbonds: [number, number][] = [];
  const c1Index: number[][] = [];
  const place = (p: P2, i: number): [number, number, number] => {
    const th = (i - center) * TWIST;
    const x = (i - center) * RISE;
    // template X → "major" direction, Y → long axis; rotate in the (y,z) plane
    const ex: P2 = [Math.cos(th), Math.sin(th)], ey: P2 = [-Math.sin(th), Math.cos(th)];
    return [x, p[0] * ex[0] + p[1] * ey[0], p[0] * ex[1] + p[1] * ey[1]];
  };
  let focusH1 = -1, focusN1 = -1;
  const focusPair: number[] = [];
  for (let i = 0; i < nbp; i++) {
    const b = seq[i];
    const pair = b === 'G' ? 'C' : b === 'C' ? 'G' : b === 'A' ? 'T' : 'A';
    const pur1 = b === 'G' || b === 'A', pur2 = pair === 'G' || pair === 'A';
    const t1 = orient(pur1 ? purine(b as 'G' | 'A') : pyrimidine(b as 'C' | 'T'), pur1, true);   // strand I on +Y
    const t2 = orient(pur2 ? purine(pair as 'G' | 'A') : pyrimidine(pair as 'C' | 'T'), pur2, false); // strand II on −Y
    const idx: Record<string, number>[] = [{}, {}];
    [t1, t2].forEach((t, s) => {
      for (const a of t.atoms) {
        const [x, y, z] = place(a.p, i);
        idx[s][a.n] = atoms.length;
        atoms.push({ x, y, z, e: a.e, bp: i, strand: s as 0 | 1, name: a.n });
        if (i === center) focusPair.push(atoms.length - 1);
      }
      for (const [u, v] of t.bonds) bonds.push([idx[s][u], idx[s][v]]);
    });
    c1Index.push([idx[0]["C1'"], idx[1]["C1'"]]);
    // Watson–Crick hydrogen bonds (donor H … acceptor)
    const gc = (g: Record<string, number>, c: Record<string, number>) => { hbonds.push([g.H1, c.N3], [g.H21, c.O2], [c.H41, g.O6]); };
    const at = (a: Record<string, number>, t: Record<string, number>) => { hbonds.push([a.H61, t.O4], [t.H3, a.N1]); };
    if (b === 'G') gc(idx[0], idx[1]); else if (b === 'C') gc(idx[1], idx[0]); else if (b === 'A') at(idx[0], idx[1]); else at(idx[1], idx[0]);
    if (i === center) { focusH1 = idx[0].H1; focusN1 = idx[0].N1; }
  }
  // sugar–phosphate backbones: a regular furanose pentagon on each C1', then C5'/O5'/O3', with each
  // phosphate between O3' of one nucleotide and O5' of the next (5'→3': strand I +x, strand II −x)
  type V3 = [number, number, number];
  const vadd = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const vn = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const push = (pos: V3, e: Elem, name: string, i: number, s: number) => { atoms.push({ x: pos[0], y: pos[1], z: pos[2], e, bp: i, strand: s as 0 | 1, name }); return atoms.length - 1; };
  for (let s = 0; s < 2; s++) {
    let prevC3 = -1;
    for (let k = 0; k < nbp; k++) {
      const i = s === 0 ? k : nbp - 1 - k;
      const c1i = c1Index[i][s];
      const C1 = atoms[c1i];
      const c1: V3 = [C1.x, C1.y, C1.z];
      const rh = vn([0, C1.y, C1.z]);
      const xs: V3 = [s === 0 ? 1 : -1, 0, 0];
      const al = (-35 * Math.PI) / 180;
      const R5 = 1.276;
      const dirc = vn(vadd([rh[0] * Math.cos(al), rh[1] * Math.cos(al), rh[2] * Math.cos(al)], xs, Math.sin(al)));
      const cen = vadd(c1, dirc, R5);
      // in-plane basis (u toward C1', w perpendicular in the r̂–x̂ plane)
      const u: V3 = [-dirc[0], -dirc[1], -dirc[2]];
      const w = vn(vadd(xs, u, -(xs[0] * u[0] + xs[1] * u[1] + xs[2] * u[2])));
      const vert = (deg: number): V3 => { const a = (deg * Math.PI) / 180; return vadd(vadd(cen, u, R5 * Math.cos(a)), w, R5 * Math.sin(a)); };
      const iO4 = push(vert(-72), 'O', "O4'", i, s);
      const iC4 = push(vert(-144), 'C', "C4'", i, s);
      const iC3 = push(vert(144), 'C', "C3'", i, s);
      const iC2 = push(vert(72), 'C', "C2'", i, s);
      const C4: V3 = [atoms[iC4].x, atoms[iC4].y, atoms[iC4].z];
      const C3: V3 = [atoms[iC3].x, atoms[iC3].y, atoms[iC3].z];
      const iC5 = push(vadd(C4, vn(vadd(rh, xs, -0.8)), 1.5), 'C', "C5'", i, s);
      const C5: V3 = [atoms[iC5].x, atoms[iC5].y, atoms[iC5].z];
      bonds.push([c1i, iO4], [iO4, iC4], [iC4, iC3], [iC3, iC2], [iC2, c1i], [iC4, iC5]);
      // phosphodiester link from the previous nucleotide's C3' to this C5'
      let iP: number, iOP1: number, iOP2: number, iO5: number, linkO3 = -1;
      if (prevC3 >= 0) {
        const q = atoms[prevC3];
        const A: V3 = [q.x, q.y, q.z];
        const v = vn([C5[0] - A[0], C5[1] - A[1], C5[2] - A[2]]);
        const out = vn([0, (A[1] + C5[1]) / 2, (A[2] + C5[2]) / 2]);
        const O3p = vadd(vadd(A, v, 1.2), out, 0.45);
        const O5p = vadd(vadd(C5, v, -1.2), out, 0.45);
        linkO3 = push(O3p, 'O', "O3'", q.bp, s);
        bonds.push([prevC3, linkO3]);
        const Pp = vadd([(O3p[0] + O5p[0]) / 2, (O3p[1] + O5p[1]) / 2, (O3p[2] + O5p[2]) / 2], out, 0.6);
        iP = push(Pp, 'P', 'P', i, s);
        iO5 = push(O5p, 'O', "O5'", i, s);
        const tg = vn([0, -out[2], out[1]]);
        iOP1 = push(vadd(Pp, vn(vadd(out, xs, 0.4)), 1.49), 'O', 'OP1', i, s);
        iOP2 = push(vadd(Pp, vn(vadd(vadd(out, tg, 0.9), xs, -0.4)), 1.49), 'O', 'OP2', i, s);
        bonds.push([linkO3, iP], [iP, iO5], [iP, iOP1], [iP, iOP2], [iO5, iC5]);
      } else {
        iO5 = push(vadd(C5, vn(vadd(rh, xs, -0.9)), 1.43), 'O', "O5'", i, s);
        const Pp = vadd([atoms[iO5].x, atoms[iO5].y, atoms[iO5].z], vn(vadd(rh, xs, -1)), 1.6);
        iP = push(Pp, 'P', 'P', i, s);
        iOP1 = push(vadd(Pp, vn(vadd(rh, xs, 0.35)), 1.49), 'O', 'OP1', i, s);
        const tg = vn([0, -rh[2], rh[1]]);
        iOP2 = push(vadd(Pp, vn(vadd(vadd(rh, tg, 0.9), xs, -0.3)), 1.49), 'O', 'OP2', i, s);
        bonds.push([iP, iO5], [iP, iOP1], [iP, iOP2], [iO5, iC5]);
      }
      const iO3 = -1;
      prevC3 = iC3;
      if (i === center) focusPair.push(iP, iOP1, iOP2, iO5, iC5, iC4, iC3, iO4, iC2);
    }
  }
  return { atoms, bonds, hbonds, seq, focusH1, focusN1, focusPair };
}

/** Electron density on an N³ grid (box centred at `c`, half-size `h`, Å) from a simple
 *  LCAO-style model: Σ φ_A² + κ Σ_bonds 2 φ_A φ_B with φ = exp(−ζ r). The cross term is the
 *  bonding build-up between nuclei. Approximate, labelled as such on screen. */
export function densityGrid(m: DNAModel, c: [number, number, number], h: number, N: number): Float32Array {
  const zeta: Record<Elem, number> = { H: 1.25, C: 1.6, N: 1.75, O: 1.9, P: 1.4 };
  const amp: Record<Elem, number> = { H: 1, C: 2.0, N: 2.3, O: 2.6, P: 2.2 };
  const near = m.atoms.map((a, i) => ({ a, i })).filter(({ a }) => Math.abs(a.x - c[0]) < h + 4 && Math.abs(a.y - c[1]) < h + 4 && Math.abs(a.z - c[2]) < h + 4);
  const set = new Set(near.map((n) => n.i));
  const bonds = m.bonds.filter(([u, v]) => set.has(u) && set.has(v));
  const out = new Float32Array(N * N * N);
  const A0 = 0.529177;
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = c[0] + ((i + 0.5) / N * 2 - 1) * h, y = c[1] + ((j + 0.5) / N * 2 - 1) * h, z = c[2] + ((k + 0.5) / N * 2 - 1) * h;
    const phi = new Map<number, number>();
    let rho = 0;
    for (const { a, i: ai } of near) {
      const r = Math.hypot(x - a.x, y - a.y, z - a.z) / A0;
      const f = Math.sqrt(amp[a.e]) * Math.exp(-zeta[a.e] * r);
      phi.set(ai, f);
      rho += f * f;
    }
    for (const [u, v] of bonds) rho += 0.9 * 2 * (phi.get(u) ?? 0) * (phi.get(v) ?? 0);
    out[(k * N + j) * N + i] = rho;
  }
  let mx = 0;
  for (let q = 0; q < out.length; q++) if (out[q] > mx) mx = out[q];
  for (let q = 0; q < out.length; q++) out[q] /= mx;
  return out;
}
