// Scale continuity: within each zoom, the field-of-view track moves in one direction only.
import { describe, it, expect } from 'vitest';
import { sTrack } from '../src/chapters/ch10/index';

const monotone = (f: (t: number) => number, a: number, b: number, dir: 1 | -1) => {
  let prev = f(a);
  for (let t = a; t <= b; t += 0.01) { const v = f(t); expect(dir * (v - prev), `t = ${t.toFixed(2)}`).toBeGreaterThanOrEqual(-1e-12); prev = v; }
};

describe('zoom tracks', () => {
  it('Chapter 10 zooms out monotonically from a person to the horizon', () => {
    monotone(sTrack, 0, 61, 1);
    expect(sTrack(0)).toBeLessThan(1);
    expect(sTrack(61)).toBeGreaterThan(27);
  });
});

describe('zoom tracks, inner scale', () => {
  it('Chapter 1 zooms in monotonically on the eye, then (inside it) on the retina', async () => {
    const { ch1Scale } = await import('../src/chapters/ch1/index');
    monotone(ch1Scale, 0, 16.19, -1);
    monotone(ch1Scale, 16.2, 44, -1);
  });
  it('Chapter 2 zooms in monotonically from the cell to the bond', async () => {
    const { ch2Scale } = await import('../src/chapters/ch2/index');
    monotone(ch2Scale, 0, 64.4, -1);
    expect(ch2Scale(0)).toBeCloseTo(Math.log10(37.5e-6), 3);
  });
});
