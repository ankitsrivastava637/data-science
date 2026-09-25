// Colour science helpers: an analytic multi-lobe Gaussian fit to the CIE 1931 2° colour-matching
// functions (Wyman, Sloan & Shirley 2013; not fetched in the build environment, standard fit),
// XYZ → linear sRGB, and sRGB transfer encoding.
function g(l: number, mu: number, s1: number, s2: number) { const t = (l - mu) / (l < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
export function cieXYZ(l: number): [number, number, number] {
  const x = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  return [x, y, z];
}
export function xyzToLinear([X, Y, Z]: [number, number, number]): [number, number, number] {
  return [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
}
export const encode = (c: number) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
/** display colour of a monochromatic line (gamut-mapped by adding white, normalised, sRGB-encoded) */
export function spectralSRGB(l: number): [number, number, number] {
  let [r, gg, b] = xyzToLinear(cieXYZ(l));
  const m = Math.min(r, gg, b);
  if (m < 0) { r -= m; gg -= m; b -= m; }
  const y = cieXYZ(l)[1];
  const mx = Math.max(r, gg, b, 1e-9);
  const k = Math.pow(Math.min(1, y * 1.2), 0.5) / mx; // brightness follows luminous efficiency, softly
  return [encode(r * k), encode(gg * k), encode(b * k)];
}
/** linear sRGB of a line spectrum [(λ, weight)] */
export function xyzOfLine(lines: [number, number][]): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (const [l, w] of lines) { const c = cieXYZ(l); X += w * c[0]; Y += w * c[1]; Z += w * c[2]; }
  return xyzToLinear([X, Y, Z]);
}
