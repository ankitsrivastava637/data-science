// Dev helper: bundle a TS entry with rolldown (ships with Vite) and run it in Node.
import { rolldown } from 'rolldown';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const entry = resolve(process.argv[2]);
const bundle = await rolldown({ input: entry, platform: 'node', external: [/^node:/, 'playwright-core'] });
const { output } = await bundle.generate({ format: 'esm' });
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'runts-'));
const file = join(dir, 'out.mjs');
writeFileSync(file, output[0].code);
process.argv.splice(2, 1);
await import(pathToFileURL(file).href);
