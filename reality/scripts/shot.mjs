// Dev helper: screenshot frames at given times.  node scripts/shot.mjs <baseURL> <outdir> t1 t2 ...
import { launch } from './browser.mjs';
import { mkdirSync } from 'node:fs';
const [base, outdir, ...ts] = process.argv.slice(2);
mkdirSync(outdir, { recursive: true });
const { browser, context } = await launch({ software: true });
const page = await context.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
for (const t of ts) {
  const t0 = Date.now();
  await page.goto(`${base}?still=1&t=${t}&tier=high`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__stillDone === true || (window.__errors && window.__errors.length > 0), null, { timeout: 90000 });
  const errs = await page.evaluate(() => window.__errors);
  await page.screenshot({ path: `${outdir}/t${String(t).padStart(6, '0')}.png` });
  console.log(`t=${t}  ${(Date.now() - t0) / 1000}s  errors=${errs.length ? errs.join(' | ') : 'none'}`);
}
if (logs.length) console.log(logs.slice(0, 30).join('\n'));
await browser.close();
