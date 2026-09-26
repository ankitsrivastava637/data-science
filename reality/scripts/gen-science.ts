// Generates SCIENCE.md from src/content/ledger.ts.  Run: npm run ledger
import { writeFileSync } from 'node:fs';
import { CLAIMS, EQUATIONS, SOURCES } from '../src/content/ledger.ts';

const CH = ['', 'Observer', 'Inner scale', 'Quantum', 'Sensory filter', 'Frequency & information', 'Life as information', 'Spacetime', 'Gravity', 'Mathematics', 'Cosmos', 'Frontier', 'Synthesis'];
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const out: string[] = [];
out.push('# SCIENCE.md — claim ledger');
out.push('');
out.push('_Generated from `src/content/ledger.ts` by `npm run ledger`. Do not edit by hand._');
out.push('');
out.push('Every caption and equation shown on screen references a row below (checked by `tests/content.test.ts`).');
out.push('Epistemic levels: **ESTABLISHED** (experimentally or mathematically settled), **INTERPRETATION** (a reading of established physics that is not itself testable), **SPECULATIVE** (hypotheses without confirming evidence, or open problems).');
out.push('');
out.push('## How sources were consulted');
out.push('');
out.push('Fetching web pages was **blocked** by the build environment\'s network policy (arxiv.org, nist.gov, nature.com, aanda.org, adsabs, wikipedia.org all returned egress-blocked). A web *search* tool was available, and it returns excerpts of the result pages. Sources marked `search-excerpt` were checked **only against those excerpts** for the specific fact cited; the full papers were not read. Rows citing `TXT` rely on standard textbook physics or mathematics for which no source was fetched. `TEST` means the statement is also verified numerically by this project\'s unit tests. `bundled-data` marks a dataset that ships inside the build (coastlines, Earth imagery).');
out.push('');
out.push('## Claims');
for (let ch = 1; ch <= 12; ch++) {
  out.push('');
  out.push(`### Chapter ${ch} · ${CH[ch]}`);
  out.push('');
  out.push('| id | claim | how it is depicted | level | sources | note |');
  out.push('|---|---|---|---|---|---|');
  for (const c of CLAIMS.filter((c) => c.chapter === ch)) {
    out.push(`| ${c.id} | ${esc(c.claim)} | ${esc(c.depiction)} | **${c.level}** | ${c.sources.join(', ')} | ${esc(c.note ?? '')} |`);
  }
}
out.push('');
out.push('## Equations shown on screen');
out.push('');
out.push('| id | LaTeX | meaning | supports claim |');
out.push('|---|---|---|---|');
for (const e of EQUATIONS) out.push(`| ${e.id} | \`${esc(e.latex)}\` | ${esc(e.meaning)} | ${e.claim} |`);
out.push('');
out.push('## Sources');
out.push('');
out.push('| id | citation | access | link |');
out.push('|---|---|---|---|');
for (const s of SOURCES) out.push(`| ${s.id} | ${esc(s.cite)} | ${s.access} | ${s.url ? `[link](${s.url})` : '—'} |`);
out.push('');
out.push('## Audio');
out.push('');
out.push('The score is music, not the sound of the physics. Two labelled exceptions: in Chapter 3/4 two close tones beat against each other (acoustic interference is a real interference effect of the sound itself); in Chapter 5 the three water normal-mode frequencies are transposed down by exactly 37 octaves (frequency ratios preserved) and labelled as such on screen.');
out.push('');
writeFileSync(new URL('../SCIENCE.md', import.meta.url), out.join('\n'));
console.log(`SCIENCE.md: ${CLAIMS.length} claims, ${EQUATIONS.length} equations, ${SOURCES.length} sources`);
