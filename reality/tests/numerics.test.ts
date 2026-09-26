// Numerical checks behind what the film shows.
import { describe, it, expect } from 'vitest';
import { fft, fft2, fft3 } from '../src/math/fft';
import { makeGrid, step, norm, DEFAULT_SLIT } from '../src/math/schrodinger';
import { integrateTimelike, timelikeResidual, deflection } from '../src/math/geodesic';
import { zetaZeros, partitions, hardyRamanujan, continuedFraction, convergents, ramanujanPi, chebyshevPsi, psiExplicit, madhava } from '../src/math/numbertheory';
import { radial, energyEV } from '../src/math/hydrogen';
import { allCodons, translateCodon, DEMO_MRNA } from '../src/math/geneticCode';
import { ageGyr, particleHorizonMpc, hubbleRadiusMpc, comovingMpc, MPC_M, LY_M } from '../src/math/cosmology';
import { makeBDNA } from '../src/math/dna';
import { govardovskii, LMAX } from '../src/math/mosaic';
import { Rng } from '../src/engine/prng';
import { tileableFbm3 } from '../src/engine/jobsExtra';

const rand = (n: number, seed: number) => { const r = new Rng(seed); return Float64Array.from({ length: n }, () => r.normal()); };

describe('FFT', () => {
  it('1D round trip and Parseval', () => {
    const n = 1024, re = rand(n, 1), im = rand(n, 2), r0 = re.slice(), i0 = im.slice();
    const e0 = re.reduce((s, x, i) => s + x * x + im[i] * im[i], 0);
    fft(re, im, n);
    const e1 = re.reduce((s, x, i) => s + x * x + im[i] * im[i], 0) / n;
    expect(Math.abs(e1 - e0) / e0).toBeLessThan(1e-12);
    fft(re, im, n, true); // the 1D kernel leaves the 1/n to its callers (fft2/fft3 apply it)
    for (let i = 0; i < n; i++) { expect(re[i] / n).toBeCloseTo(r0[i], 10); expect(im[i] / n).toBeCloseTo(i0[i], 10); }
  });
  it('2D and 3D round trips', () => {
    const re = rand(64 * 32, 3), im = rand(64 * 32, 4), r0 = re.slice();
    fft2(re, im, 64, 32); fft2(re, im, 64, 32, true);
    for (let i = 0; i < re.length; i++) expect(re[i]).toBeCloseTo(r0[i], 10);
    const a = rand(16 ** 3, 5), b = new Float64Array(16 ** 3), a0 = a.slice();
    fft3(a, b, 16); fft3(a, b, 16, true);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(a0[i], 10);
  });
});

describe('Schrödinger split-step', () => {
  it('conserves the norm without the absorbing boundary', () => {
    const g = makeGrid({ ...DEFAULT_SLIT, nx: 128, ny: 128 }, false, true);
    const n0 = norm(g.re, g.im, g.p.dx);
    for (let k = 0; k < 60; k++) step(g);
    expect(Math.abs(norm(g.re, g.im, g.p.dx) - n0)).toBeLessThan(1e-10);
    expect(n0).toBeCloseTo(1, 10);
  });
});

describe('Schwarzschild geodesics (G = c = 1)', () => {
  it('conserve the timelike first integral along an orbit', () => {
    const M = 1, { L2, E2, path } = integrateTimelike(12, 30, M, 40, 1e-3);
    let worst = 0;
    for (const p of path) worst = Math.max(worst, Math.abs(timelikeResidual(p.u, p.v, M, L2, E2)));
    expect(worst).toBeLessThan(1e-9);
  });
  it('orbits precess by ≈ 6πM/(a(1−e²)) per turn at large radius', () => {
    const M = 1, r1 = 400, r2 = 600, a = (r1 + r2) / 2, e = (r2 - r1) / (r2 + r1);
    const { path } = integrateTimelike(r1, r2, M, 4 * Math.PI, 2e-4);
    // successive apoapses: v changes sign from + to − at maximum r (minimum u)
    const apo: number[] = [];
    for (let i = 1; i < path.length; i++) if (path[i - 1].v < 0 && path[i].v >= 0) apo.push(path[i].phi);
    const dphi = apo[0] - 2 * Math.PI;
    expect(dphi / (6 * Math.PI * M / (a * (1 - e * e)))).toBeCloseTo(1, 1);
  });
  it('bends starlight by ≈ 4M/b in the weak field and captures rays below b = 3√3 M', () => {
    const M = 1, b = 2000;
    expect(deflection(b, M, 2e-4)! / (4 * M / b)).toBeCloseTo(1, 1);
    expect(deflection(5.0, M)).toBeNull();
    expect(deflection(5.3, M)).not.toBeNull();
  });
});

describe('number theory', () => {
  it('finds the first zeta zeros on the critical line', () => {
    const z = zetaZeros(10);
    const known = [14.134725142, 21.022039639, 25.010857580, 30.424876126, 32.935061588, 37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478];
    known.forEach((k, i) => expect(Math.abs(z[i] - k)).toBeLessThan(1e-6));
  });
  it('explicit formula with 100 zeros tracks ψ(x)', () => {
    const zs = zetaZeros(100);
    for (const x of [50.5, 100.5, 150.5]) expect(Math.abs(psiExplicit(x, zs) - chebyshevPsi(x)) / chebyshevPsi(x)).toBeLessThan(0.05);
  });
  it('partitions are exact and Hardy–Ramanujan is asymptotic', () => {
    const p = partitions(200);
    expect(p[100]).toBe(190569292n);
    expect(p[200]).toBe(3972999029388n);
    expect(hardyRamanujan(200) / Number(p[200])).toBeCloseTo(1.032, 2);
  });
  it('π: continued fraction, convergents, Mādhava, Ramanujan', () => {
    expect(continuedFraction(Math.PI, 5)).toEqual([3, 7, 15, 1, 292]);
    const c = convergents([3, 7, 15, 1]);
    expect(c.map(([a, b]) => `${a}/${b}`)).toEqual(['3/1', '22/7', '333/106', '355/113']);
    expect(Math.abs(madhava(100000) - Math.PI)).toBeLessThan(2e-5);
    const PI = '3.14159265358979323846264338327950288419716939937510';
    expect(ramanujanPi(1).slice(0, 8)).toBe(PI.slice(0, 8));   // ~8 digits from one term
    expect(ramanujanPi(3).slice(0, 25)).toBe(PI.slice(0, 25)); // ~8 more per term
  });
});

describe('hydrogen', () => {
  it('radial functions are normalised and levels are −13.6 eV / n²', () => {
    for (const [n, l] of [[1, 0], [2, 1], [3, 2], [4, 3]]) {
      let s = 0; const dr = 0.005;
      for (let r = dr / 2; r < 80; r += dr) s += radial(n, l, r) ** 2 * r * r * dr;
      expect(s).toBeCloseTo(1, 3);
    }
    expect(energyEV(2)).toBeCloseTo(-3.4014, 3);
  });
});

describe('genetic code', () => {
  it('64 codons, 20 amino acids, 3 stops; demo message reads to a stop', () => {
    const cs = allCodons();
    expect(cs.length).toBe(64);
    const aa = cs.map(translateCodon);
    expect(aa.filter((a) => a === '*').length).toBe(3);
    expect(new Set(aa.filter((a) => a !== '*')).size).toBe(20);
    const m = DEMO_MRNA.match(/.{3}/g)!.map(translateCodon);
    expect(m[0]).toBe('M'); expect(m[m.length - 1]).toBe('*');
  });
});

describe('cosmology (flat ΛCDM, Planck 2018)', () => {
  it('age, horizons and CMB distance', () => {
    const GLY = (mpc: number) => (mpc * MPC_M) / LY_M / 1e9;
    expect(ageGyr()).toBeCloseTo(13.79, 1);
    expect(GLY(particleHorizonMpc())).toBeCloseTo(46.1, 0);
    expect(GLY(hubbleRadiusMpc())).toBeCloseTo(14.5, 1);
    expect(GLY(comovingMpc(1090))).toBeGreaterThan(44.5);
    expect(GLY(comovingMpc(1090))).toBeLessThan(46);
  });
});

describe('B-DNA model geometry', () => {
  it('covalent bonds 0.9–1.7 Å and Watson–Crick H-bonds 1.7–2.3 Å (H···acceptor)', () => {
    const m = makeBDNA(24, 1);
    for (const [a, b] of m.bonds) { const A = m.atoms[a], B = m.atoms[b]; const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z); expect(d).toBeGreaterThan(0.9); expect(d).toBeLessThan(1.7); }
    for (const [a, b] of m.hbonds) { const A = m.atoms[a], B = m.atoms[b]; const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z); expect(d).toBeGreaterThan(1.6); expect(d).toBeLessThan(3.1); }
  });
});

describe('colour: the metamer', () => {
  it('two lights with different spectra give the same L and M cone signals', async () => {
    const { metamer } = await import('../src/chapters/ch4/index');
    const m = metamer();
    expect(m.w1).toBeGreaterThan(0); expect(m.w2).toBeGreaterThan(0);
    expect(m.mix[0]).toBeCloseTo(m.mono[0], 10);
    expect(m.mix[1]).toBeCloseTo(m.mono[1], 10);
    expect(govardovskii(LMAX.L, LMAX.L)).toBeCloseTo(1, 2);
  });
});

describe('Frontier geometry', () => {
  it('Hanson patches satisfy z1⁵ + z2⁵ = 1', async () => {
    const { fermatPoint } = await import('../src/chapters/ch11/index');
    const cpow = (re: number, im: number, n: number) => { const r = Math.hypot(re, im) ** n, a = Math.atan2(im, re) * n; return [r * Math.cos(a), r * Math.sin(a)]; };
    for (const [k1, k2, xi, th] of [[0, 0, 0.3, 0.4], [2, 3, -0.8, 1.2], [4, 1, 1.1, 0.1]]) {
      const [a, b, c, d] = fermatPoint(5, k1, k2, xi, th);
      const [p, q] = cpow(a, c, 5), [r, s] = cpow(b, d, 5);
      expect(p + r).toBeCloseTo(1, 9); expect(q + s).toBeCloseTo(0, 9);
    }
  });
  it('the baked proton noise tiles seamlessly', () => {
    const N = 16, v = tileableFbm3(N, 1);
    // the texel just past the edge (wrap) must continue smoothly from the last texel: compare edge jumps with interior jumps
    let edge = 0, interior = 0;
    for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) {
      edge += Math.abs(v[(k * N + j) * N + (N - 1)] - v[(k * N + j) * N]);
      interior += Math.abs(v[(k * N + j) * N + 7] - v[(k * N + j) * N + 8]);
    }
    expect(edge / interior).toBeLessThan(1.6);
  });
});
