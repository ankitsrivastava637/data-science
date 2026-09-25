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

// ── 4 · Sensory filter ────────────────────────────────────────────────────
cap(4, 1.5, 7.5, 'C4.1', 'Vision begins when 11-cis-retinal straightens to all-trans, in about 200 femtoseconds.');
cap(4, 7.2, 12.8, 'C4.3', 'One activated rhodopsin sets off an amplifying cascade that closes ion channels in the cell membrane.', 'upper');
cap(4, 9.2, 14.8, 'C4.2', 'A rod can produce a quantised electrical response to a single photon.');
cap(4, 15.5, 21.5, 'C4.4', 'About 1.2 million axons in each optic nerve carry the retina’s output, via the thalamus, to the primary visual cortex.');
cap(4, 22.5, 28.8, 'C4.7', 'Even solidity is a report: the hardness you feel is electrons repelling at ~10⁻¹⁰ m, signalled by touch receptors and interpreted by the brain.');
cap(4, 30.0, 35.5, 'C4.6', 'Three kinds of cone pigment absorb best near 558, 531 and 419 nm.');
cap(4, 36.2, 43.2, 'C4.5', 'Colour is constructed from those three signals. These two physically different lights give the same cone responses — and look the same.');
eq(4, 36.2, 43.2, 'E4.1', 0.08, 0.64, 'left');
cap(4, 47.5, 55.5, 'C4.8', 'Visible light spans less than a third of one decade of wavelength. The electromagnetic spectrum spans more than twenty.');

// ── 5 · Frequency & information ───────────────────────────────────────────
cap(5, 1.5, 8.5, 'C5.1', 'A water molecule’s jittery motion is a sum of three normal modes: 1595, 3657 and 3756 cm⁻¹ (gas phase; harmonic model).');
cap(5, 11.5, 19.0, 'C5.2', 'A Fourier transform turns the messy signal into three spectral lines — and back again, exactly.');
eq(5, 11.5, 20.0, 'E5.1');
cap(5, 23.5, 30.5, 'C5.3', 'A quantum oscillator holds energy only in evenly spaced steps.');
eq(5, 23.5, 33.5, 'E5.2');
cap(5, 36.5, 43.5, 'C5.4', 'Coupled oscillators move as a sum of standing-wave normal modes — the same mathematics as a field’s modes.');
cap(5, 50.0, 57.5, 'C5.5', 'Remove the partition and the gas spreads. Entropy S = k ln W counts the microstates W consistent with what we observe.');
eq(5, 50.0, 58.5, 'E5.3');
cap(5, 63.5, 71.5, 'C5.6', 'Countless different microstates give the same coarse-grained picture. Shannon entropy measures the information that description leaves out.');
eq(5, 63.5, 72.0, 'E5.4');

// ── 6 · Life as information ───────────────────────────────────────────────
cap(6, 2.0, 8.5, 'C6.1', 'Sequence information flows from DNA to RNA to protein. First the gene is copied into messenger RNA.');
eq(6, 2.0, 12.0, 'E6.1');
cap(6, 15.0, 22.0, 'C6.2', 'The genetic code is a lookup table: 64 codons, 20 amino acids and stop signals. Adaptor molecules (tRNAs) implement it chemically.');
cap(6, 22.5, 29.0, 'C6.3', 'A ribosome reads the message three bases at a time and joins the amino acids in order. (Illustrative sequence.)');
cap(6, 30.5, 36.0, 'C6.4', 'The amino-acid sequence largely determines how the chain folds into a working shape.');
cap(6, 38.0, 44.5, 'C6.5', 'Copying is imperfect; variation plus selection changes which sequences persist over generations.');

// ── 7 · Spacetime ─────────────────────────────────────────────────────────
cap(7, 13.0, 19.8, 'C7.1', 'A tesseract is a four-dimensional cube. What we can draw is only its three-dimensional shadow.');
cap(7, 21.0, 27.8, 'C7.2', 'Spacetime is four-dimensional too — but not Euclidean: the interval s² = c²t² − x² is the same for every inertial observer.');
eq(7, 21.0, 28.0, 'E7.1');
cap(7, 28.3, 34.0, 'C7.4', 'Light moves along the 45° cone. Everything with mass stays inside it.');
cap(7, 36.5, 44.5, 'C7.3', 'Two observers in relative motion slice the same spacetime into different “nows”. Events simultaneous for one are not for the other.');
eq(7, 36.5, 57.5, 'E7.2');
cap(7, 60.5, 68.0, 'C7.5', 'A clock measures its own proper time. Between the same two events, the traveller’s path has less of it. Flown atomic clocks have measured such effects.');
eq(7, 60.5, 77.5, 'E7.3');
cap(7, 86.0, 95.0, 'C7.6', 'The “block universe” — all times equally real — is an interpretation consistent with relativity, not an experimental result.');

// ── 8 · Gravity ───────────────────────────────────────────────────────────
cap(8, 1.5, 8.0, 'C8.1', 'The curved space around a mass, drawn as Flamm’s paraboloid. The “depth” is not a real direction; distances along the surface are.');
cap(8, 8.5, 15.5, 'C8.2', 'Free fall follows geodesics. Close to a compact mass, orbits no longer close on themselves: they precess.');
cap(8, 19.5, 26.5, 'C8.3', 'Light bends too. Every pixel here is a light ray traced backwards through the Schwarzschild geometry.');
eq(8, 19.5, 34.0, 'E8.1');
cap(8, 27.0, 35.0, 'C8.4', 'Light can circle the hole at the photon sphere, 1.5 rₛ; rays aimed closer than 2.6 rₛ are captured. The event horizon lies at rₛ.');
cap(8, 35.5, 42.0, 'C8.5', 'No stable circular orbit exists inside 3 rₛ, so a thin disk’s inner edge lies there.');
cap(8, 42.5, 48.0, 'C8.6', 'In 2019 the Event Horizon Telescope imaged the shadow of M87*: a ring 42 microarcseconds across.');
cap(8, 48.5, 56.5, 'C8.7', 'Time runs slower deeper in the well: a clock held static at 1.5 rₛ ticks at 58 % of the rate of a distant one.');
eq(8, 48.5, 57.5, 'E8.2');
cap(8, 58.5, 65.5, 'C8.8', 'Inside the horizon every future path leads to r = 0, where classical general relativity predicts infinite curvature — a sign the theory breaks down there.');
cap(8, 67.0, 74.5, 'C8.9', 'A black hole’s entropy is its horizon area in Planck units, divided by four — a theoretical result; Hawking radiation has not been observed.');
eq(8, 67.0, 75.0, 'E8.3', 0.05, 0.62, 'left');
cap(8, 76.0, 86.0, 'C8.10', 'Does the information that fell in come back out? This is an open problem. Recent calculations reproduce a Page curve; how it happens is debated.');

// ── 9 · Mathematics ───────────────────────────────────────────────────────
cap(9, 1.0, 6.5, 'C9.2', 'Āryabhaṭa’s Āryabhaṭīya (499 CE) gives a circumference of 62,832 for a diameter of 20,000: π ≈ 3.1416.');
cap(9, 6.0, 11.5, 'C9.1', 'Brahmagupta’s Brāhmasphuṭasiddhānta (628 CE) gave rules for calculating with zero and negative numbers.');
cap(9, 11.0, 16.5, 'C9.4', 'Dated inscriptions show zero as a dot at Sambor (683 CE) and as a circle at Gwalior (876 CE).', 'upper');
cap(9, 11.5, 17.0, 'C9.3', 'The Bakhshālī manuscript’s folios date to three different periods; what that means for its zero is disputed.');
cap(9, 17.0, 22.5, 'C9.5', 'The 27 nakshatras divide the ecliptic into 13°20′ sectors; the Moon crosses about one a day — a basis for calendar computation.');
cap(9, 19.5, 25.0, 'C9.6', 'Place-value numerals with zero reached Europe through al-Khwārizmī (c. 825) and Fibonacci’s Liber Abaci (1202).', 'upper');
cap(9, 22.5, 28.0, 'C9.7', 'In Kerala, Mādhava (c. 1340–1425) found an infinite series for π.');
eq(9, 22.5, 27.5, 'E9.6', 0.95, 0.075);
cap(9, 28.0, 34.0, 'C9.8', 'There are infinitely many primes, yet their positions look irregular.');
cap(9, 37.5, 44.0, 'C9.9', 'The number of partitions p(n) grows like e^{π√(2n/3)}/(4n√3) — Hardy and Ramanujan, 1918.');
eq(9, 38.0, 44.0, 'E9.2', 0.95, 0.4);
cap(9, 44.5, 50.5, 'C9.10', 'The partition generating function is essentially 1/η, a modular form. Its hidden symmetry is what makes an exact formula for p(n) possible.');
eq(9, 44.5, 50.5, 'E9.1', 0.95, 0.075);
cap(9, 50.3, 55.0, 'C9.11', 'Continued fractions give the best rational approximations: 22/7, 333/106, 355/113.');
eq(9, 50.3, 55.5, 'E9.7', 0.08, 0.42, 'left', 0.9);
cap(9, 53.0, 58.5, 'C9.12', 'Ramanujan’s 1914 series for 1/π adds about eight correct digits with every term.', 'upper');
eq(9, 53.0, 56.0, 'E9.3', 0.55, 0.52, 'left', 0.85);
cap(9, 56.0, 62.0, 'C9.13', 'The zeta function’s non-trivial zeros computed here all lie on Re(s) = ½. The Riemann hypothesis is verified to height 3·10¹² — and unproven.');
eq(9, 56.0, 61.8, 'E9.4', 0.95, 0.075);
cap(9, 62.5, 68.5, 'C9.14', 'Riemann’s explicit formula: one wave per zeta zero. Added together, they rebuild the staircase of the primes.');
eq(9, 62.8, 68.5, 'E9.5', 0.5, 0.82, 'center', 0.85);
cap(9, 69.0, 76.5, 'C9.15', 'Any list of infinite binary sequences misses one: flip the diagonal. Some infinities are larger than others (Cantor, 1891).');
cap(9, 77.5, 83.0, 'C9.16', 'No algorithm can decide, for every program and input, whether it halts (Turing, 1936) — the same diagonal move.', 'upper');
cap(9, 78.0, 84.0, 'C9.17', 'Any consistent formal system strong enough for arithmetic has true statements it cannot prove (Gödel, 1931) — a limit on formal systems, not on knowledge.');
cap(9, 84.3, 90.5, 'C9.18', 'Every continuous symmetry of a physical law implies a conserved quantity (Noether, 1918).');
eq(9, 84.3, 90.5, 'E9.8', 0.95, 0.075);

export const CAPTIONS: Caption[] = CAP.sort((a, b) => a.t0 - b.t0);
export const EQ_CUES: EqCue[] = EQ.sort((a, b) => a.t0 - b.t0);
