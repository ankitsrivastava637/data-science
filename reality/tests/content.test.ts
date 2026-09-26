// The script, the ledger and the timeline agree with each other and with the spec's rules.
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLAIMS, EQUATIONS, SOURCES, claimById, equationById, highestLevel } from '../src/content/ledger';
import { CAPTIONS, EQ_CUES } from '../src/content/script';
import { CHAPTERS, HARD_CUTS, DURATION, TITLE_END, END_START, chapterAt } from '../src/content/chapters';
import { planAt } from '../src/engine/director';

describe('ledger', () => {
  it('every caption, equation cue and equation points at an entry that exists', () => {
    for (const c of CAPTIONS) expect(claimById(c.ref), c.ref).toBeTruthy();
    for (const e of EQ_CUES) expect(equationById(e.eq), e.eq).toBeTruthy();
    for (const e of EQUATIONS) expect(claimById(e.claim), e.id).toBeTruthy();
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const c of CLAIMS) for (const s of c.sources) expect(ids.has(s), `${c.id} → ${s}`).toBe(true);
  });
  it('ids are unique', () => {
    expect(new Set(CLAIMS.map((c) => c.id)).size).toBe(CLAIMS.length);
    expect(new Set(EQUATIONS.map((e) => e.id)).size).toBe(EQUATIONS.length);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
  it("each chapter's epistemic badge equals the highest level among its claims", () => {
    for (const ch of CHAPTERS) {
      const levels = CLAIMS.filter((c) => c.chapter === ch.n).map((c) => c.level);
      expect(levels.length, `chapter ${ch.n} has claims`).toBeGreaterThan(0);
      expect(ch.epistemicLevel, `chapter ${ch.n}`).toBe(highestLevel(levels));
    }
  });
  it('the spec’s epistemic rules hold where they are named', () => {
    const level = (id: string) => claimById(id)!.level;
    for (const c of CLAIMS.filter((c) => c.chapter === 11)) expect(c.level, c.id).toBe('SPECULATIVE'); // frontier
    expect(CHAPTERS[6].epistemicLevel).toBe('INTERPRETATION'); // the block universe is an interpretation
    const text = CLAIMS.map((c) => `${c.claim} ${c.depiction}`).join('\n').toLowerCase();
    expect(text).not.toMatch(/faster than light/);
    void level;
  });
  it('all equations typeset with KaTeX', () => {
    for (const e of EQUATIONS) expect(() => katex.renderToString(e.latex, { throwOnError: true }), e.id).not.toThrow();
  });
});

describe('captions', () => {
  it('hold at least 3 s and read at no more than ~23 characters per second', () => {
    for (const c of CAPTIONS) {
      expect(c.t1 - c.t0, c.ref).toBeGreaterThanOrEqual(3);
      expect(c.text.length / (c.t1 - c.t0), `${c.ref}: ${c.text}`).toBeLessThanOrEqual(23);
    }
  });
  it('never overlap in the same screen position', () => {
    for (const place of ['lower', 'upper']) {
      const cs = CAPTIONS.filter((c) => (c.place ?? 'lower') === place).sort((a, b) => a.t0 - b.t0);
      for (let i = 1; i < cs.length; i++) expect(cs[i].t0, `${cs[i - 1].ref} → ${cs[i].ref}`).toBeGreaterThanOrEqual(cs[i - 1].t1 - 1e-9);
    }
  });
  it('sit inside the chapter that makes the claim', () => {
    for (const c of CAPTIONS) {
      const ch = chapterAt((c.t0 + c.t1) / 2);
      expect(ch?.n, `${c.ref} at ${c.t0}`).toBe(claimById(c.ref)!.chapter);
    }
  });
});

describe('timeline', () => {
  it('chapters are contiguous from the title card to the end card', () => {
    expect(CHAPTERS[0].start).toBe(TITLE_END);
    for (let i = 1; i < CHAPTERS.length; i++) expect(CHAPTERS[i].start).toBe(CHAPTERS[i - 1].end);
    expect(END_START).toBe(CHAPTERS[CHAPTERS.length - 1].end);
    expect(DURATION).toBe(854);
  });
  it('uses at most three hard cuts', () => {
    expect(HARD_CUTS.length).toBeLessThanOrEqual(3);
    const cutChapters = CHAPTERS.filter((c) => c.transitionIn.type === 'cut').length;
    expect(cutChapters + 1).toBe(HARD_CUTS.length); // two chapter cuts + the singularity cut inside chapter 8
  });
  it('transition weights always sum to one and fades stay in [0, 1]', () => {
    for (let t = 0; t <= DURATION; t += 0.05) {
      const p = planAt(t);
      const w = (p.a?.weight ?? 0) + (p.b?.weight ?? 0);
      if (p.a) expect(w).toBeCloseTo(1, 9);
      expect(p.fade).toBeGreaterThanOrEqual(0); expect(p.fade).toBeLessThanOrEqual(1);
    }
  });
});

describe('determinism', () => {
  it('no Math.random or Date.now anywhere in src; timing reads only for instrumentation in main.ts', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    for (const f of walk(join(__dirname, '../src')).filter((f) => /\.ts$/.test(f))) {
      const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/Math\.random\s*\(/);
      expect(src, f).not.toMatch(/Date\.now\s*\(/);
      if (!f.endsWith('main.ts')) expect(src, f).not.toMatch(/performance\.now\s*\(/);
    }
  });
});
