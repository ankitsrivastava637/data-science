// The standard genetic code (RNA codons → one-letter amino acids; '*' = stop).
export const BASES = ['U', 'C', 'A', 'G'] as const;
const TABLE = [
  'FFLL', 'SSSS', 'YY**', 'CC*W', // U first
  'LLLL', 'PPPP', 'HHQQ', 'RRRR', // C first
  'IIIM', 'TTTT', 'NNKK', 'SSRR', // A first
  'VVVV', 'AAAA', 'DDEE', 'GGGG', // G first
];
export function translateCodon(c: string): string {
  const i = BASES.indexOf(c[0] as 'U'), j = BASES.indexOf(c[1] as 'U'), k = BASES.indexOf(c[2] as 'U');
  if (i < 0 || j < 0 || k < 0) throw new Error('bad codon ' + c);
  return TABLE[i * 4 + j][k];
}
export const THREE_LETTER: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'stop',
};
export function allCodons(): string[] {
  const out: string[] = [];
  for (const a of BASES) for (const b of BASES) for (const c of BASES) out.push(a + b + c);
  return out;
}
/** illustrative mRNA (not a real gene): Met-Ala-Trp-Lys-Asp-Leu-Phe-Gly-Glu-Arg-Tyr-stop */
export const DEMO_MRNA = 'AUGGCUUGGAAAGACCUGUUCGGAGAACGUUACUAA';
export const dnaCoding = (mrna: string) => mrna.replace(/U/g, 'T');
export const complement = (dna: string) => dna.replace(/[ACGT]/g, (c) => ({ A: 'T', T: 'A', C: 'G', G: 'C' } as Record<string, string>)[c]);
