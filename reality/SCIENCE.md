# SCIENCE.md — claim ledger

_Generated from `src/content/ledger.ts` by `npm run ledger`. Do not edit by hand._

Every caption and equation shown on screen references a row below (checked by `tests/ledger.test.ts`).
Epistemic levels: **ESTABLISHED** (experimentally or mathematically settled), **INTERPRETATION** (a reading of established physics that is not itself testable), **SPECULATIVE** (hypotheses without confirming evidence, or open problems).

## How sources were consulted

Fetching web pages was **blocked** by the build environment's network policy (arxiv.org, nist.gov, nature.com, aanda.org, adsabs, wikipedia.org all returned egress-blocked). A web *search* tool was available, and it returns excerpts of the result pages. Sources marked `search-excerpt` were checked **only against those excerpts** for the specific fact cited; the full papers were not read. Rows citing `TXT` rely on standard textbook physics or mathematics for which no source was fetched. `TEST` means the statement is also verified numerically by this project's unit tests.

## Claims

### Chapter 1 · Observer

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C1.1 | An adult human eye is about 24 mm long. | Procedural macro of an eye; scale bar. | **ESTABLISHED** | S13 | Iris/cornea rendering is procedural, not a photograph. |
| C1.2 | Light crosses the transparent neural layers of the retina before reaching the photoreceptors at the back. | Camera passes the retina’s inner layers before the photoreceptor mosaic. | **ESTABLISHED** | TXT |  |
| C1.3 | The fundus shows the optic disc, blood vessels and the macula with the fovea at its centre. | Procedural fundus (vessel tree generated, not traced from a real eye). | **ESTABLISHED** | TXT | Illustrative rendering. |
| C1.4 | Foveal cones peak near 199,000 per mm² (range 100,000–324,000); a retina holds ~4.6 million cones. | Cone mosaic with realistic packing and density falling with eccentricity. | **ESTABLISHED** | S7 |  |
| C1.5 | S cones are absent from the central ~100 µm of the fovea. | No S cones in the mosaic centre. | **ESTABLISHED** | S8 |  |
| C1.6 | The ratio of L to M cones varies widely between people with normal colour vision (about 1.1:1 to 16.5:1). | Mosaic drawn with L:M ≈ 2:1, randomly arranged. | **ESTABLISHED** | S9 |  |
| C1.7 | Colours on the mosaic mark cone type (false colour). Cones themselves are not red, green or blue. | False-colour label. | **ESTABLISHED** | TXT |  |
| C1.8 | Light is absorbed in discrete quanta; absorptions arrive at random (Poisson) times and an image is their accumulated count. | A cell image forms from individual photon catches on the mosaic (simulated rates). | **ESTABLISHED** | S12, TXT | Photon rates are scaled for visibility (dim-light regime). |

### Chapter 2 · Inner scale

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C2.1 | A eukaryotic cell is typically 10–30 µm across; its nucleus a few µm; mitochondria ~0.5–1 µm wide. | Stylised cell with nucleus, mitochondria, cytoskeleton. | **ESTABLISHED** | TXT | Illustrative; shapes simplified. |
| C2.2 | The cytoplasm is densely crowded with macromolecules. | Dense particle crowding. | **ESTABLISHED** | S41 |  |
| C2.3 | In the nucleus, DNA wraps histone octamers: ~146 bp in ~1.65 left-handed turns per nucleosome. | Beads-on-a-string nucleosomes with left-handed wrapping. | **ESTABLISHED** | S5 |  |
| C2.4 | How chromatin folds above the nucleosome level inside living cells is still debated; the fibre shown is schematic. | Irregular polymer (random walk), no regular 30 nm fibre. | **ESTABLISHED** | TXT |  |
| C2.5 | B-DNA is ~2 nm wide, rises 0.34 nm per base pair and makes a turn every ~10.5 bp, with major and minor grooves. | Schematic atomic helix with those dimensions. | **ESTABLISHED** | S6 | Atom positions are schematic, not crystallographic. |
| C2.6 | Guanine pairs with cytosine through three hydrogen bonds (A–T through two). | G–C pair, ball-and-stick; H-bonds dashed. | **ESTABLISHED** | TXT |  |
| C2.7 | A covalent bond is a build-up of shared electron density between nuclei. | Density rendered as a sum of atomic densities (promolecule), an approximation. | **ESTABLISHED** | TXT | Approximate density, not a quantum-chemistry calculation. |
| C2.8 | Electrons do not orbit nuclei like planets; the planetary picture was abandoned a century ago. | The familiar atom icon dissolves into Born-rule samples. | **ESTABLISHED** | TXT |  |
| C2.9 | A hydrogen orbital is ψ_nlm = R_nl(r)Y_lm(θ,φ); \|ψ\|² gives the probability density of finding the electron. | Exact hydrogen \|ψ\|² raymarched; point samples drawn from \|ψ\|². | **ESTABLISHED** | TXT, TEST |  |
| C2.10 | A stationary state’s \|ψ\|² does not change in time; a superposition of two energies oscillates at frequency (E₂−E₁)/h. | (1s+2p)/√2 superposition sloshing (slowed ~10¹⁶×); phases shown relative to the 1s term. | **ESTABLISHED** | TXT |  |

### Chapter 3 · Quantum

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C3.1 | The nucleus is roughly 10⁴–10⁵ times smaller than the atom. | Continuous zoom from the electron cloud to the nucleus. | **ESTABLISHED** | TXT |  |
| C3.2 | Nucleons in a nucleus are not hard balls; they are overlapping, fluctuating distributions. | Fuzzy nucleon densities (schematic arrangement). | **ESTABLISHED** | TXT | Positions schematic. |
| C3.3 | The proton’s rms charge radius is 0.8414 fm. | Scale readout at the proton. | **ESTABLISHED** | S2 |  |
| C3.4 | A proton is three valence quarks (uud) within gluon fields and a sea of short-lived quark–antiquark pairs; colour charge is confined. | Illustrative, lattice-QCD-inspired rendering: action-density lumps, flux tubes, sea pairs. | **ESTABLISHED** | S14, TXT | Rendering is illustrative, not a lattice computation; the proton has no fixed geometry. |
| C3.5 | Lattice QCD shows gluon flux tubes forming a Y shape between three static quarks at large separation. | Y-shaped flux tube between colour charges. | **ESTABLISHED** | S14 |  |
| C3.6 | A quantum field is a set of modes; particles are quantised excitations of those modes. | A field on a lattice with a travelling excitation; mode structure shown. | **ESTABLISHED** | TXT | Zero-point jitter is illustrative. |
| C3.7 | Single particles sent through a double slit arrive one at a time at random places; the interference pattern appears only in the accumulated record. | 2D Schrödinger evolution (split-step Fourier) plus Born-rule sampling of detections. | **ESTABLISHED** | S15, TEST | Units and slit geometry illustrative. |
| C3.8 | The probability of a detection is proportional to \|ψ\|² (Born rule). | Detection positions sampled from the simulated \|ψ\|². | **ESTABLISHED** | TXT |  |
| C3.9 | A spin-½ state lives in a two-dimensional complex space (a spinor); a 360° rotation multiplies it by −1, and only 720° restores it. Neutron interferometry confirmed this. | Bloch sphere with phase flag; belt (plate) trick showing the 4π structure. | **ESTABLISHED** | S16 |  |
| C3.10 | Spin is not a literal spinning ball. | Caption. | **ESTABLISHED** | TXT |  |
| C3.11 | For an entangled singlet, each side alone sees 50/50 random outcomes; the correlation (−cos θ) appears only when the records are compared. No signal travels between them. | Two detectors’ records; correlation revealed on comparison. | **ESTABLISHED** | S17, TXT |  |

### Chapter 4 · Sensory filter

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C4.1 | Vision starts when 11-cis-retinal straightens to all-trans in about 200 femtoseconds. | Retinal isomerisation inside a seven-helix opsin (schematic). | **ESTABLISHED** | S11 |  |
| C4.2 | A rod can produce a quantised electrical response to a single photon. | Current trace step. | **ESTABLISHED** | S12 |  |
| C4.3 | Phototransduction cascade: rhodopsin → transducin → phosphodiesterase → cGMP falls → channels close → the cell hyperpolarises. | Amplifying cascade (schematic). | **ESTABLISHED** | TXT |  |
| C4.4 | About 1.2 million ganglion-cell axons carry the retina’s output to the thalamus (LGN) and on to primary visual cortex (V1). | Schematic visual pathway with spikes. | **ESTABLISHED** | S13, TXT |  |
| C4.5 | Colour is constructed from three cone signals: physically different spectra can produce identical cone responses and look identical (metamers). | Monochromatic yellow vs a red+green mixture yielding matched L,M,S. | **ESTABLISHED** | S10, S42, TEST |  |
| C4.6 | Cone pigments absorb best near 558 nm (L), 531 nm (M) and 419 nm (S). | Govardovskii A1 templates at those λmax. | **ESTABLISHED** | S42, S10 |  |
| C4.7 | The hardness you feel is electrons repelling (electromagnetism plus Pauli exclusion) at ~10⁻¹⁰ m, reported by mechanoreceptors and interpreted by the brain. | Caption. | **ESTABLISHED** | TXT |  |
| C4.8 | Visible light (~380–750 nm) spans less than one-third of one decade of wavelength; the electromagnetic spectrum spans more than twenty. | True logarithmic wavelength axis. | **ESTABLISHED** | TXT | Band edges are conventional. |

### Chapter 5 · Frequency & information

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C5.1 | The jittery motion of a water molecule is a superposition of three normal modes: 3657, 1595 and 3756 cm⁻¹. | Harmonic model trajectory → FFT shows three spikes. | **ESTABLISHED** | S3, S4, TEST | Harmonic approximation; motion slowed ~10¹³×. |
| C5.2 | The Fourier transform splits a signal into frequencies and is exactly invertible. | Signal ⇄ spectrum round trip. | **ESTABLISHED** | TXT, TEST |  |
| C5.3 | A quantum harmonic oscillator has evenly spaced energy levels Eₙ = ħω(n+½). | Levels with Hermite-function densities. | **ESTABLISHED** | TXT |  |
| C5.4 | A chain of coupled oscillators moves as a sum of standing-wave normal modes — the same mathematics as field modes. | Chain of masses decomposed into modes. | **ESTABLISHED** | TXT, TEST |  |
| C5.5 | Entropy S = k_B ln W counts the microstates W compatible with a macrostate. | Ideal-gas free expansion; coarse-grained histogram; many microstate ghosts collapse to one macrostate. | **ESTABLISHED** | TXT |  |
| C5.6 | Gibbs/Shannon entropy −Σ p ln p measures missing information about the microstate given a coarse-grained description. | Live entropy readout of the coarse-grained distribution. | **ESTABLISHED** | S39, TXT |  |

### Chapter 6 · Life as information

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C6.1 | Sequence information flows DNA → RNA → protein. | Transcription then translation. | **ESTABLISHED** | TXT |  |
| C6.2 | The genetic code maps 64 codons to 20 amino acids and stop signals; tRNAs implement the lookup. | Codon table lights up as a ribosome reads (standard code). | **ESTABLISHED** | TXT, TEST | Sequence shown is illustrative, not a real gene. |
| C6.3 | A ribosome reads mRNA three bases at a time, 5′ to 3′. | Schematic ribosome and growing chain. | **ESTABLISHED** | TXT |  |
| C6.4 | A protein’s amino-acid sequence largely determines how it folds. | Chain collapses into a compact fold (schematic). | **ESTABLISHED** | TXT |  |
| C6.5 | Evolution: heritable variation plus selection changes sequence frequencies over generations. | Seeded branching simulation; tree of lineages. | **ESTABLISHED** | TXT | Illustrative simulation. |

### Chapter 7 · Spacetime

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C7.1 | A tesseract is a four-dimensional cube; what we can draw is its three-dimensional shadow. | 4D rotation, perspective projection. | **ESTABLISHED** | TXT | Euclidean 4D — not spacetime. |
| C7.2 | Spacetime is four-dimensional but not Euclidean: the interval s² = c²t² − x² is the same for all inertial observers. | Invariant hyperbolae stay fixed under boosts. | **ESTABLISHED** | TXT |  |
| C7.3 | Events simultaneous for one observer are not simultaneous for another moving relative to them. | Two families of simultaneity slices tilt against each other across the same worldlines. | **ESTABLISHED** | TXT |  |
| C7.4 | Light travels on the 45° cone; massive objects stay inside it. | Light cones. | **ESTABLISHED** | TXT |  |
| C7.5 | Clocks measure proper time τ = ∫√(1−v²/c²) dt; between two events the unaccelerated path ages most. Flown atomic clocks confirmed such effects. | Twin worldlines with equal-proper-time ticks. | **ESTABLISHED** | S18, TXT |  |
| C7.6 | The “block universe” — all times equally real — is an interpretation consistent with relativity, not an experimental result. | Static spacetime sculpture of worldlines. | **INTERPRETATION** | TXT |  |

### Chapter 8 · Gravity

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C8.1 | The curved space around a mass can be drawn as Flamm’s paraboloid; the vertical direction in the drawing is not a real direction. | Exact embedding z = 2√(r_s(r−r_s)). | **ESTABLISHED** | TXT |  |
| C8.2 | Free fall follows geodesics; close to a compact mass orbits precess. | Integrated Schwarzschild timelike geodesic (rosette). | **ESTABLISHED** | TXT, TEST |  |
| C8.3 | Light bends around a mass; the view of the sky is lensed into an Einstein ring and multiple images. | Per-pixel Schwarzschild null-geodesic ray tracing. | **ESTABLISHED** | TXT, TEST |  |
| C8.4 | Light can circle a black hole at the photon sphere r = 1.5 r_s; rays with impact parameter below (3√3/2) r_s are captured; the event horizon is at r_s. | Labels on the ray-traced image. | **ESTABLISHED** | S19 |  |
| C8.5 | No stable circular orbit exists inside 3 r_s, so a thin disk’s inner edge lies there. | Disk from 3 r_s outward; brightness and colour schematic. | **ESTABLISHED** | S19 | Disk emission profile illustrative; Doppler beaming approximate. |
| C8.6 | In 2019 the Event Horizon Telescope imaged the shadow of M87*: a ring 42 µas across. | Caption. | **ESTABLISHED** | S20 |  |
| C8.7 | A clock held static at radius r ticks slower by √(1 − r_s/r) relative to a distant clock. | Clock rates at 1.5 r_s, 3 r_s, 10 r_s. | **ESTABLISHED** | TXT |  |
| C8.8 | Inside the horizon every future path reaches r = 0, where classical general relativity predicts infinite curvature — a sign the theory fails there, not a known physical object. | Light cones tipping inward (Eddington–Finkelstein); the grid breaks down at r = 0. | **ESTABLISHED** | TXT | What replaces the singularity is unknown (speculative). |
| C8.9 | A black hole’s entropy is its horizon area in Planck units divided by four: S = A/4. | Horizon tiled by Planck-area cells (schematic, astronomically coarse). | **ESTABLISHED** | S21 | Theoretical result; Hawking radiation has not been observed from astrophysical black holes. |
| C8.10 | Whether information that falls in comes back out in the radiation — the information problem — is open. Recent calculations reproduce a Page curve, but the mechanism is debated. | Ghosted Page curve over thermal Hawking curve. | **SPECULATIVE** | S22 |  |

### Chapter 9 · Mathematics

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C9.1 | Brahmagupta’s Brāhmasphuṭasiddhānta (628 CE) gave rules for calculating with zero and negative numbers. | Historical caption; numerals. | **ESTABLISHED** | S31 |  |
| C9.2 | Āryabhaṭa’s Āryabhaṭīya (499 CE) gives a circumference of 62,832 for diameter 20,000: π ≈ 3.1416. | Circle with ratio. | **ESTABLISHED** | S32 |  |
| C9.3 | The Bakhshālī manuscript’s folios radiocarbon-date to 224–383, 680–779 and 885–993 CE; what this means for its zero is disputed. | Date ranges drawn as uncertainty bars. | **ESTABLISHED** | S33 |  |
| C9.4 | Dated inscriptions show zero as a dot at Sambor (683 CE) and as a circle at Gwalior (876 CE). | Timeline marks. | **ESTABLISHED** | S34 |  |
| C9.5 | The 27 nakshatras divide the ecliptic into 13°20′ sectors; the Moon crosses about one per day, which made calendar computation possible. | Ring of 27 sectors with the Moon advancing. | **ESTABLISHED** | S35 |  |
| C9.6 | Indian place-value numerals reached Europe via al-Khwārizmī (c. 825) and Fibonacci’s Liber Abaci (1202). | Transmission line. | **ESTABLISHED** | S36 |  |
| C9.7 | Mādhava of Saṅgamagrāma (c. 1340–1425) found the infinite series π/4 = 1 − 1/3 + 1/5 − …. | Partial sums converging. | **ESTABLISHED** | S37, TEST |  |
| C9.8 | There are infinitely many primes, yet their positions look irregular. | Sieve / spiral of the integers. | **ESTABLISHED** | TXT |  |
| C9.9 | The number of partitions p(n) grows like e^{π√(2n/3)}/(4n√3) (Hardy–Ramanujan, 1918). | Young diagrams; p(n) against the asymptotic curve. | **ESTABLISHED** | S29, TEST |  |
| C9.10 | The partition generating function is essentially 1/η, a modular form; its symmetry under τ → −1/τ is what makes an exact formula for p(n) possible. | Domain colouring of a modular form on the hyperbolic disk. | **ESTABLISHED** | TXT |  |
| C9.11 | Continued fractions give best rational approximations: π = [3; 7, 15, 1, 292, …] yields 22/7 and 355/113. | Nested fraction convergents. | **ESTABLISHED** | TXT, TEST |  |
| C9.12 | Ramanujan’s 1914 series for 1/π adds about eight correct digits per term. | Digits locking in term by term. | **ESTABLISHED** | S30, TEST |  |
| C9.13 | The zeta function’s non-trivial zeros computed here all lie on Re(s) = ½; the Riemann hypothesis is verified to height 3·10¹² but unproven. | Numerically computed ζ(½+it) and its zeros. | **ESTABLISHED** | S27, S28, TEST |  |
| C9.14 | Riemann’s explicit formula rebuilds the prime staircase from waves, one per zeta zero. | ψ(x) reconstructed from the first N computed zeros. | **ESTABLISHED** | TXT, TEST |  |
| C9.15 | Any list of infinite binary sequences misses one: flip the diagonal. Some infinities are larger than others (Cantor, 1891). | Diagonal construction. | **ESTABLISHED** | S38 |  |
| C9.16 | No algorithm can decide, for every program and input, whether it halts (Turing, 1936) — the same diagonal move. | Program × input table, diagonal flipped. | **ESTABLISHED** | S38 |  |
| C9.17 | Any consistent formal system strong enough for arithmetic has true statements it cannot prove (Gödel, 1931). A limit on formal systems — not on knowledge in general. | Caption. | **ESTABLISHED** | S38 |  |
| C9.18 | Every continuous symmetry of a physical law implies a conserved quantity (Noether, 1918): time ↔ energy, space ↔ momentum, rotation ↔ angular momentum. | Orbit sweeping equal areas (rotational symmetry → angular momentum). | **ESTABLISHED** | S39, TEST |  |

### Chapter 10 · Cosmos

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C10.1 | Earth’s mean radius is 6,371 km; the Moon is ~384,400 km away; 1 au = 149,597,870,700 m. | Scale zoom. | **ESTABLISHED** | TXT |  |
| C10.2 | The nearest star, Proxima Centauri, is 1.30 pc (4.2 light-years) away. | Local star field (procedural, realistic density). | **ESTABLISHED** | TXT | Star positions procedural except labelled stars. |
| C10.3 | The Sun is ~8.2 kpc from the centre of the Milky Way, a barred spiral. | Illustrative particle model of the Galaxy. | **ESTABLISHED** | S23 |  |
| C10.4 | Andromeda is ~765 kpc (2.5 million light-years) away. | Local Group. | **ESTABLISHED** | S26 |  |
| C10.5 | Looking farther means looking earlier: light from distant galaxies left them long ago. | Galaxies coloured and shaped by look-back time (younger, bluer, more irregular farther out). | **ESTABLISHED** | S1, TEST | Galaxy appearance evolution schematic. |
| C10.6 | The cosmic web grew by gravity from tiny initial fluctuations. | Zel'dovich approximation (first-order Lagrangian perturbation theory) on a Gaussian random field — not a full N-body simulation. | **ESTABLISHED** | S25 | Power spectrum schematic. |
| C10.7 | ΛCDM with Planck 2018 parameters: H₀ = 67.4 km/s/Mpc, Ωm = 0.315, age 13.79 Gyr. | Distances and ages computed from these parameters. | **ESTABLISHED** | S1, TEST |  |
| C10.8 | Three different distances: light-travel distance (≤13.8 Gly), Hubble radius c/H₀ (≈14.5 Gly) and particle horizon (≈46 Gly comoving). | Hubble sphere, CMB surface and particle horizon drawn as spheres at today’s (comoving) distances; the light-travel time is stated as a number, because it is not a location. | **ESTABLISHED** | S24, TEST |  |
| C10.9 | The observable universe is a horizon — the limit of what light has had time to bring us — not a wall or the edge of the universe. | Horizon shell rendered soft and open. | **ESTABLISHED** | S24 |  |
| C10.10 | The cosmic microwave background is light released ~380,000 years after the Big Bang (z ≈ 1100). | Outermost shell; anisotropy pattern illustrative, not the Planck map. | **ESTABLISHED** | S1, TXT |  |

### Chapter 11 · Frontier

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C11.1 | Inflation — a brief exponential expansion before the hot Big Bang — is a leading hypothesis, not yet confirmed. | Ghosted stretching grid. | **SPECULATIVE** | S39 |  |
| C11.2 | Eternal inflation and a multiverse of bubble universes are speculative extensions. | Dithered, incomplete bubbles. | **SPECULATIVE** | TXT |  |
| C11.3 | String theory may allow an enormous “landscape” of vacua (estimates ~10⁵⁰⁰). | Partially drawn potential surface. | **SPECULATIVE** | S40 |  |
| C11.4 | No theory of quantum gravity has been confirmed by experiment; candidates include strings and loop quantum gravity. | Ghosted spin network and vibrating loops. | **SPECULATIVE** | TXT |  |
| C11.5 | Spacetime might emerge from something deeper, such as quantum entanglement. | Graph condensing into a surface. | **SPECULATIVE** | TXT |  |
| C11.6 | Extra spatial dimensions have not been observed; if they exist they are small or hidden. | Calabi–Yau cross-section (a real mathematical surface; its physical role speculative). | **SPECULATIVE** | TXT |  |

### Chapter 12 · Synthesis

| id | claim | how it is depicted | level | sources | note |
|---|---|---|---|---|---|
| C12.1 | Everything shown reached you as light absorbed by a mosaic of cells. | Representations merge; the zoom ends on the cone mosaic. | **ESTABLISHED** | TXT |  |

## Equations shown on screen

| id | LaTeX | meaning | supports claim |
|---|---|---|---|
| E1.1 | `P(k)=\frac{(\lambda t)^k\,e^{-\lambda t}}{k!}` | Poisson probability of k photon absorptions in time t at rate λ. | C1.8 |
| E2.1 | `\psi_{n\ell m}(r,\theta,\varphi)=R_{n\ell}(r)\,Y_{\ell}^{m}(\theta,\varphi)` | Hydrogen eigenfunctions. | C2.9 |
| E2.2 | `P(\mathbf r)\,dV=\|\psi(\mathbf r)\|^2\,dV` | Born rule. | C2.9 |
| E2.3 | `E_n=-\frac{13.6\ \text{eV}}{n^2}` | Hydrogen energy levels. | C2.10 |
| E3.1 | `i\hbar\,\frac{\partial\psi}{\partial t}=-\frac{\hbar^2}{2m}\nabla^2\psi+V\psi` | Time-dependent Schrödinger equation (simulated for the double slit). | C3.7 |
| E3.2 | `P(x)\propto\|\psi_1(x)+\psi_2(x)\|^2` | Two-path interference. | C3.8 |
| E3.3 | `H=\sum_k \hbar\omega_k\left(a_k^{\dagger}a_k+\tfrac12\right)` | A free field as a sum of oscillator modes. | C3.6 |
| E3.4 | `\|\psi\rangle=\cos\tfrac{\theta}{2}\,\|{\uparrow}\rangle+e^{i\varphi}\sin\tfrac{\theta}{2}\,\|{\downarrow}\rangle` | Spin-½ state on the Bloch sphere. | C3.9 |
| E3.5 | `R(2\pi)=-\mathbb{1},\qquad R(4\pi)=+\mathbb{1}` | Spinor rotation phase. | C3.9 |
| E3.6 | `\langle A\,B\rangle=-\cos\theta_{ab}` | Singlet correlation of outcomes. | C3.11 |
| E4.1 | `L=\int S(\lambda)\,\bar l(\lambda)\,d\lambda` | Cone response integrates the spectrum against its sensitivity (likewise M, S). | C4.5 |
| E5.1 | `\hat f(\nu)=\int f(t)\,e^{-2\pi i\nu t}\,dt` | Fourier transform. | C5.2 |
| E5.2 | `E_n=\hbar\omega\left(n+\tfrac12\right)` | Oscillator levels. | C5.3 |
| E5.3 | `S=k_B\ln W` | Boltzmann entropy. | C5.5 |
| E5.4 | `H=-\sum_i p_i\log_2 p_i` | Shannon entropy. | C5.6 |
| E6.1 | `\text{DNA}\;\to\;\text{RNA}\;\to\;\text{protein}` | Flow of sequence information. | C6.1 |
| E7.1 | `s^2=c^2t^2-x^2` | Invariant interval. | C7.2 |
| E7.2 | `t'=\gamma\left(t-\frac{v x}{c^2}\right),\quad x'=\gamma\,(x-vt)` | Lorentz transformation. | C7.3 |
| E7.3 | `\tau=\int\sqrt{1-v^2/c^2}\;dt` | Proper time. | C7.5 |
| E8.1 | `\frac{d^2u}{d\varphi^2}+u=\frac{3}{2}\,r_s\,u^2,\qquad u=\frac1r` | Schwarzschild null geodesic (ray traced per pixel). | C8.3 |
| E8.2 | `\frac{d\tau}{dt}=\sqrt{1-\frac{r_s}{r}}` | Static clock rate. | C8.7 |
| E8.3 | `S=\frac{A}{4}\quad(\text{Planck units})` | Bekenstein–Hawking entropy. | C8.9 |
| E9.1 | `\sum_{n\ge0}p(n)\,q^n=\prod_{k\ge1}\frac{1}{1-q^k}` | Partition generating function (Euler). | C9.10 |
| E9.2 | `p(n)\sim\frac{1}{4n\sqrt3}\,e^{\pi\sqrt{2n/3}}` | Hardy–Ramanujan asymptotic. | C9.9 |
| E9.3 | `\frac1\pi=\frac{2\sqrt2}{9801}\sum_{k=0}^{\infty}\frac{(4k)!\,(1103+26390k)}{(k!)^4\,396^{4k}}` | Ramanujan 1914. | C9.12 |
| E9.4 | `\zeta(s)=\sum_{n=1}^{\infty}\frac1{n^s}=\prod_{p}\frac{1}{1-p^{-s}}` | Zeta function and Euler product. | C9.13 |
| E9.5 | `\psi(x)=x-\sum_{\rho}\frac{x^{\rho}}{\rho}-\log 2\pi-\tfrac12\log\!\left(1-x^{-2}\right)` | Riemann–von Mangoldt explicit formula. | C9.14 |
| E9.6 | `\frac{\pi}{4}=1-\frac13+\frac15-\frac17+\cdots` | Mādhava series. | C9.7 |
| E9.7 | `\pi=3+\cfrac{1}{7+\cfrac{1}{15+\cfrac{1}{1+\cfrac{1}{292+\cdots}}}}` | Continued fraction of π. | C9.11 |
| E9.8 | `\frac{\partial L}{\partial \theta}=0\;\Longrightarrow\;\frac{d}{dt}\,\frac{\partial L}{\partial\dot\theta}=0` | Rotational symmetry ⇒ conserved angular momentum. | C9.18 |
| E10.1 | `H(z)=H_0\sqrt{\Omega_m(1+z)^3+\Omega_\Lambda}` | Flat ΛCDM expansion rate (radiation included in the code). | C10.7 |
| E10.2 | `\mathbf x(\mathbf q,t)=\mathbf q-D(t)\,\nabla_{\mathbf q}\Phi(\mathbf q)` | Zel'dovich approximation. | C10.6 |
| E11.1 | `a(t)\propto e^{Ht}` | Near-exponential expansion during inflation (H nearly constant). | C11.1 |
| E11.2 | `z_1^{5}+z_2^{5}=1` | The complex curve (a real 2D surface) in Hanson’s picture of the quintic Calabi–Yau. | C11.6 |

## Sources

| id | citation | access | link |
|---|---|---|---|
| S1 | Planck Collaboration (2020), Planck 2018 results VI: Cosmological parameters, A&A 641, A6 — H0 = 67.4±0.5 km/s/Mpc, Ωm = 0.315±0.007, σ8 = 0.811, age 13.787±0.020 Gyr | search-excerpt | [link](https://arxiv.org/abs/1807.06209) |
| S2 | CODATA 2018 (Tiesinga et al. 2021, Rev. Mod. Phys. 93, 025010) — proton rms charge radius 0.8414(19) fm | search-excerpt | [link](https://physics.nist.gov/cgi-bin/cuu/Value?rp) |
| S3 | Gas-phase H2O fundamentals ν1 = 3657, ν2 = 1595, ν3 = 3756 cm⁻¹ (NIST CCCBDB; LSBU water spectrum page) | search-excerpt | [link](https://cccbdb.nist.gov/exp2x.asp?casno=7732185) |
| S4 | H2O gas-phase geometry r(OH) = 0.9572 Å, ∠HOH = 104.52° | search-excerpt | [link](https://water.lsbu.ac.uk/water/water_vibrational_spectrum.html) |
| S5 | Luger K. et al. (1997), Crystal structure of the nucleosome core particle at 2.8 Å, Nature 389, 251 — 146 bp, 1.65 left-handed superhelical turns | search-excerpt | [link](https://www.nature.com/articles/38444) |
| S6 | B-DNA geometry: ~2 nm diameter, 3.4 nm per ~10.5 bp; minor groove ~5.7 Å, major ~11.7 Å (ScienceDirect topic summaries) | search-excerpt | [link](https://www.sciencedirect.com/topics/agricultural-and-biological-sciences/b-dna) |
| S7 | Curcio C.A. et al. (1990), Human photoreceptor topography, J. Comp. Neurol. 292, 497 — peak foveal cone density 199,000/mm² (100k–324k), 4.6 million cones | search-excerpt | [link](https://onlinelibrary.wiley.com/doi/abs/10.1002/cne.902920402) |
| S8 | Curcio et al. (1991) via Calkins (2001) and Webvision — S cones absent from the central ~100 µm of the fovea | search-excerpt | [link](https://www.webvision.pitt.edu/book/part-ii-anatomy-and-physiology-of-the-retina/the-architecture-of-the-human-fovea/) |
| S9 | Hofer H. et al. (2005), Organization of the human trichromatic cone mosaic, J. Neurosci. 25, 9669 — L:M from 1.1:1 to 16.5:1 | search-excerpt | [link](https://www.jneurosci.org/content/25/42/9669) |
| S10 | Govardovskii V.I. et al. (2000), In search of the visual pigment template, Vis. Neurosci. 17, 509 — A1 template constants | search-excerpt | [link](https://pubmed.ncbi.nlm.nih.gov/11016572/) |
| S11 | Schoenlein R.W. et al. (1991), The first step in vision: femtosecond isomerization of rhodopsin, Science 254, 412 — ~200 fs | search-excerpt | [link](https://www.science.org/doi/10.1126/science.1925597) |
| S12 | Baylor D.A., Lamb T.D., Yau K.-W. (1979), Responses of retinal rods to single photons, J. Physiol. 288, 613 | search-excerpt | [link](https://pmc.ncbi.nlm.nih.gov/articles/PMC1281447/) |
| S13 | Ocular anatomy summaries — optic nerve ≈ 1.2 million axons; adult axial length ≈ 24 mm | search-excerpt | [link](https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/) |
| S14 | Bissey F. et al. (2007), Gluon flux-tube distribution and linear confinement in baryons, Phys. Rev. D 76, 114512 — Y-shaped flux tubes (lattice QCD) | search-excerpt | [link](https://arxiv.org/abs/hep-lat/0606016) |
| S15 | Tonomura A. et al. (1989), Demonstration of single-electron buildup of an interference pattern, Am. J. Phys. 57, 117 | search-excerpt | [link](https://pubs.aip.org/aapt/ajp/article/57/2/117/1040594) |
| S16 | Rauch H. et al. (1975), Verification of coherent spinor rotation of fermions, Phys. Lett. A 54, 425 — 4π periodicity | search-excerpt | [link](https://www.sciencedirect.com/science/article/abs/pii/0375960175907987) |
| S17 | Hensen B. et al. (2015), Loophole-free Bell inequality violation using electron spins separated by 1.3 km, Nature 526, 682 | search-excerpt | [link](https://www.nature.com/articles/nature15759) |
| S18 | Hafele J.C., Keating R.E. (1972), Around-the-world atomic clocks: observed relativistic time gains, Science 177, 168 | search-excerpt | [link](https://www.science.org/doi/10.1126/science.177.4044.168) |
| S19 | Schwarzschild photon sphere r = 3GM/c² = 1.5 r_s; ISCO r = 6GM/c² = 3 r_s (textbook values, cross-checked by search excerpt) | search-excerpt | [link](https://en.wikipedia.org/wiki/Photon_sphere) |
| S20 | Event Horizon Telescope Collaboration (2019), First M87 EHT results I, ApJL 875, L1 — ring 42±3 µas, M = (6.5±0.7)×10⁹ M☉ | search-excerpt | [link](https://arxiv.org/abs/1906.11238) |
| S21 | Hawking S.W. (1975), Particle creation by black holes, Commun. Math. Phys. 43, 199; Bekenstein J.D. (1973), Black holes and entropy, Phys. Rev. D 7 — S = A/4 | search-excerpt | [link](https://link.springer.com/article/10.1007/BF02345020) |
| S22 | Almheiri A. et al. (2021), The entropy of Hawking radiation, Rev. Mod. Phys. 93, 035002 | search-excerpt | [link](https://www.osti.gov/pages/biblio/1839660) |
| S23 | GRAVITY Collaboration (2019), A geometric distance measurement to the Galactic Center black hole, A&A 625, L10 — R0 = 8178 ± 13 ± 22 pc | search-excerpt | [link](https://arxiv.org/abs/1904.05721) |
| S24 | Davis T.M., Lineweaver C.H. (2004), Expanding confusion: common misconceptions of cosmological horizons, PASA 21, 97 | search-excerpt | [link](https://arxiv.org/abs/astro-ph/0310808) |
| S25 | Zel'dovich Ya.B. (1970), Gravitational instability: an approximate theory for large density perturbations, A&A 5, 84 | search-excerpt | [link](https://ui.adsabs.harvard.edu/abs/1970A&A.....5...84Z/abstract) |
| S26 | Andromeda (M31) distance ≈ 765 kpc ≈ 2.5 Mly (encyclopedic summary) | search-excerpt | [link](https://en.wikipedia.org/wiki/Andromeda_Galaxy) |
| S27 | Platt D.J., Trudgian T. (2021), The Riemann hypothesis is true up to 3·10¹², Bull. LMS 53, 792 | search-excerpt | [link](https://arxiv.org/abs/2004.09765) |
| S28 | Odlyzko A.M., Tables of zeros of the Riemann zeta function (first zero 14.134725141…) | search-excerpt | [link](https://www-users.cse.umn.edu/~odlyzko/zeta_tables/index.html) |
| S29 | Hardy G.H., Ramanujan S. (1918) partition asymptotics p(n) ~ e^{π√(2n/3)}/(4n√3); OEIS A000041 | search-excerpt | [link](https://oeis.org/A000041) |
| S30 | Ramanujan S. (1914), Modular equations and approximations to π — 1/π series (proved by J. & P. Borwein, 1987) | search-excerpt | [link](https://arxiv.org/abs/2411.15803) |
| S31 | MacTutor: Brahmagupta — Brāhmasphuṭasiddhānta (628 CE), rules for arithmetic with zero and negatives | search-excerpt | [link](https://mathshistory.st-andrews.ac.uk/Biographies/Brahmagupta/) |
| S32 | MacTutor / Britannica: Āryabhaṭa — Āryabhaṭīya (499 CE), circumference 62832 for diameter 20000 | search-excerpt | [link](https://mathshistory.st-andrews.ac.uk/Biographies/Aryabhata_I/) |
| S33 | Bodleian Library (2017) radiocarbon dates of Bakhshālī folios: 224–383, 680–779, 885–993 CE; Plofker K. et al. (2017), HSSA 5 — dispute of interpretation | search-excerpt | [link](https://journals.library.ualberta.ca/hssa/index.php/hssa/article/view/22) |
| S34 | Sambor (Khmer) inscription K-127, Śaka 605 = 683 CE (zero as dot); Gwalior Chaturbhuj temple, 876 CE (circular zero in "270") | search-excerpt | [link](https://old.maa.org/press/periodicals/convergence/mathematical-treasure-the-cambodian-zero) |
| S35 | Nakshatras: 27 (sometimes 28) ecliptic sectors of 13°20′, listed in the Vedāṅga Jyotiṣa; Moon ≈ one sector per day (sidereal month ≈ 27.3 d) | search-excerpt | [link](https://en.wikipedia.org/wiki/Nakshatra) |
| S36 | al-Khwārizmī (c. 825), book on calculation with Hindu numerals, Latin translation 12th c.; Fibonacci, Liber Abaci (1202) (Britannica) | search-excerpt | [link](https://www.britannica.com/topic/Liber-abaci) |
| S37 | Mādhava of Saṅgamagrāma (c. 1340–1425), Kerala school; series for π and arctan, reported in Jyeṣṭhadeva, Yuktibhāṣā (c. 1530) | search-excerpt | [link](https://assets.cambridge.org/97805211/14707/excerpt/9780521114707_excerpt.pdf) |
| S38 | Cantor G. (1891) diagonal argument; Gödel K. (1931), Monatshefte f. Math. u. Phys. 38; Turing A.M. (1936), Proc. LMS 2(42), 230 | search-excerpt | [link](https://en.wikipedia.org/wiki/Cantor%27s_diagonal_argument) |
| S39 | Noether E. (1918), Invariante Variationsprobleme, Nachr. Ges. Wiss. Göttingen 235; Shannon C.E. (1948), A mathematical theory of communication; Guth A.H. (1981), Phys. Rev. D 23, 347 | search-excerpt | [link](https://eudml.org/doc/59024) |
| S40 | Bousso R., Polchinski J. (2000), JHEP; Douglas M.R., statistics of string vacua — landscape estimate ~10⁵⁰⁰ vacua (speculative) | search-excerpt | [link](https://arxiv.org/abs/1208.5715) |
| S41 | Ellis R.J. (2001), Macromolecular crowding: obvious but underappreciated, Trends Biochem. Sci. 26, 597 | search-excerpt | [link](https://pubmed.ncbi.nlm.nih.gov/11590012/) |
| S42 | Dartnall H.J.A., Bowmaker J.K., Mollon J.D. (1983), Human visual pigments, Proc. R. Soc. B 220, 115 — λmax rods 496.3, L 558.4, M 530.8, S 419.0 nm | search-excerpt | [link](https://pubmed.ncbi.nlm.nih.gov/6140680/) |
| TXT | Standard textbook physics / mathematics (no source fetched in the build environment) | textbook | — |
| TEST | Verified numerically by this project's unit tests (tests/*.test.ts) | textbook | — |

## Audio

The score is music, not the sound of the physics. Two labelled exceptions: in Chapter 3/4 two close tones beat against each other (acoustic interference is a real interference effect of the sound itself); in Chapter 5 the three water normal-mode frequencies are transposed down by exactly 37 octaves (frequency ratios preserved) and labelled as such on screen.
