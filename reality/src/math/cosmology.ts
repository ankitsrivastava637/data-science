// Flat ΛCDM with Planck 2018 parameters (H0 = 67.4 km/s/Mpc, Ωm = 0.315; radiation included via
// T_CMB = 2.7255 K and three massless neutrino species; ΩΛ = 1 − Ωm − Ωr).
export const C_KMS = 299792.458;
export const MPC_M = 3.0856775814913673e22;
export const GYR_S = 3.15576e16;
export const LY_M = 9.4607304725808e15;
export const H0 = 67.4;
export const OM = 0.315;
const h = H0 / 100;
export const OR = 2.469e-5 / (h * h) * (1 + 0.2271 * 3.046); // photons + neutrinos
export const OL = 1 - OM - OR;

export const E = (z: number) => Math.sqrt(OM * (1 + z) ** 3 + OR * (1 + z) ** 4 + OL);
/** Hubble time 1/H0 in Gyr */
export const tH = () => (MPC_M / 1000 / H0) / GYR_S;
/** Hubble radius c/H0 in Mpc */
export const hubbleRadiusMpc = () => C_KMS / H0;

// integrate in ln(1+z) for accuracy out to high z
function integrate(f: (z: number) => number, z1: number, n = 20000) {
  const L = Math.log1p(z1);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = (L * i) / n, b = (L * (i + 1)) / n, m = 0.5 * (a + b);
    const z = Math.expm1(m);
    s += f(z) * (1 + z) * (b - a);
  }
  return s;
}
/** comoving distance to redshift z (Mpc) */
export const comovingMpc = (z: number) => hubbleRadiusMpc() * integrate((zz) => 1 / E(zz), z);
/** look-back time to redshift z (Gyr) */
export const lookbackGyr = (z: number) => tH() * integrate((zz) => 1 / ((1 + zz) * E(zz)), z);
/** age of the universe (Gyr) */
export const ageGyr = () => lookbackGyr(1e9);
/** particle horizon: comoving distance light has travelled since t = 0 (Mpc) */
export const particleHorizonMpc = () => comovingMpc(1e9);

/** redshift at which the look-back time equals t (Gyr), by bisection */
export function zAtLookback(t: number) {
  let a = 0, b = 2000;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (a + b); if (lookbackGyr(m) < t) a = m; else b = m; }
  return 0.5 * (a + b);
}

/** linear growth factor D(a) ∝ H(a) ∫ da'/(a' H(a'))³ (matter + Λ), normalised to 1 today */
export function growth(a: number) {
  const Ea = (x: number) => Math.sqrt(OM / x ** 3 + OL);
  const g = (x: number) => { let s = 0; const n = 2000; for (let i = 0; i < n; i++) { const u = ((i + 0.5) / n) * x; s += (x / n) / (u * Ea(u)) ** 3; } return 2.5 * OM * Ea(x) * s; };
  return g(a) / g(1);
}
