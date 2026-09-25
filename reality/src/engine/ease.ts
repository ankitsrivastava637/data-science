// Easing functions on [0,1].
export type Ease = (x: number) => number;
const c = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const linear: Ease = (x) => c(x);
export const hold: Ease = () => 0;
export const smooth: Ease = (x) => { x = c(x); return x * x * (3 - 2 * x); };
export const smoother: Ease = (x) => { x = c(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const sineInOut: Ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * c(x));
export const sineIn: Ease = (x) => 1 - Math.cos((Math.PI / 2) * c(x));
export const sineOut: Ease = (x) => Math.sin((Math.PI / 2) * c(x));
export const cubicInOut: Ease = (x) => { x = c(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const cubicOut: Ease = (x) => 1 - Math.pow(1 - c(x), 3);
export const cubicIn: Ease = (x) => Math.pow(c(x), 3);
export const quintInOut: Ease = (x) => { x = c(x); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; };
export const expoInOut: Ease = (x) => { x = c(x); if (x === 0 || x === 1) return x; return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
export const EASES = { linear, hold, smooth, smoother, sineInOut, sineIn, sineOut, cubicInOut, cubicOut, cubicIn, quintInOut, expoInOut };
export type EaseName = keyof typeof EASES;

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** normalised position of x in [a,b], clamped */
export const unlerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
/** 0→1 over [a,b] smoothly */
export const ramp = (a: number, b: number, x: number) => smooth(unlerp(a, b, x));
/** trapezoid window: fades in over [a,a+fi], holds, fades out over [b-fo,b] */
export const trap = (a: number, b: number, x: number, fi = 1, fo = 1) =>
  Math.min(ramp(a, a + fi, x), 1 - ramp(b - fo, b, x));
