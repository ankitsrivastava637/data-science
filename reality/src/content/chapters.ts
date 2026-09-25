// Chapter metadata: pure data shared by the Director, the audio score, the UI and the tests.
import type { Epistemic } from './ledger';

export type TransitionType = 'dissolve' | 'morph' | 'cut';
export type Representation =
  | 'surface' | 'fundus' | 'mosaic' | 'photon-counts' | 'membrane' | 'particles' | 'polymer'
  | 'ball-and-stick' | 'density' | 'isosurface' | 'amplitude-field' | 'born-samples'
  | 'action-density' | 'flux-tube' | 'lattice-field' | 'detections' | 'bloch-sphere' | 'correlation-record'
  | 'molecular-schematic' | 'pathway' | 'spectral-curves' | 'log-axis' | 'time-series' | 'spectrum'
  | 'normal-modes' | 'microstates' | 'histogram' | 'sequence' | 'codon-table' | 'tree'
  | 'polytope-projection' | 'minkowski' | 'worldtubes' | 'embedding' | 'geodesics' | 'ray-traced' | 'penrose-like'
  | 'horizon-tiling' | 'graph' | 'number-grid' | 'young-diagrams' | 'domain-colouring' | 'critical-line'
  | 'diagonal' | 'orbit' | 'zoom-layers' | 'point-cloud' | 'shells' | 'ghosted' | 'equation-glyphs' | 'filaments';

export interface ChapterMeta {
  n: number;
  key: string;
  title: string;
  subtitle: string;
  start: number;
  end: number;
  /** log10 metres of field-of-view width; null bounds where the representation is abstract */
  validScaleRange: [number, number] | null;
  representation: Representation[];
  epistemicLevel: Epistemic;
  transitionIn: { type: TransitionType; duration: number };
  awe: string;
}

export const TITLE_START = 0;
export const TITLE_END = 4;
export const OFFSET = 4; // chapters use the spec's times shifted by the 4 s title card

const m = (mm: number, ss: number) => OFFSET + mm * 60 + ss;

export const CHAPTERS: ChapterMeta[] = [
  { n: 1, key: 'observer', title: 'Observer', subtitle: 'human · eye · retina · photoreceptor · living cell', start: m(0, 0), end: m(1, 0),
    validScaleRange: [-4.9, -1.3], representation: ['surface', 'fundus', 'mosaic', 'photon-counts'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 2.5 }, awe: 'The cell is seen through a photon-catching pipeline.' },
  { n: 2, key: 'inner-scale', title: 'Inner scale', subtitle: 'cell · organelle · DNA · molecule · bond · atom', start: m(1, 0), end: m(2, 30),
    validScaleRange: [-10.2, -4.3], representation: ['membrane', 'particles', 'polymer', 'ball-and-stick', 'density', 'born-samples', 'amplitude-field'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'morph', duration: 4 }, awe: 'The atom stops looking like a solar system; orbitals appear as |ψ|² clouds.' },
  { n: 3, key: 'quantum', title: 'Quantum', subtitle: 'atom · nucleus · proton · quarks and gluons · fields', start: m(2, 30), end: m(4, 30),
    validScaleRange: [-15.3, -9.3], representation: ['density', 'action-density', 'flux-tube', 'lattice-field', 'amplitude-field', 'detections', 'bloch-sphere', 'correlation-record'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'morph', duration: 3 }, awe: 'An interference pattern assembled from individual detections; spin as a 4π phase structure.' },
  { n: 4, key: 'sensory-filter', title: 'Sensory filter', subtitle: 'photon · eye · cortex · spectrum', start: m(4, 30), end: m(5, 30),
    validScaleRange: [-9.5, -0.7], representation: ['molecular-schematic', 'pathway', 'spectral-curves', 'log-axis'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 2.5 }, awe: 'The visible band drawn to true logarithmic scale beside the whole electromagnetic spectrum.' },
  { n: 5, key: 'frequency', title: 'Frequency & information', subtitle: 'Fourier · normal modes · entropy · coarse-graining', start: m(5, 30), end: m(6, 45),
    validScaleRange: null, representation: ['time-series', 'spectrum', 'normal-modes', 'microstates', 'histogram'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'morph', duration: 3 }, awe: 'A messy signal collapses into three spectral spikes and back; many microstates collapse into one macrostate.' },
  { n: 6, key: 'life', title: 'Life as information', subtitle: 'DNA · protein · cell · evolution', start: m(6, 45), end: m(7, 30),
    validScaleRange: null, representation: ['sequence', 'codon-table', 'molecular-schematic', 'tree'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 2.5 }, awe: 'Chemistry visibly implementing a lookup table.' },
  { n: 7, key: 'spacetime', title: 'Spacetime', subtitle: 'point · line · plane · cube · tesseract · Minkowski · time dilation · block universe', start: m(7, 30), end: m(9, 15),
    validScaleRange: null, representation: ['polytope-projection', 'minkowski', 'worldtubes'], epistemicLevel: 'INTERPRETATION',
    transitionIn: { type: 'cut', duration: 0 }, awe: 'Two observers’ simultaneity slices tilt against each other on the same worldlines.' },
  { n: 8, key: 'gravity', title: 'Gravity', subtitle: 'curved spacetime · geodesics · lensing · black hole · information', start: m(9, 15), end: m(10, 45),
    validScaleRange: null, representation: ['embedding', 'geodesics', 'ray-traced', 'penrose-like', 'horizon-tiling'], epistemicLevel: 'SPECULATIVE',
    transitionIn: { type: 'dissolve', duration: 3 }, awe: 'Schwarzschild ray-traced lensing; the singularity shown as where the theory fails.' },
  { n: 9, key: 'mathematics', title: 'Mathematics', subtitle: 'zero · primes · partitions · zeta · infinity · limits · symmetry', start: m(10, 45), end: m(12, 15),
    validScaleRange: null, representation: ['number-grid', 'young-diagrams', 'domain-colouring', 'critical-line', 'diagonal', 'orbit'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 2.5 }, awe: 'One formula, summed over zeta zeros, rebuilds the primes; Cantor’s diagonal made visible.' },
  { n: 10, key: 'cosmos', title: 'Cosmos', subtitle: 'human · room · Earth · stars · galaxies · cosmic web', start: m(12, 15), end: m(13, 15),
    validScaleRange: [0.2, 27.0], representation: ['zoom-layers', 'point-cloud', 'filaments', 'shells'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 3 }, awe: 'Farther is older; the cosmic web grows from tiny fluctuations.' },
  { n: 11, key: 'frontier', title: 'Frontier', subtitle: 'inflation · landscape · quantum gravity · extra dimensions', start: m(13, 15), end: m(13, 40),
    validScaleRange: null, representation: ['ghosted'], epistemicLevel: 'SPECULATIVE',
    transitionIn: { type: 'cut', duration: 0 }, awe: 'Structure rendered as visibly un-rendered: ghosted, probabilistic, incomplete.' },
  { n: 12, key: 'synthesis', title: 'Synthesis', subtitle: '', start: m(13, 40), end: m(14, 6),
    validScaleRange: [-15.3, 27.0], representation: ['particles', 'amplitude-field', 'lattice-field', 'polytope-projection', 'graph', 'equation-glyphs', 'filaments', 'mosaic'], epistemicLevel: 'ESTABLISHED',
    transitionIn: { type: 'dissolve', duration: 3 }, awe: 'A continuous zoom that ends inside the observer’s own visual field.' },
];

export const END_START = CHAPTERS[CHAPTERS.length - 1].end;
export const END_END = END_START + 4;
export const DURATION = END_END;

/** Deliberate hard cuts ("epistemic shocks"). Max 3 allowed; tests enforce this. */
export const HARD_CUTS: { t: number; why: string }[] = [
  { t: CHAPTERS[6].start, why: 'Life → Spacetime: space and time stop being separate.' },
  { t: 0, why: 'Gravity: the singularity — where classical GR fails.' }, // exact time filled below
  { t: CHAPTERS[10].start, why: 'Cosmos → Frontier: beyond here nothing is established.' },
];
/** time of the singularity cut inside Chapter 8 (seconds into the chapter) */
export const SINGULARITY_CUT_LOCAL = 58;
HARD_CUTS[1].t = CHAPTERS[7].start + SINGULARITY_CUT_LOCAL;

export function chapterAt(t: number): ChapterMeta | null {
  for (const c of CHAPTERS) if (t >= c.start && t < c.end) return c;
  return null;
}
