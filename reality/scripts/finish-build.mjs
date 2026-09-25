// After both builds: copy the single-file build to dist/reality.html and report sizes.
import { copyFileSync, statSync, rmSync, existsSync } from 'node:fs';
const src = new URL('../dist-single/index.html', import.meta.url);
const dst = new URL('../dist/reality.html', import.meta.url);
copyFileSync(src, dst);
rmSync(new URL('../dist-single', import.meta.url), { recursive: true, force: true });
const mb = (statSync(dst).size / 1e6).toFixed(2);
console.log(`dist/reality.html: ${mb} MB`);
if (statSync(dst).size > 30e6) { console.error('single-file build exceeds 30 MB'); process.exit(1); }
if (!existsSync(new URL('../dist/index.html', import.meta.url))) { console.error('dist/index.html missing'); process.exit(1); }
