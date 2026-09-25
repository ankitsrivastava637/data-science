// The caption / narration track. Every caption references a ledger claim; every equation cue
// references a ledger equation. Times are local to the chapter (seconds after its start).
import { CHAPTERS } from './chapters';

export interface Caption { t0: number; t1: number; text: string; ref: string; place?: 'lower' | 'upper' }
export interface EqCue { t0: number; t1: number; eq: string; x: number; y: number; align?: 'left' | 'center' | 'right'; scale?: number }

const CAP: Caption[] = [];
const EQ: EqCue[] = [];
function cap(ch: number, t0: number, t1: number, ref: string, text: string, place?: 'lower' | 'upper') {
  const s = CHAPTERS[ch - 1].start;
  CAP.push({ t0: s + t0, t1: s + t1, text, ref, place });
}
/** equation cue, default top-right inside the title-safe area */
function eq(ch: number, t0: number, t1: number, id: string, x = 0.95, y = 0.075, align: 'left' | 'center' | 'right' = 'right', scale = 1) {
  const s = CHAPTERS[ch - 1].start;
  EQ.push({ t0: s + t0, t1: s + t1, eq: id, x, y, align, scale });
}

// ── 1 · Observer ──────────────────────────────────────────────────────────
cap(1, 2.0, 8.5, 'C1.1', 'A human eye, about 24 millimetres long.');
cap(1, 18.0, 24.0, 'C1.3', 'Inside: the fundus. Optic disc, blood vessels, and the macula with the fovea at its centre.');
cap(1, 24.5, 30.0, 'C1.2', 'Light crosses the transparent neural layers of the retina before reaching the photoreceptors at the back.');
cap(1, 30.5, 36.5, 'C1.4', 'Cones at the fovea: up to about 199,000 per square millimetre, each a few micrometres across.');
cap(1, 37.0, 41.5, 'C1.7', 'False colour marks cone type: L, M and S. The cones themselves are not coloured.');
cap(1, 42.0, 46.5, 'C1.5', 'The very centre has no S cones at all.');
cap(1, 47.0, 52.5, 'C1.6', 'Here L : M ≈ 2 : 1. Among people with normal colour vision the ratio ranges from about 1 : 1 to 16 : 1.');
cap(1, 52.5, 60.5, 'C1.8', 'Seen through a microscope, a living cell arrives as individual photon absorptions — random in time, an image only once they accumulate.');
eq(1, 51.5, 60.5, 'E1.1');

// ── 2 · Inner scale ───────────────────────────────────────────────────────
cap(2, 2.5, 8.5, 'C2.1', 'The cell itself, about 25 µm across: nucleus, mitochondria, a scaffold of microtubules.');
cap(2, 9.0, 14.5, 'C2.2', 'Its interior is densely crowded with proteins and other macromolecules.');
cap(2, 21.5, 27.5, 'C2.4', 'Chromatin. How it folds at this scale inside living cells is still debated; shown schematically.');
cap(2, 28.5, 34.5, 'C2.3', 'DNA wound around histone proteins: about 146 base pairs in 1.65 left-handed turns per nucleosome.');
cap(2, 37.5, 43.5, 'C2.5', 'The double helix: 2 nm wide, a full turn every ~10.5 base pairs, with major and minor grooves. Atom positions schematic.');
cap(2, 47.5, 53.0, 'C2.6', 'One rung: guanine paired with cytosine by three hydrogen bonds.');
cap(2, 55.5, 61.5, 'C2.7', 'A chemical bond is shared electron density piled up between nuclei (approximate density shown).');
cap(2, 65.5, 70.5, 'C2.8', 'Not like this. Electrons do not orbit nuclei like planets.');
cap(2, 71.0, 78.0, 'C2.9', 'Hydrogen has exact solutions. The cloud is |ψ|²: the probability of finding the electron here rather than there.');
eq(2, 71.0, 78.5, 'E2.1');
eq(2, 73.0, 78.5, 'E2.2', 0.95, 0.16);
cap(2, 80.0, 87.5, 'C2.10', 'A stationary state does not move. A superposition of two energies oscillates — here slowed about 10¹⁶ times.');
eq(2, 79.5, 88.0, 'E2.3');

// ── 3 · Quantum ───────────────────────────────────────────────────────────
cap(3, 2.0, 8.0, 'C3.1', 'Into the nucleus. Hydrogen’s is a single proton, some 60,000 times smaller than the atom.');
cap(3, 17.5, 23.0, 'C3.3', 'A proton: charge radius 0.84 femtometres.');
cap(3, 23.5, 31.5, 'C3.4', 'Three valence quarks in a seething gluon field with short-lived quark–antiquark pairs. Illustrative, lattice-QCD-inspired: the proton has no fixed shape.');
cap(3, 32.0, 38.5, 'C3.5', 'Between three quarks, lattice QCD finds the gluon field forming a Y-shaped flux tube. Colour charge is never seen alone.');
cap(3, 48.5, 56.5, 'C3.6', 'Underneath: quantum fields. A field is a set of modes; a particle is a quantised excitation of them.');
eq(3, 48.5, 57.0, 'E3.3');
cap(3, 67.5, 73.5, 'C3.7', 'One particle at a time through two slits. Each arrives at a single, random point.');
cap(3, 75.0, 83.0, 'C3.8', 'The odds follow |ψ|² of a wave that passed through both slits. The pattern exists only in the accumulated record.');
eq(3, 74.0, 83.5, 'E3.1');
eq(3, 76.5, 83.5, 'E3.2', 0.95, 0.165);
cap(3, 96.5, 103.0, 'C3.9', 'Spin-½: the state is a spinor. A 360° rotation flips its sign; only 720° restores it — as neutron interferometry confirmed.');
eq(3, 96.5, 107.0, 'E3.4');
eq(3, 99.0, 107.0, 'E3.5', 0.95, 0.165);
cap(3, 103.5, 107.5, 'C3.10', 'It is not a spinning ball.');
cap(3, 108.5, 118.0, 'C3.11', 'An entangled pair: each side alone sees 50/50 randomness. The correlation appears only when the two records are compared — no signal passes between them.');
eq(3, 109.0, 118.5, 'E3.6');

export const CAPTIONS: Caption[] = CAP.sort((a, b) => a.t0 - b.t0);
export const EQ_CUES: EqCue[] = EQ.sort((a, b) => a.t0 - b.t0);
