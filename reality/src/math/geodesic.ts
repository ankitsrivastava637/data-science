// Schwarzschild geodesics (G = c = 1). With M the mass, r_s = 2M.
//   timelike:  u'' + u = M/L² + 3 M u²          (u = 1/r, ' = d/dφ)
//   null:      u'' + u = 3 M u²
// First integrals used by the tests:  (u')² = E²/L² − (1 − 2Mu)(1/L² + u²)  (timelike)
//                                     (u')² = 1/b² − u²(1 − 2Mu)              (null)

/** angular momentum² and energy² of the bound orbit with turning points r1 < r2 */
export function orbitConstants(r1: number, r2: number, M: number) {
  const f1 = 1 - (2 * M) / r1, f2 = 1 - (2 * M) / r2;
  const L2 = (f2 - f1) / (f1 / (r1 * r1) - f2 / (r2 * r2));
  const E2 = f2 * (1 + L2 / (r2 * r2));
  return { L2, E2 };
}

export function integrateTimelike(r1: number, r2: number, M: number, phiMax: number, dphi: number) {
  const { L2, E2 } = orbitConstants(r1, r2, M);
  const f = (u: number, v: number): [number, number] => [v, M / L2 - u + 3 * M * u * u];
  let u = 1 / r2, v = 0;
  const out: { phi: number; r: number; u: number; v: number }[] = [{ phi: 0, r: r2, u, v }];
  for (let phi = 0; phi < phiMax; phi += dphi) {
    const k1 = f(u, v), k2 = f(u + 0.5 * dphi * k1[0], v + 0.5 * dphi * k1[1]);
    const k3 = f(u + 0.5 * dphi * k2[0], v + 0.5 * dphi * k2[1]), k4 = f(u + dphi * k3[0], v + dphi * k3[1]);
    u += (dphi / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    v += (dphi / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    out.push({ phi: phi + dphi, r: 1 / u, u, v });
  }
  return { L2, E2, path: out };
}

/** residual of the timelike first integral: should stay ≈ 0 along an accurate integration */
export function timelikeResidual(u: number, v: number, M: number, L2: number, E2: number) {
  return v * v - (E2 / L2 - (1 - 2 * M * u) * (1 / L2 + u * u));
}

/** null geodesic from infinity with impact parameter b; returns the total deflection angle (rad) or null if captured */
export function deflection(b: number, M: number, dphi = 1e-3): number | null {
  const f = (u: number, v: number): [number, number] => [v, -u + 3 * M * u * u];
  let u = 1e-9, v = 1 / b, phi = 0;
  let maxU = 0;
  while (phi < 20) {
    const k1 = f(u, v), k2 = f(u + 0.5 * dphi * k1[0], v + 0.5 * dphi * k1[1]);
    const k3 = f(u + 0.5 * dphi * k2[0], v + 0.5 * dphi * k2[1]), k4 = f(u + dphi * k3[0], v + dphi * k3[1]);
    u += (dphi / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    v += (dphi / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    phi += dphi;
    if (u > maxU) maxU = u;
    if (u >= 1 / (2 * M)) return null; // captured
    if (u <= 0) return phi - Math.PI; // escaped: total sweep minus a straight line's π
  }
  return null;
}
