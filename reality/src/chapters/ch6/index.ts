// Chapter 6 · Life as information — transcription, translation as a visible table lookup (the
// standard genetic code), folding (schematic), and an evolving tree of lineages.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { D2, lerp } from '../draw2d';
import { BASES, DEMO_MRNA, THREE_LETTER, complement, dnaCoding, translateCodon } from '../../math/geneticCode';
import { Rng } from '../../engine/prng';

const BASE_COL: Record<string, string> = { A: '#e8a36b', U: '#7fb6e6', T: '#7fb6e6', G: '#9fd18e', C: '#d99ad1' };
export const TX = { start: 2, end: 12 };          // transcription
export const TL = { start: 14.5, per: 1.3 };      // translation: one codon per 1.3 s

export default function create(ctx: EngineContext): ChapterInstance {
  const codons = DEMO_MRNA.match(/.{3}/g)!;
  const aas = codons.map(translateCodon);
  const fold = makeFold(aas.length - 1, ctx.seed);
  const tree = makeTree(ctx.seed);
  // subtle 3D backdrop: slowly drifting points (molecular crowd), so the frame is not flat black
  const scene = new THREE.Scene();
  const N = 1800;
  const pos = new Float32Array(N * 3);
  const rng = new Rng(ctx.seed, 1700);
  for (let i = 0; i < N; i++) { pos[i * 3] = rng.range(-30, 30); pos[i * 3 + 1] = rng.range(-16, 16); pos[i * 3 + 2] = rng.range(-40, -5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0x3a3f4a, size: 0.18, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, pm);
  scene.add(pts);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      cam.aspect = f.aspect; cam.updateProjectionMatrix();
      cam.position.set(Math.sin(lt * 0.02) * 3, 0, 12); cam.lookAt(0, 0, -10); cam.updateMatrixWorld();
      const a = trap(-2, 37.5, lt, 1.5, 1.5);
      out.draw.push((gg, W, H, a0) => {
        const d = new D2(gg, W, H, a0 * a);
        drawCentral(d, lt, codons, aas, fold);
      });
      const ev = ramp(36.5, 38, lt);
      if (ev > 0.01) out.draw.push((gg, W, H, a0) => drawTree(new D2(gg, W, H, a0 * ev), lt, tree));
      out.hud = { s: null, abstractLabel: lt < 37 ? 'sequence — illustrative, not a real gene' : 'lineages — illustrative simulation' };
      out.post = { exposure: 1.0, bloom: 0.04, vignette: 0.3 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(scene, cam);
    },
    dispose() { g.dispose(); pm.dispose(); },
  };
}

function drawCentral(d: D2, lt: number, codons: string[], aas: string[], fold: [number, number][]) {
  const n = codons.length;
  const cw = 0.0225;              // width of one base
  const x0 = 0.5 - (n * 3 * cw) / 2;
  const coding = dnaCoding(codons.join('')), templ = complement(coding);
  const txp = clamp((lt - TX.start) / (TX.end - TX.start));
  const dnaA = 1 - ramp(13, 15, lt);
  // DNA: two strands with a gentle helical backbone
  if (dnaA > 0.01) {
    d.alpha(dnaA);
    const yA = 0.26, yB = 0.34;
    const pA: [number, number][] = [], pB: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const x = x0 - 0.02 + ((n * 3 * cw + 0.04) * i) / 200;
      const ph = x * 60 - lt * 0.4;
      pA.push([x, yA - 0.012 * Math.sin(ph)]); pB.push([x, yB + 0.012 * Math.sin(ph)]);
    }
    d.line(pA, 'rgba(200,190,172,0.6)', 1.2); d.line(pB, 'rgba(200,190,172,0.6)', 1.2);
    for (let i = 0; i < coding.length; i++) {
      const x = x0 + (i + 0.5) * cw;
      d.text(coding[i], x, yA + 0.028, { size: 17, align: 'center', color: BASE_COL[coding[i]] });
      d.text(templ[i], x, yB - 0.012, { size: 17, align: 'center', color: BASE_COL[templ[i]] });
    }
    d.text('DNA', x0 - 0.035, 0.305, { size: 15, align: 'right', color: '#aaa394' });
    // polymerase
    const px = x0 + txp * n * 3 * cw;
    if (txp > 0 && txp < 1) { d.g.fillStyle = 'rgba(200,210,230,0.10)'; d.g.beginPath(); d.g.ellipse(px * d.W, 0.3 * d.H, 0.035 * d.W, 0.075 * d.H, 0, 0, Math.PI * 2); d.g.fill(); d.text('RNA polymerase', px, 0.2, { size: 14, align: 'center', color: '#aeb8c8' }); }
    d.alpha(1);
  }
  // mRNA row (moves up into place once DNA fades)
  const my = lerp(0.46, 0.3, smooth(clamp((lt - 13) / 2)));
  const shown = Math.floor(txp * coding.length);
  const tlk = Math.floor((lt - TL.start) / TL.per); // codon index under the ribosome
  for (let i = 0; i < shown; i++) {
    const x = x0 + (i + 0.5) * cw;
    const c = coding[i] === 'T' ? 'U' : coding[i];
    const ci = Math.floor(i / 3);
    const hi = ci === tlk && lt >= TL.start ? 1 : 0;
    d.text(c, x, my, { size: 18, align: 'center', color: hi ? '#ffffff' : BASE_COL[c], weight: hi ? 600 : 380 });
  }
  if (shown > 0) d.text('mRNA', x0 - 0.035, my, { size: 15, align: 'right', color: '#aaa394' });
  // codon separators
  if (lt > TL.start - 1) {
    d.alpha(ramp(TL.start - 1, TL.start, lt));
    for (let c = 1; c < codons.length; c++) { const x = x0 + c * 3 * cw; d.line([[x, my - 0.03], [x, my + 0.012]], 'rgba(150,145,135,0.5)', 1); }
    d.alpha(1);
  }
  // codon table (standard genetic code), lit cell = the current lookup
  const tabA = ramp(TL.start - 1.5, TL.start, lt) * (1 - ramp(29.5, 31, lt));
  const cur = tlk >= 0 && tlk < codons.length ? codons[tlk] : null;
  if (tabA > 0.01) {
    d.alpha(tabA);
    const tx = 0.555, ty = 0.43, cwid = 0.092, ch = 0.0305;
    d.text('the genetic code (standard table)', tx, ty - 0.025, { size: 15, color: '#aaa394' });
    BASES.forEach((b2, j) => d.text(b2, tx + (j + 0.5) * cwid, ty - 0.002, { size: 13, align: 'center', color: '#8b857a' }));
    BASES.forEach((b1, i) => BASES.forEach((b3, k) => {
      const row = i * 4 + k;
      const y = ty + 0.012 + row * ch;
      if (k === 0) d.text(b1, tx - 0.012, y + ch * 2.2, { size: 13, align: 'right', color: '#8b857a' });
      BASES.forEach((b2, j) => {
        const codon = b1 + b2 + b3;
        const aa = translateCodon(codon);
        const isCur = cur === codon;
        if (isCur) d.rect(tx + j * cwid + 0.002, y + 0.002, cwid - 0.004, ch - 0.004, 'rgba(255,214,160,0.28)');
        d.text(`${codon} ${THREE_LETTER[aa]}`, tx + j * cwid + 0.006, y + ch * 0.72, { size: 13.5, color: isCur ? '#fff2dc' : aa === '*' ? '#b07a7a' : '#8f897d', weight: isCur ? 600 : 380 });
      });
    }));
    d.alpha(1);
  }
  // ribosome and peptide
  if (lt >= TL.start - 0.5) {
    const kk = clamp((lt - TL.start) / TL.per, 0, codons.length);
    const rx = x0 + (Math.min(kk, codons.length - 0.001) * 3 + 1.5) * cw;
    const ribA = ramp(TL.start - 0.5, TL.start, lt) * (1 - ramp(29, 30.5, lt));
    d.alpha(ribA);
    d.g.fillStyle = 'rgba(210,200,185,0.13)';
    d.g.beginPath(); d.g.ellipse(rx * d.W, (my - 0.05) * d.H, 0.05 * d.W, 0.06 * d.H, 0, 0, Math.PI * 2); d.g.fill();
    d.g.beginPath(); d.g.ellipse(rx * d.W, (my + 0.02) * d.H, 0.058 * d.W, 0.035 * d.H, 0, 0, Math.PI * 2); d.g.fill();
    d.text('ribosome', rx, my + 0.085, { size: 14, align: 'center', color: '#bdb6a8' });
    d.alpha(1);
    // peptide chain beads (amino acids joined so far); later they fold
    const made = Math.min(aas.length - 1, Math.floor(kk + 0.3)); // stop codon adds nothing
    const foldK = smooth(clamp((lt - 30.5) / 4.5));
    for (let i = 0; i < made; i++) {
      const lx = rx - 0.03 - (made - i) * 0.036, ly = my - 0.13 + 0.012 * Math.sin(i * 1.3);
      const [fx, fy] = fold[i];
      const x = lerp(lx, 0.5 + fx * 0.2, foldK), y = lerp(ly, 0.55 + fy * 0.2 * 16 / 9, foldK);
      if (i > 0) {
        const plx = rx - 0.03 - (made - i + 1) * 0.036, ply = my - 0.13 + 0.012 * Math.sin((i - 1) * 1.3);
        const [pfx, pfy] = fold[i - 1];
        d.line([[lerp(plx, 0.5 + pfx * 0.2, foldK), lerp(ply, 0.55 + pfy * 0.2 * 16 / 9, foldK)], [x, y]], 'rgba(200,190,172,0.7)', 1.6);
      }
      d.circle(x, y, 16, 'rgba(60,54,48,0.95)', '#d8c8a8', 1.4);
      d.text(THREE_LETTER[aas[i]], x, y + 0.007, { size: 13.5, align: 'center', color: '#f0e6d2', shadow: false });
    }
    if (foldK > 0.3) d.text('the chain folds (schematic)', 0.5, 0.86, { size: 15, align: 'center', color: '#aaa394', alpha: foldK });
  }
}

/** a compact 2D fold path for the peptide (schematic) */
function makeFold(n: number, seed: number): [number, number][] {
  const rng = new Rng(seed, 1701);
  const out: [number, number][] = [];
  let x = -0.9, y = 0.2, a = 0;
  for (let i = 0; i < n; i++) {
    out.push([x, y]);
    a += 1.1 + rng.normal() * 0.35;
    const r = 0.42;
    x += Math.cos(a) * r * 0.9; y += Math.sin(a) * r * 0.55;
  }
  // centre it
  const cx = out.reduce((s, p) => s + p[0], 0) / n, cy = out.reduce((s, p) => s + p[1], 0) / n;
  return out.map(([px, py]) => [px - cx, py - cy]);
}

interface Node { t0: number; t1: number; parent: number; trait: number; y: number; dead: boolean; kids: number[] }
/** birth–death lineages with a drifting trait and mild selection (illustrative) */
function makeTree(seed: number): Node[] {
  const rng = new Rng(seed, 1702);
  const nodes: Node[] = [{ t0: 0, t1: 1, parent: -1, trait: 0.5, y: 0, dead: false, kids: [] }];
  const queue = [0];
  while (queue.length) {
    const i = queue.shift()!;
    const nd = nodes[i];
    // time to next event
    const dt = -Math.log(1 - rng.float()) * 0.11;
    const te = nd.t0 + dt;
    if (te >= 1 || nodes.length > 170) continue;
    const fitness = 1 - Math.abs(nd.trait - 0.62) * 1.6; // selection favours traits near 0.62
    if (rng.float() > 0.35 + 0.6 * fitness) { nd.t1 = te; nd.dead = true; continue; }
    nd.t1 = te;
    for (let k = 0; k < 2; k++) {
      const trait = Math.max(0, Math.min(1, nd.trait + rng.normal() * 0.09));
      nodes.push({ t0: te, t1: 1, parent: i, trait, y: 0, dead: false, kids: [] });
      nd.kids.push(nodes.length - 1);
      queue.push(nodes.length - 1);
    }
  }
  // layout: leaves in DFS order
  let leaf = 0;
  const layout = (i: number): number => {
    const nd = nodes[i];
    if (!nd.kids.length) { nd.y = leaf++; return nd.y; }
    const ys = nd.kids.map(layout);
    nd.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    return nd.y;
  };
  layout(0);
  for (const nd of nodes) nd.y /= Math.max(1, leaf - 1);
  return nodes;
}

function drawTree(d: D2, lt: number, nodes: Node[]) {
  const T = clamp((lt - 37.5) / 7);
  const X = (t: number) => 0.12 + t * 0.76, Y = (y: number) => 0.16 + y * 0.62;
  const col = (tr: number) => `hsl(${Math.round(215 - 190 * tr)}, 45%, ${Math.round(60 + 8 * tr)}%)`;
  for (const nd of nodes) {
    if (nd.t0 > T) continue;
    const t1 = Math.min(nd.t1, T);
    const p = nd.parent >= 0 ? nodes[nd.parent] : null;
    if (p) d.line([[X(nd.t0), Y(p.y)], [X(nd.t0), Y(nd.y)]], 'rgba(170,162,148,0.45)', 1);
    d.line([[X(nd.t0), Y(nd.y)], [X(t1), Y(nd.y)]], col(nd.trait), 1.6);
    if (nd.dead && nd.t1 <= T) d.text('×', X(nd.t1) + 0.004, Y(nd.y) + 0.007, { size: 12, color: '#8b857a' });
  }
  d.text('generations →', 0.88, 0.84, { size: 14, align: 'right', color: '#8b857a' });
  d.text('colour: a heritable trait; lineages far from the favoured value die out more often (illustrative)', 0.12, 0.84, { size: 14, color: '#aaa394' });
}
