// Science ledger — the single source of truth for every on-screen claim and equation.
// SCIENCE.md is generated from this file (npm run ledger). Captions and equations in the
// chapters reference these ids; tests/ledger.test.ts fails if a reference is missing.

export type Epistemic = 'ESTABLISHED' | 'INTERPRETATION' | 'SPECULATIVE';

export interface Source {
  id: string;
  cite: string;
  url: string;
  /** How the source was consulted from the build environment. */
  access: 'search-excerpt' | 'textbook';
}

export interface Claim {
  id: string;
  chapter: number;
  claim: string;
  depiction: string;
  level: Epistemic;
  sources: string[];
  note?: string;
}

export interface Equation {
  id: string;
  chapter: number;
  latex: string;
  meaning: string;
  claim: string;
}

// Web page fetching was blocked in the build environment; only search-engine excerpts of
// the pages below were readable. "search-excerpt" means the specific fact was checked
// against the excerpt, not that the full paper was read. "textbook" means standard physics /
// mathematics for which no source was fetched; where marked (test) it is also verified
// numerically by the unit tests.
export const SOURCES: Source[] = [
  { id: 'S1', cite: 'Planck Collaboration (2020), Planck 2018 results VI: Cosmological parameters, A&A 641, A6 — H0 = 67.4±0.5 km/s/Mpc, Ωm = 0.315±0.007, σ8 = 0.811, age 13.787±0.020 Gyr', url: 'https://arxiv.org/abs/1807.06209', access: 'search-excerpt' },
  { id: 'S2', cite: 'CODATA 2018 (Tiesinga et al. 2021, Rev. Mod. Phys. 93, 025010) — proton rms charge radius 0.8414(19) fm', url: 'https://physics.nist.gov/cgi-bin/cuu/Value?rp', access: 'search-excerpt' },
  { id: 'S3', cite: 'Gas-phase H2O fundamentals ν1 = 3657, ν2 = 1595, ν3 = 3756 cm⁻¹ (NIST CCCBDB; LSBU water spectrum page)', url: 'https://cccbdb.nist.gov/exp2x.asp?casno=7732185', access: 'search-excerpt' },
  { id: 'S4', cite: 'H2O gas-phase geometry r(OH) = 0.9572 Å, ∠HOH = 104.52°', url: 'https://water.lsbu.ac.uk/water/water_vibrational_spectrum.html', access: 'search-excerpt' },
  { id: 'S5', cite: 'Luger K. et al. (1997), Crystal structure of the nucleosome core particle at 2.8 Å, Nature 389, 251 — 146 bp, 1.65 left-handed superhelical turns', url: 'https://www.nature.com/articles/38444', access: 'search-excerpt' },
  { id: 'S6', cite: 'B-DNA geometry: ~2 nm diameter, 3.4 nm per ~10.5 bp; minor groove ~5.7 Å, major ~11.7 Å (ScienceDirect topic summaries)', url: 'https://www.sciencedirect.com/topics/agricultural-and-biological-sciences/b-dna', access: 'search-excerpt' },
  { id: 'S7', cite: 'Curcio C.A. et al. (1990), Human photoreceptor topography, J. Comp. Neurol. 292, 497 — peak foveal cone density 199,000/mm² (100k–324k), 4.6 million cones', url: 'https://onlinelibrary.wiley.com/doi/abs/10.1002/cne.902920402', access: 'search-excerpt' },
  { id: 'S8', cite: 'Curcio et al. (1991) via Calkins (2001) and Webvision — S cones absent from the central ~100 µm of the fovea', url: 'https://www.webvision.pitt.edu/book/part-ii-anatomy-and-physiology-of-the-retina/the-architecture-of-the-human-fovea/', access: 'search-excerpt' },
  { id: 'S9', cite: 'Hofer H. et al. (2005), Organization of the human trichromatic cone mosaic, J. Neurosci. 25, 9669 — L:M from 1.1:1 to 16.5:1', url: 'https://www.jneurosci.org/content/25/42/9669', access: 'search-excerpt' },
  { id: 'S10', cite: 'Govardovskii V.I. et al. (2000), In search of the visual pigment template, Vis. Neurosci. 17, 509 — A1 template constants', url: 'https://pubmed.ncbi.nlm.nih.gov/11016572/', access: 'search-excerpt' },
  { id: 'S11', cite: 'Schoenlein R.W. et al. (1991), The first step in vision: femtosecond isomerization of rhodopsin, Science 254, 412 — ~200 fs', url: 'https://www.science.org/doi/10.1126/science.1925597', access: 'search-excerpt' },
  { id: 'S12', cite: 'Baylor D.A., Lamb T.D., Yau K.-W. (1979), Responses of retinal rods to single photons, J. Physiol. 288, 613', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1281447/', access: 'search-excerpt' },
  { id: 'S13', cite: 'Ocular anatomy summaries — optic nerve ≈ 1.2 million axons; adult axial length ≈ 24 mm', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/', access: 'search-excerpt' },
  { id: 'S14', cite: 'Bissey F. et al. (2007), Gluon flux-tube distribution and linear confinement in baryons, Phys. Rev. D 76, 114512 — Y-shaped flux tubes (lattice QCD)', url: 'https://arxiv.org/abs/hep-lat/0606016', access: 'search-excerpt' },
  { id: 'S15', cite: 'Tonomura A. et al. (1989), Demonstration of single-electron buildup of an interference pattern, Am. J. Phys. 57, 117', url: 'https://pubs.aip.org/aapt/ajp/article/57/2/117/1040594', access: 'search-excerpt' },
  { id: 'S16', cite: 'Rauch H. et al. (1975), Verification of coherent spinor rotation of fermions, Phys. Lett. A 54, 425 — 4π periodicity', url: 'https://www.sciencedirect.com/science/article/abs/pii/0375960175907987', access: 'search-excerpt' },
  { id: 'S17', cite: 'Hensen B. et al. (2015), Loophole-free Bell inequality violation using electron spins separated by 1.3 km, Nature 526, 682', url: 'https://www.nature.com/articles/nature15759', access: 'search-excerpt' },
  { id: 'S18', cite: 'Hafele J.C., Keating R.E. (1972), Around-the-world atomic clocks: observed relativistic time gains, Science 177, 168', url: 'https://www.science.org/doi/10.1126/science.177.4044.168', access: 'search-excerpt' },
  { id: 'S19', cite: 'Schwarzschild photon sphere r = 3GM/c² = 1.5 r_s; ISCO r = 6GM/c² = 3 r_s (textbook values, cross-checked by search excerpt)', url: 'https://en.wikipedia.org/wiki/Photon_sphere', access: 'search-excerpt' },
  { id: 'S20', cite: 'Event Horizon Telescope Collaboration (2019), First M87 EHT results I, ApJL 875, L1 — ring 42±3 µas, M = (6.5±0.7)×10⁹ M☉', url: 'https://arxiv.org/abs/1906.11238', access: 'search-excerpt' },
  { id: 'S21', cite: 'Hawking S.W. (1975), Particle creation by black holes, Commun. Math. Phys. 43, 199; Bekenstein J.D. (1973), Black holes and entropy, Phys. Rev. D 7 — S = A/4', url: 'https://link.springer.com/article/10.1007/BF02345020', access: 'search-excerpt' },
  { id: 'S22', cite: 'Almheiri A. et al. (2021), The entropy of Hawking radiation, Rev. Mod. Phys. 93, 035002', url: 'https://www.osti.gov/pages/biblio/1839660', access: 'search-excerpt' },
  { id: 'S23', cite: 'GRAVITY Collaboration (2019), A geometric distance measurement to the Galactic Center black hole, A&A 625, L10 — R0 = 8178 ± 13 ± 22 pc', url: 'https://arxiv.org/abs/1904.05721', access: 'search-excerpt' },
  { id: 'S24', cite: 'Davis T.M., Lineweaver C.H. (2004), Expanding confusion: common misconceptions of cosmological horizons, PASA 21, 97', url: 'https://arxiv.org/abs/astro-ph/0310808', access: 'search-excerpt' },
  { id: 'S25', cite: "Zel'dovich Ya.B. (1970), Gravitational instability: an approximate theory for large density perturbations, A&A 5, 84", url: 'https://ui.adsabs.harvard.edu/abs/1970A&A.....5...84Z/abstract', access: 'search-excerpt' },
  { id: 'S26', cite: 'Andromeda (M31) distance ≈ 765 kpc ≈ 2.5 Mly (encyclopedic summary)', url: 'https://en.wikipedia.org/wiki/Andromeda_Galaxy', access: 'search-excerpt' },
  { id: 'S27', cite: 'Platt D.J., Trudgian T. (2021), The Riemann hypothesis is true up to 3·10¹², Bull. LMS 53, 792', url: 'https://arxiv.org/abs/2004.09765', access: 'search-excerpt' },
  { id: 'S28', cite: 'Odlyzko A.M., Tables of zeros of the Riemann zeta function (first zero 14.134725141…)', url: 'https://www-users.cse.umn.edu/~odlyzko/zeta_tables/index.html', access: 'search-excerpt' },
  { id: 'S29', cite: 'Hardy G.H., Ramanujan S. (1918) partition asymptotics p(n) ~ e^{π√(2n/3)}/(4n√3); OEIS A000041', url: 'https://oeis.org/A000041', access: 'search-excerpt' },
  { id: 'S30', cite: 'Ramanujan S. (1914), Modular equations and approximations to π — 1/π series (proved by J. & P. Borwein, 1987)', url: 'https://arxiv.org/abs/2411.15803', access: 'search-excerpt' },
  { id: 'S31', cite: 'MacTutor: Brahmagupta — Brāhmasphuṭasiddhānta (628 CE), rules for arithmetic with zero and negatives', url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Brahmagupta/', access: 'search-excerpt' },
  { id: 'S32', cite: 'MacTutor / Britannica: Āryabhaṭa — Āryabhaṭīya (499 CE), circumference 62832 for diameter 20000', url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Aryabhata_I/', access: 'search-excerpt' },
  { id: 'S33', cite: 'Bodleian Library (2017) radiocarbon dates of Bakhshālī folios: 224–383, 680–779, 885–993 CE; Plofker K. et al. (2017), HSSA 5 — dispute of interpretation', url: 'https://journals.library.ualberta.ca/hssa/index.php/hssa/article/view/22', access: 'search-excerpt' },
  { id: 'S34', cite: 'Sambor (Khmer) inscription K-127, Śaka 605 = 683 CE (zero as dot); Gwalior Chaturbhuj temple, 876 CE (circular zero in "270")', url: 'https://old.maa.org/press/periodicals/convergence/mathematical-treasure-the-cambodian-zero', access: 'search-excerpt' },
  { id: 'S35', cite: 'Nakshatras: 27 (sometimes 28) ecliptic sectors of 13°20′, listed in the Vedāṅga Jyotiṣa; Moon ≈ one sector per day (sidereal month ≈ 27.3 d)', url: 'https://en.wikipedia.org/wiki/Nakshatra', access: 'search-excerpt' },
  { id: 'S36', cite: 'al-Khwārizmī (c. 825), book on calculation with Hindu numerals, Latin translation 12th c.; Fibonacci, Liber Abaci (1202) (Britannica)', url: 'https://www.britannica.com/topic/Liber-abaci', access: 'search-excerpt' },
  { id: 'S37', cite: 'Mādhava of Saṅgamagrāma (c. 1340–1425), Kerala school; series for π and arctan, reported in Jyeṣṭhadeva, Yuktibhāṣā (c. 1530)', url: 'https://assets.cambridge.org/97805211/14707/excerpt/9780521114707_excerpt.pdf', access: 'search-excerpt' },
  { id: 'S38', cite: 'Cantor G. (1891) diagonal argument; Gödel K. (1931), Monatshefte f. Math. u. Phys. 38; Turing A.M. (1936), Proc. LMS 2(42), 230', url: 'https://en.wikipedia.org/wiki/Cantor%27s_diagonal_argument', access: 'search-excerpt' },
  { id: 'S39', cite: 'Noether E. (1918), Invariante Variationsprobleme, Nachr. Ges. Wiss. Göttingen 235; Shannon C.E. (1948), A mathematical theory of communication; Guth A.H. (1981), Phys. Rev. D 23, 347', url: 'https://eudml.org/doc/59024', access: 'search-excerpt' },
  { id: 'S40', cite: 'Bousso R., Polchinski J. (2000), JHEP; Douglas M.R., statistics of string vacua — landscape estimate ~10⁵⁰⁰ vacua (speculative)', url: 'https://arxiv.org/abs/1208.5715', access: 'search-excerpt' },
  { id: 'S41', cite: 'Ellis R.J. (2001), Macromolecular crowding: obvious but underappreciated, Trends Biochem. Sci. 26, 597', url: 'https://pubmed.ncbi.nlm.nih.gov/11590012/', access: 'search-excerpt' },
  { id: 'S42', cite: 'Dartnall H.J.A., Bowmaker J.K., Mollon J.D. (1983), Human visual pigments, Proc. R. Soc. B 220, 115 — λmax rods 496.3, L 558.4, M 530.8, S 419.0 nm', url: 'https://pubmed.ncbi.nlm.nih.gov/6140680/', access: 'search-excerpt' },
  { id: 'TXT', cite: 'Standard textbook physics / mathematics (no source fetched in the build environment)', url: '', access: 'textbook' },
  { id: 'TEST', cite: 'Verified numerically by this project\'s unit tests (tests/*.test.ts)', url: '', access: 'textbook' },
];

export const CLAIMS: Claim[] = [
  // ── Chapter 1 · Observer ─────────────────────────────────────────────
  { id: 'C1.1', chapter: 1, claim: 'An adult human eye is about 24 mm long.', depiction: 'Procedural macro of an eye; scale bar.', level: 'ESTABLISHED', sources: ['S13'], note: 'Iris/cornea rendering is procedural, not a photograph.' },
  { id: 'C1.2', chapter: 1, claim: 'Light crosses the transparent neural layers of the retina before reaching the photoreceptors at the back.', depiction: 'Camera passes the retina’s inner layers before the photoreceptor mosaic.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C1.3', chapter: 1, claim: 'The fundus shows the optic disc, blood vessels and the macula with the fovea at its centre.', depiction: 'Procedural fundus (vessel tree generated, not traced from a real eye).', level: 'ESTABLISHED', sources: ['TXT'], note: 'Illustrative rendering.' },
  { id: 'C1.4', chapter: 1, claim: 'Foveal cones peak near 199,000 per mm² (range 100,000–324,000); a retina holds ~4.6 million cones.', depiction: 'Cone mosaic with realistic packing and density falling with eccentricity.', level: 'ESTABLISHED', sources: ['S7'] },
  { id: 'C1.5', chapter: 1, claim: 'S cones are absent from the central ~100 µm of the fovea.', depiction: 'No S cones in the mosaic centre.', level: 'ESTABLISHED', sources: ['S8'] },
  { id: 'C1.6', chapter: 1, claim: 'The ratio of L to M cones varies widely between people with normal colour vision (about 1.1:1 to 16.5:1).', depiction: 'Mosaic drawn with L:M ≈ 2:1, randomly arranged.', level: 'ESTABLISHED', sources: ['S9'] },
  { id: 'C1.7', chapter: 1, claim: 'Colours on the mosaic mark cone type (false colour). Cones themselves are not red, green or blue.', depiction: 'False-colour label.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C1.8', chapter: 1, claim: 'Light is absorbed in discrete quanta; absorptions arrive at random (Poisson) times and an image is their accumulated count.', depiction: 'A cell image forms from individual photon catches on the mosaic (simulated rates).', level: 'ESTABLISHED', sources: ['S12', 'TXT'], note: 'Photon rates are scaled for visibility (dim-light regime).' },

  // ── Chapter 2 · Inner scale ───────────────────────────────────────────
  { id: 'C2.1', chapter: 2, claim: 'A eukaryotic cell is typically 10–30 µm across; its nucleus a few µm; mitochondria ~0.5–1 µm wide.', depiction: 'Stylised cell with nucleus, mitochondria, cytoskeleton.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Illustrative; shapes simplified.' },
  { id: 'C2.2', chapter: 2, claim: 'The cytoplasm is densely crowded with macromolecules.', depiction: 'Dense particle crowding.', level: 'ESTABLISHED', sources: ['S41'] },
  { id: 'C2.3', chapter: 2, claim: 'In the nucleus, DNA wraps histone octamers: ~146 bp in ~1.65 left-handed turns per nucleosome.', depiction: 'Beads-on-a-string nucleosomes with left-handed wrapping.', level: 'ESTABLISHED', sources: ['S5'] },
  { id: 'C2.4', chapter: 2, claim: 'How chromatin folds above the nucleosome level inside living cells is still debated; the fibre shown is schematic.', depiction: 'Irregular polymer (random walk), no regular 30 nm fibre.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C2.5', chapter: 2, claim: 'B-DNA is ~2 nm wide, rises 0.34 nm per base pair and makes a turn every ~10.5 bp, with major and minor grooves.', depiction: 'Schematic atomic helix with those dimensions.', level: 'ESTABLISHED', sources: ['S6'], note: 'Atom positions are schematic, not crystallographic.' },
  { id: 'C2.6', chapter: 2, claim: 'Guanine pairs with cytosine through three hydrogen bonds (A–T through two).', depiction: 'G–C pair, ball-and-stick; H-bonds dashed.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C2.7', chapter: 2, claim: 'A covalent bond is a build-up of shared electron density between nuclei.', depiction: 'Density rendered as a sum of atomic densities (promolecule), an approximation.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Approximate density, not a quantum-chemistry calculation.' },
  { id: 'C2.8', chapter: 2, claim: 'Electrons do not orbit nuclei like planets; the planetary picture was abandoned a century ago.', depiction: 'The familiar atom icon dissolves into Born-rule samples.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C2.9', chapter: 2, claim: 'A hydrogen orbital is ψ_nlm = R_nl(r)Y_lm(θ,φ); |ψ|² gives the probability density of finding the electron.', depiction: 'Exact hydrogen |ψ|² raymarched; point samples drawn from |ψ|².', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C2.10', chapter: 2, claim: 'A stationary state’s |ψ|² does not change in time; a superposition of two energies oscillates at frequency (E₂−E₁)/h.', depiction: '(1s+2p)/√2 superposition sloshing (slowed ~10¹⁶×); phases shown relative to the 1s term.', level: 'ESTABLISHED', sources: ['TXT'] },

  // ── Chapter 3 · Quantum ───────────────────────────────────────────────
  { id: 'C3.1', chapter: 3, claim: 'The nucleus is roughly 10⁴–10⁵ times smaller than the atom.', depiction: 'Continuous zoom from the electron cloud to the nucleus.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C3.2', chapter: 3, claim: 'Nucleons in a nucleus are not hard balls; they are overlapping, fluctuating distributions.', depiction: 'Fuzzy nucleon densities (schematic arrangement).', level: 'ESTABLISHED', sources: ['TXT'], note: 'Positions schematic.' },
  { id: 'C3.3', chapter: 3, claim: 'The proton’s rms charge radius is 0.8414 fm.', depiction: 'Scale readout at the proton.', level: 'ESTABLISHED', sources: ['S2'] },
  { id: 'C3.4', chapter: 3, claim: 'A proton is three valence quarks (uud) within gluon fields and a sea of short-lived quark–antiquark pairs; colour charge is confined.', depiction: 'Illustrative, lattice-QCD-inspired rendering: action-density lumps, flux tubes, sea pairs.', level: 'ESTABLISHED', sources: ['S14', 'TXT'], note: 'Rendering is illustrative, not a lattice computation; the proton has no fixed geometry.' },
  { id: 'C3.5', chapter: 3, claim: 'Lattice QCD shows gluon flux tubes forming a Y shape between three static quarks at large separation.', depiction: 'Y-shaped flux tube between colour charges.', level: 'ESTABLISHED', sources: ['S14'] },
  { id: 'C3.6', chapter: 3, claim: 'A quantum field is a set of modes; particles are quantised excitations of those modes.', depiction: 'A field on a lattice with a travelling excitation; mode structure shown.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Zero-point jitter is illustrative.' },
  { id: 'C3.7', chapter: 3, claim: 'Single particles sent through a double slit arrive one at a time at random places; the interference pattern appears only in the accumulated record.', depiction: '2D Schrödinger evolution (split-step Fourier) plus Born-rule sampling of detections.', level: 'ESTABLISHED', sources: ['S15', 'TEST'], note: 'Units and slit geometry illustrative.' },
  { id: 'C3.8', chapter: 3, claim: 'The probability of a detection is proportional to |ψ|² (Born rule).', depiction: 'Detection positions sampled from the simulated |ψ|².', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C3.9', chapter: 3, claim: 'A spin-½ state lives in a two-dimensional complex space (a spinor); a 360° rotation multiplies it by −1, and only 720° restores it. Neutron interferometry confirmed this.', depiction: 'Bloch sphere with phase flag; belt (plate) trick showing the 4π structure.', level: 'ESTABLISHED', sources: ['S16'] },
  { id: 'C3.10', chapter: 3, claim: 'Spin is not a literal spinning ball.', depiction: 'Caption.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C3.11', chapter: 3, claim: 'For an entangled singlet, each side alone sees 50/50 random outcomes; the correlation (−cos θ) appears only when the records are compared. No signal travels between them.', depiction: 'Two detectors’ records; correlation revealed on comparison.', level: 'ESTABLISHED', sources: ['S17', 'TXT'] },

  // ── Chapter 4 · Sensory filter ────────────────────────────────────────
  { id: 'C4.1', chapter: 4, claim: 'Vision starts when 11-cis-retinal straightens to all-trans in about 200 femtoseconds.', depiction: 'Retinal isomerisation inside a seven-helix opsin (schematic).', level: 'ESTABLISHED', sources: ['S11'] },
  { id: 'C4.2', chapter: 4, claim: 'A rod can produce a quantised electrical response to a single photon.', depiction: 'Current trace step.', level: 'ESTABLISHED', sources: ['S12'] },
  { id: 'C4.3', chapter: 4, claim: 'Phototransduction cascade: rhodopsin → transducin → phosphodiesterase → cGMP falls → channels close → the cell hyperpolarises.', depiction: 'Amplifying cascade (schematic).', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C4.4', chapter: 4, claim: 'About 1.2 million ganglion-cell axons carry the retina’s output to the thalamus (LGN) and on to primary visual cortex (V1).', depiction: 'Schematic visual pathway with spikes.', level: 'ESTABLISHED', sources: ['S13', 'TXT'] },
  { id: 'C4.5', chapter: 4, claim: 'Colour is constructed from three cone signals: physically different spectra can produce identical cone responses and look identical (metamers).', depiction: 'Monochromatic yellow vs a red+green mixture yielding matched L,M,S.', level: 'ESTABLISHED', sources: ['S10', 'S42', 'TEST'] },
  { id: 'C4.6', chapter: 4, claim: 'Cone pigments absorb best near 558 nm (L), 531 nm (M) and 419 nm (S).', depiction: 'Govardovskii A1 templates at those λmax.', level: 'ESTABLISHED', sources: ['S42', 'S10'] },
  { id: 'C4.7', chapter: 4, claim: 'The hardness you feel is electrons repelling (electromagnetism plus Pauli exclusion) at ~10⁻¹⁰ m, reported by mechanoreceptors and interpreted by the brain.', depiction: 'Caption.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C4.8', chapter: 4, claim: 'Visible light (~380–750 nm) spans less than one-third of one decade of wavelength; the electromagnetic spectrum spans more than twenty.', depiction: 'True logarithmic wavelength axis.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Band edges are conventional.' },

  // ── Chapter 5 · Frequency & information ───────────────────────────────
  { id: 'C5.1', chapter: 5, claim: 'The jittery motion of a water molecule is a superposition of three normal modes: 3657, 1595 and 3756 cm⁻¹.', depiction: 'Harmonic model trajectory → FFT shows three spikes.', level: 'ESTABLISHED', sources: ['S3', 'S4', 'TEST'], note: 'Harmonic approximation; motion slowed ~10¹³×.' },
  { id: 'C5.2', chapter: 5, claim: 'The Fourier transform splits a signal into frequencies and is exactly invertible.', depiction: 'Signal ⇄ spectrum round trip.', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C5.3', chapter: 5, claim: 'A quantum harmonic oscillator has evenly spaced energy levels Eₙ = ħω(n+½).', depiction: 'Levels with Hermite-function densities.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C5.4', chapter: 5, claim: 'A chain of coupled oscillators moves as a sum of standing-wave normal modes — the same mathematics as field modes.', depiction: 'Chain of masses decomposed into modes.', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C5.5', chapter: 5, claim: 'Entropy S = k_B ln W counts the microstates W compatible with a macrostate.', depiction: 'Ideal-gas free expansion; coarse-grained histogram; many microstate ghosts collapse to one macrostate.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C5.6', chapter: 5, claim: 'Gibbs/Shannon entropy −Σ p ln p measures missing information about the microstate given a coarse-grained description.', depiction: 'Live entropy readout of the coarse-grained distribution.', level: 'ESTABLISHED', sources: ['S39', 'TXT'] },

  // ── Chapter 6 · Life as information ───────────────────────────────────
  { id: 'C6.1', chapter: 6, claim: 'Sequence information flows DNA → RNA → protein.', depiction: 'Transcription then translation.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C6.2', chapter: 6, claim: 'The genetic code maps 64 codons to 20 amino acids and stop signals; tRNAs implement the lookup.', depiction: 'Codon table lights up as a ribosome reads (standard code).', level: 'ESTABLISHED', sources: ['TXT', 'TEST'], note: 'Sequence shown is illustrative, not a real gene.' },
  { id: 'C6.3', chapter: 6, claim: 'A ribosome reads mRNA three bases at a time, 5′ to 3′.', depiction: 'Schematic ribosome and growing chain.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C6.4', chapter: 6, claim: 'A protein’s amino-acid sequence largely determines how it folds.', depiction: 'Chain collapses into a compact fold (schematic).', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C6.5', chapter: 6, claim: 'Evolution: heritable variation plus selection changes sequence frequencies over generations.', depiction: 'Seeded branching simulation; tree of lineages.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Illustrative simulation.' },

  // ── Chapter 7 · Spacetime ─────────────────────────────────────────────
  { id: 'C7.1', chapter: 7, claim: 'A tesseract is a four-dimensional cube; what we can draw is its three-dimensional shadow.', depiction: '4D rotation, perspective projection.', level: 'ESTABLISHED', sources: ['TXT'], note: 'Euclidean 4D — not spacetime.' },
  { id: 'C7.2', chapter: 7, claim: 'Spacetime is four-dimensional but not Euclidean: the interval s² = c²t² − x² is the same for all inertial observers.', depiction: 'Invariant hyperbolae stay fixed under boosts.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C7.3', chapter: 7, claim: 'Events simultaneous for one observer are not simultaneous for another moving relative to them.', depiction: 'Two families of simultaneity slices tilt against each other across the same worldlines.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C7.4', chapter: 7, claim: 'Light travels on the 45° cone; massive objects stay inside it.', depiction: 'Light cones.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C7.5', chapter: 7, claim: 'Clocks measure proper time τ = ∫√(1−v²/c²) dt; between two events the unaccelerated path ages most. Flown atomic clocks confirmed such effects.', depiction: 'Twin worldlines with equal-proper-time ticks.', level: 'ESTABLISHED', sources: ['S18', 'TXT'] },
  { id: 'C7.6', chapter: 7, claim: 'The “block universe” — all times equally real — is an interpretation consistent with relativity, not an experimental result.', depiction: 'Static spacetime sculpture of worldlines.', level: 'INTERPRETATION', sources: ['TXT'] },

  // ── Chapter 8 · Gravity ───────────────────────────────────────────────
  { id: 'C8.1', chapter: 8, claim: 'The curved space around a mass can be drawn as Flamm’s paraboloid; the vertical direction in the drawing is not a real direction.', depiction: 'Exact embedding z = 2√(r_s(r−r_s)).', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C8.2', chapter: 8, claim: 'Free fall follows geodesics; close to a compact mass orbits precess.', depiction: 'Integrated Schwarzschild timelike geodesic (rosette).', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C8.3', chapter: 8, claim: 'Light bends around a mass; the view of the sky is lensed into an Einstein ring and multiple images.', depiction: 'Per-pixel Schwarzschild null-geodesic ray tracing.', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C8.4', chapter: 8, claim: 'Light can circle a black hole at the photon sphere r = 1.5 r_s; rays with impact parameter below (3√3/2) r_s are captured; the event horizon is at r_s.', depiction: 'Labels on the ray-traced image.', level: 'ESTABLISHED', sources: ['S19'] },
  { id: 'C8.5', chapter: 8, claim: 'No stable circular orbit exists inside 3 r_s, so a thin disk’s inner edge lies there.', depiction: 'Disk from 3 r_s outward; brightness and colour schematic.', level: 'ESTABLISHED', sources: ['S19'], note: 'Disk emission profile illustrative; Doppler beaming approximate.' },
  { id: 'C8.6', chapter: 8, claim: 'In 2019 the Event Horizon Telescope imaged the shadow of M87*: a ring 42 µas across.', depiction: 'Caption.', level: 'ESTABLISHED', sources: ['S20'] },
  { id: 'C8.7', chapter: 8, claim: 'A clock held static at radius r ticks slower by √(1 − r_s/r) relative to a distant clock.', depiction: 'Clock rates at 1.5 r_s, 3 r_s, 10 r_s.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C8.8', chapter: 8, claim: 'Inside the horizon every future path reaches r = 0, where classical general relativity predicts infinite curvature — a sign the theory fails there, not a known physical object.', depiction: 'Light cones tipping inward (Eddington–Finkelstein); the grid breaks down at r = 0.', level: 'ESTABLISHED', sources: ['TXT'], note: 'What replaces the singularity is unknown (speculative).' },
  { id: 'C8.9', chapter: 8, claim: 'A black hole’s entropy is its horizon area in Planck units divided by four: S = A/4.', depiction: 'Horizon tiled by Planck-area cells (schematic, astronomically coarse).', level: 'ESTABLISHED', sources: ['S21'], note: 'Theoretical result; Hawking radiation has not been observed from astrophysical black holes.' },
  { id: 'C8.10', chapter: 8, claim: 'Whether information that falls in comes back out in the radiation — the information problem — is open. Recent calculations reproduce a Page curve, but the mechanism is debated.', depiction: 'Ghosted Page curve over thermal Hawking curve.', level: 'SPECULATIVE', sources: ['S22'] },

  // ── Chapter 9 · Mathematics ───────────────────────────────────────────
  { id: 'C9.1', chapter: 9, claim: 'Brahmagupta’s Brāhmasphuṭasiddhānta (628 CE) gave rules for calculating with zero and negative numbers.', depiction: 'Historical caption; numerals.', level: 'ESTABLISHED', sources: ['S31'] },
  { id: 'C9.2', chapter: 9, claim: 'Āryabhaṭa’s Āryabhaṭīya (499 CE) gives a circumference of 62,832 for diameter 20,000: π ≈ 3.1416.', depiction: 'Circle with ratio.', level: 'ESTABLISHED', sources: ['S32'] },
  { id: 'C9.3', chapter: 9, claim: 'The Bakhshālī manuscript’s folios radiocarbon-date to 224–383, 680–779 and 885–993 CE; what this means for its zero is disputed.', depiction: 'Date ranges drawn as uncertainty bars.', level: 'ESTABLISHED', sources: ['S33'] },
  { id: 'C9.4', chapter: 9, claim: 'Dated inscriptions show zero as a dot at Sambor (683 CE) and as a circle at Gwalior (876 CE).', depiction: 'Timeline marks.', level: 'ESTABLISHED', sources: ['S34'] },
  { id: 'C9.5', chapter: 9, claim: 'The 27 nakshatras divide the ecliptic into 13°20′ sectors; the Moon crosses about one per day, which made calendar computation possible.', depiction: 'Ring of 27 sectors with the Moon advancing.', level: 'ESTABLISHED', sources: ['S35'] },
  { id: 'C9.6', chapter: 9, claim: 'Indian place-value numerals reached Europe via al-Khwārizmī (c. 825) and Fibonacci’s Liber Abaci (1202).', depiction: 'Transmission line.', level: 'ESTABLISHED', sources: ['S36'] },
  { id: 'C9.7', chapter: 9, claim: 'Mādhava of Saṅgamagrāma (c. 1340–1425) found the infinite series π/4 = 1 − 1/3 + 1/5 − ….', depiction: 'Partial sums converging.', level: 'ESTABLISHED', sources: ['S37', 'TEST'] },
  { id: 'C9.8', chapter: 9, claim: 'There are infinitely many primes, yet their positions look irregular.', depiction: 'Sieve / spiral of the integers.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C9.9', chapter: 9, claim: 'The number of partitions p(n) grows like e^{π√(2n/3)}/(4n√3) (Hardy–Ramanujan, 1918).', depiction: 'Young diagrams; p(n) against the asymptotic curve.', level: 'ESTABLISHED', sources: ['S29', 'TEST'] },
  { id: 'C9.10', chapter: 9, claim: 'The partition generating function is essentially 1/η, a modular form; its symmetry under τ → −1/τ is what makes an exact formula for p(n) possible.', depiction: 'Domain colouring of a modular form on the hyperbolic disk.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C9.11', chapter: 9, claim: 'Continued fractions give best rational approximations: π = [3; 7, 15, 1, 292, …] yields 22/7 and 355/113.', depiction: 'Nested fraction convergents.', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C9.12', chapter: 9, claim: 'Ramanujan’s 1914 series for 1/π adds about eight correct digits per term.', depiction: 'Digits locking in term by term.', level: 'ESTABLISHED', sources: ['S30', 'TEST'] },
  { id: 'C9.13', chapter: 9, claim: 'The zeta function’s non-trivial zeros computed here all lie on Re(s) = ½; the Riemann hypothesis is verified to height 3·10¹² but unproven.', depiction: 'Numerically computed ζ(½+it) and its zeros.', level: 'ESTABLISHED', sources: ['S27', 'S28', 'TEST'] },
  { id: 'C9.14', chapter: 9, claim: 'Riemann’s explicit formula rebuilds the prime staircase from waves, one per zeta zero.', depiction: 'ψ(x) reconstructed from the first N computed zeros.', level: 'ESTABLISHED', sources: ['TXT', 'TEST'] },
  { id: 'C9.15', chapter: 9, claim: 'Any list of infinite binary sequences misses one: flip the diagonal. Some infinities are larger than others (Cantor, 1891).', depiction: 'Diagonal construction.', level: 'ESTABLISHED', sources: ['S38'] },
  { id: 'C9.16', chapter: 9, claim: 'No algorithm can decide, for every program and input, whether it halts (Turing, 1936) — the same diagonal move.', depiction: 'Program × input table, diagonal flipped.', level: 'ESTABLISHED', sources: ['S38'] },
  { id: 'C9.17', chapter: 9, claim: 'Any consistent formal system strong enough for arithmetic has true statements it cannot prove (Gödel, 1931). A limit on formal systems — not on knowledge in general.', depiction: 'Caption.', level: 'ESTABLISHED', sources: ['S38'] },
  { id: 'C9.18', chapter: 9, claim: 'Every continuous symmetry of a physical law implies a conserved quantity (Noether, 1918): time ↔ energy, space ↔ momentum, rotation ↔ angular momentum.', depiction: 'Orbit sweeping equal areas (rotational symmetry → angular momentum).', level: 'ESTABLISHED', sources: ['S39', 'TEST'] },

  // ── Chapter 10 · Cosmos ───────────────────────────────────────────────
  { id: 'C10.1', chapter: 10, claim: 'Earth’s mean radius is 6,371 km; the Moon is ~384,400 km away; 1 au = 149,597,870,700 m.', depiction: 'Scale zoom.', level: 'ESTABLISHED', sources: ['TXT'] },
  { id: 'C10.2', chapter: 10, claim: 'The nearest star, Proxima Centauri, is 1.30 pc (4.2 light-years) away.', depiction: 'Local star field (procedural, realistic density).', level: 'ESTABLISHED', sources: ['TXT'], note: 'Star positions procedural except labelled stars.' },
  { id: 'C10.3', chapter: 10, claim: 'The Sun is ~8.2 kpc from the centre of the Milky Way, a barred spiral.', depiction: 'Illustrative particle model of the Galaxy.', level: 'ESTABLISHED', sources: ['S23'] },
  { id: 'C10.4', chapter: 10, claim: 'Andromeda is ~765 kpc (2.5 million light-years) away.', depiction: 'Local Group.', level: 'ESTABLISHED', sources: ['S26'] },
  { id: 'C10.5', chapter: 10, claim: 'Looking farther means looking earlier: light from distant galaxies left them long ago.', depiction: 'Galaxies coloured and shaped by look-back time (younger, bluer, more irregular farther out).', level: 'ESTABLISHED', sources: ['S1', 'TEST'], note: 'Galaxy appearance evolution schematic.' },
  { id: 'C10.6', chapter: 10, claim: 'The cosmic web grew by gravity from tiny initial fluctuations.', depiction: "Zel'dovich approximation (first-order Lagrangian perturbation theory) on a Gaussian random field — not a full N-body simulation.", level: 'ESTABLISHED', sources: ['S25'], note: 'Power spectrum schematic.' },
  { id: 'C10.7', chapter: 10, claim: 'ΛCDM with Planck 2018 parameters: H₀ = 67.4 km/s/Mpc, Ωm = 0.315, age 13.79 Gyr.', depiction: 'Distances and ages computed from these parameters.', level: 'ESTABLISHED', sources: ['S1', 'TEST'] },
  { id: 'C10.8', chapter: 10, claim: 'Three different distances: light-travel distance (≤13.8 Gly), Hubble radius c/H₀ (≈14.5 Gly) and particle horizon (≈46 Gly comoving).', depiction: 'Three labelled shells.', level: 'ESTABLISHED', sources: ['S24', 'TEST'] },
  { id: 'C10.9', chapter: 10, claim: 'The observable universe is a horizon — the limit of what light has had time to bring us — not a wall or the edge of the universe.', depiction: 'Horizon shell rendered soft and open.', level: 'ESTABLISHED', sources: ['S24'] },
  { id: 'C10.10', chapter: 10, claim: 'The cosmic microwave background is light released ~380,000 years after the Big Bang (z ≈ 1100).', depiction: 'Outermost shell; anisotropy pattern illustrative, not the Planck map.', level: 'ESTABLISHED', sources: ['S1', 'TXT'] },

  // ── Chapter 11 · Frontier ─────────────────────────────────────────────
  { id: 'C11.1', chapter: 11, claim: 'Inflation — a brief exponential expansion before the hot Big Bang — is a leading hypothesis, not yet confirmed.', depiction: 'Ghosted stretching grid.', level: 'SPECULATIVE', sources: ['S39'] },
  { id: 'C11.2', chapter: 11, claim: 'Eternal inflation and a multiverse of bubble universes are speculative extensions.', depiction: 'Dithered, incomplete bubbles.', level: 'SPECULATIVE', sources: ['TXT'] },
  { id: 'C11.3', chapter: 11, claim: 'String theory may allow an enormous “landscape” of vacua (estimates ~10⁵⁰⁰).', depiction: 'Partially drawn potential surface.', level: 'SPECULATIVE', sources: ['S40'] },
  { id: 'C11.4', chapter: 11, claim: 'No theory of quantum gravity has been confirmed by experiment; candidates include strings and loop quantum gravity.', depiction: 'Ghosted spin network and vibrating loops.', level: 'SPECULATIVE', sources: ['TXT'] },
  { id: 'C11.5', chapter: 11, claim: 'Spacetime might emerge from something deeper, such as quantum entanglement.', depiction: 'Graph condensing into a surface.', level: 'SPECULATIVE', sources: ['TXT'] },
  { id: 'C11.6', chapter: 11, claim: 'Extra spatial dimensions have not been observed; if they exist they are small or hidden.', depiction: 'Calabi–Yau cross-section (a real mathematical surface; its physical role speculative).', level: 'SPECULATIVE', sources: ['TXT'] },

  // ── Chapter 12 · Synthesis ────────────────────────────────────────────
  { id: 'C12.1', chapter: 12, claim: 'Everything shown reached you as light absorbed by a mosaic of cells.', depiction: 'Representations merge; the zoom ends on the cone mosaic.', level: 'ESTABLISHED', sources: ['TXT'] },
];

export const EQUATIONS: Equation[] = [
  { id: 'E1.1', chapter: 1, latex: 'P(k)=\\frac{(\\lambda t)^k\\,e^{-\\lambda t}}{k!}', meaning: 'Poisson probability of k photon absorptions in time t at rate λ.', claim: 'C1.8' },
  { id: 'E2.1', chapter: 2, latex: '\\psi_{n\\ell m}(r,\\theta,\\varphi)=R_{n\\ell}(r)\\,Y_{\\ell}^{m}(\\theta,\\varphi)', meaning: 'Hydrogen eigenfunctions.', claim: 'C2.9' },
  { id: 'E2.2', chapter: 2, latex: 'P(\\mathbf r)\\,dV=|\\psi(\\mathbf r)|^2\\,dV', meaning: 'Born rule.', claim: 'C2.9' },
  { id: 'E2.3', chapter: 2, latex: 'E_n=-\\frac{13.6\\ \\text{eV}}{n^2}', meaning: 'Hydrogen energy levels.', claim: 'C2.10' },
  { id: 'E3.1', chapter: 3, latex: 'i\\hbar\\,\\frac{\\partial\\psi}{\\partial t}=-\\frac{\\hbar^2}{2m}\\nabla^2\\psi+V\\psi', meaning: 'Time-dependent Schrödinger equation (simulated for the double slit).', claim: 'C3.7' },
  { id: 'E3.2', chapter: 3, latex: 'P(x)\\propto|\\psi_1(x)+\\psi_2(x)|^2', meaning: 'Two-path interference.', claim: 'C3.8' },
  { id: 'E3.3', chapter: 3, latex: 'H=\\sum_k \\hbar\\omega_k\\left(a_k^{\\dagger}a_k+\\tfrac12\\right)', meaning: 'A free field as a sum of oscillator modes.', claim: 'C3.6' },
  { id: 'E3.4', chapter: 3, latex: '|\\psi\\rangle=\\cos\\tfrac{\\theta}{2}\\,|{\\uparrow}\\rangle+e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|{\\downarrow}\\rangle', meaning: 'Spin-½ state on the Bloch sphere.', claim: 'C3.9' },
  { id: 'E3.5', chapter: 3, latex: 'R(2\\pi)=-\\mathbb{1},\\qquad R(4\\pi)=+\\mathbb{1}', meaning: 'Spinor rotation phase.', claim: 'C3.9' },
  { id: 'E3.6', chapter: 3, latex: '\\langle A\\,B\\rangle=-\\cos\\theta_{ab}', meaning: 'Singlet correlation of outcomes.', claim: 'C3.11' },
  { id: 'E4.1', chapter: 4, latex: 'L=\\int S(\\lambda)\\,\\bar l(\\lambda)\\,d\\lambda', meaning: 'Cone response integrates the spectrum against its sensitivity (likewise M, S).', claim: 'C4.5' },
  { id: 'E5.1', chapter: 5, latex: '\\hat f(\\nu)=\\int f(t)\\,e^{-2\\pi i\\nu t}\\,dt', meaning: 'Fourier transform.', claim: 'C5.2' },
  { id: 'E5.2', chapter: 5, latex: 'E_n=\\hbar\\omega\\left(n+\\tfrac12\\right)', meaning: 'Oscillator levels.', claim: 'C5.3' },
  { id: 'E5.3', chapter: 5, latex: 'S=k_B\\ln W', meaning: 'Boltzmann entropy.', claim: 'C5.5' },
  { id: 'E5.4', chapter: 5, latex: 'H=-\\sum_i p_i\\log_2 p_i', meaning: 'Shannon entropy.', claim: 'C5.6' },
  { id: 'E6.1', chapter: 6, latex: '\\text{DNA}\\;\\to\\;\\text{RNA}\\;\\to\\;\\text{protein}', meaning: 'Flow of sequence information.', claim: 'C6.1' },
  { id: 'E7.1', chapter: 7, latex: 's^2=c^2t^2-x^2', meaning: 'Invariant interval.', claim: 'C7.2' },
  { id: 'E7.2', chapter: 7, latex: "t'=\\gamma\\left(t-\\frac{v x}{c^2}\\right),\\quad x'=\\gamma\\,(x-vt)", meaning: 'Lorentz transformation.', claim: 'C7.3' },
  { id: 'E7.3', chapter: 7, latex: '\\tau=\\int\\sqrt{1-v^2/c^2}\\;dt', meaning: 'Proper time.', claim: 'C7.5' },
  { id: 'E8.1', chapter: 8, latex: '\\frac{d^2u}{d\\varphi^2}+u=\\frac{3}{2}\\,r_s\\,u^2,\\qquad u=\\frac1r', meaning: 'Schwarzschild null geodesic (ray traced per pixel).', claim: 'C8.3' },
  { id: 'E8.2', chapter: 8, latex: '\\frac{d\\tau}{dt}=\\sqrt{1-\\frac{r_s}{r}}', meaning: 'Static clock rate.', claim: 'C8.7' },
  { id: 'E8.3', chapter: 8, latex: 'S=\\frac{A}{4}\\quad(\\text{Planck units})', meaning: 'Bekenstein–Hawking entropy.', claim: 'C8.9' },
  { id: 'E9.1', chapter: 9, latex: '\\sum_{n\\ge0}p(n)\\,q^n=\\prod_{k\\ge1}\\frac{1}{1-q^k}', meaning: 'Partition generating function (Euler).', claim: 'C9.10' },
  { id: 'E9.2', chapter: 9, latex: 'p(n)\\sim\\frac{1}{4n\\sqrt3}\\,e^{\\pi\\sqrt{2n/3}}', meaning: 'Hardy–Ramanujan asymptotic.', claim: 'C9.9' },
  { id: 'E9.3', chapter: 9, latex: '\\frac1\\pi=\\frac{2\\sqrt2}{9801}\\sum_{k=0}^{\\infty}\\frac{(4k)!\\,(1103+26390k)}{(k!)^4\\,396^{4k}}', meaning: 'Ramanujan 1914.', claim: 'C9.12' },
  { id: 'E9.4', chapter: 9, latex: '\\zeta(s)=\\sum_{n=1}^{\\infty}\\frac1{n^s}=\\prod_{p}\\frac{1}{1-p^{-s}}', meaning: 'Zeta function and Euler product.', claim: 'C9.13' },
  { id: 'E9.5', chapter: 9, latex: '\\psi(x)=x-\\sum_{\\rho}\\frac{x^{\\rho}}{\\rho}-\\log 2\\pi-\\tfrac12\\log\\!\\left(1-x^{-2}\\right)', meaning: 'Riemann–von Mangoldt explicit formula.', claim: 'C9.14' },
  { id: 'E9.6', chapter: 9, latex: '\\frac{\\pi}{4}=1-\\frac13+\\frac15-\\frac17+\\cdots', meaning: 'Mādhava series.', claim: 'C9.7' },
  { id: 'E9.7', chapter: 9, latex: '\\pi=3+\\cfrac{1}{7+\\cfrac{1}{15+\\cfrac{1}{1+\\cfrac{1}{292+\\cdots}}}}', meaning: 'Continued fraction of π.', claim: 'C9.11' },
  { id: 'E9.8', chapter: 9, latex: '\\frac{\\partial L}{\\partial \\theta}=0\\;\\Longrightarrow\\;\\frac{d}{dt}\\,\\frac{\\partial L}{\\partial\\dot\\theta}=0', meaning: 'Rotational symmetry ⇒ conserved angular momentum.', claim: 'C9.18' },
  { id: 'E10.1', chapter: 10, latex: 'H(z)=H_0\\sqrt{\\Omega_m(1+z)^3+\\Omega_\\Lambda}', meaning: 'Flat ΛCDM expansion rate (radiation included in the code).', claim: 'C10.7' },
  { id: 'E10.2', chapter: 10, latex: '\\mathbf x(\\mathbf q,t)=\\mathbf q-D(t)\\,\\nabla_{\\mathbf q}\\Phi(\\mathbf q)', meaning: "Zel'dovich approximation.", claim: 'C10.6' },
];

export function claimById(id: string): Claim | undefined {
  return CLAIMS.find((c) => c.id === id);
}
export function equationById(id: string): Equation | undefined {
  return EQUATIONS.find((e) => e.id === id);
}

/** Highest-uncertainty level among a set of claims. */
export function highestLevel(levels: Epistemic[]): Epistemic {
  if (levels.includes('SPECULATIVE')) return 'SPECULATIVE';
  if (levels.includes('INTERPRETATION')) return 'INTERPRETATION';
  return 'ESTABLISHED';
}
