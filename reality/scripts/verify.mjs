// Automated verification against the built single file (dist/reality.html).
//   npm run build && node scripts/verify.mjs          → verification/ (screenshots, report.md, report.json)
// Checks: screenshots at every chapter start and transition midpoint; console, page and WebGL/shader
// errors; NaN/Inf in the HDR scene buffer; determinism (same frame twice across page loads, and
// twice within render mode); Low-tier live frame times; live audio clock; page-vs-Node audio
// samples; file:// with networking disabled and every request logged.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, createReadStream, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { launch } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist'), OUT = join(ROOT, 'verification'), SHOTS = join(OUT, 'shots');
const PAGE = 'reality.html';
if (!existsSync(join(DIST, PAGE))) { console.error('run `npm run build` first'); process.exit(1); }
// --only shots,determinism,offline,live,audio  runs a subset and merges it into the existing report
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const run = (name) => !ONLY || ONLY.includes(name);
if (run('shots')) { rmSync(SHOTS, { recursive: true, force: true }); }
mkdirSync(SHOTS, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const prev = ONLY && existsSync(join(OUT, 'report.json')) ? JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8')) : null;
const report = { when: new Date().toISOString(), environment: {}, shots: [], determinism: {}, offline: {}, lowTier: {}, freeCamera: {}, audio: {}, failures: [] };
if (prev) { Object.assign(report, prev, { when: report.when }); report.failures = []; }
const fail = (m) => { report.failures.push(m); console.log('  FAIL', m); };
const save = () => writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2)); // after every section

// static server for dist/
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || PAGE);
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/${PAGE}`;

const { browser, context } = await launch({ software: true });
const glErr = (l) => /ERROR: \d|program not valid|INVALID_|GL_INVALID|shader/i.test(l);
async function openLogged(url, ctx = context) {
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  return { page, logs };
}

// ── 1 · checkpoints: title, each chapter start (+2 s), each transition midpoint, end card ──
const info = await (async () => { const { page } = await openLogged(`${BASE}?render=1&w=320&h=180&fps=30&sub=1&tier=low`); const i = await page.evaluate(() => window.__ready); report.environment.renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }); await page.close(); return i; })();
const points = run('shots') ? [[2, 'title card']] : [];
for (const c of info.chapters) {
  points.push([c.start, `ch${c.n} transition midpoint`]);
  points.push([c.start + 2, `ch${c.n} ${c.key} start`]);
}
if (run('shots')) { report.shots = []; points.push([617.02, 'ch8 singularity cut'], [info.duration - 2, 'end card']); }
console.log(`checkpoints: ${points.length}`);
for (const [t, label] of points) {
  const t0 = Date.now();
  const { page, logs } = await openLogged(`${BASE}?still=1&t=${t}&tier=high`);
  await page.waitForFunction(() => window.__stillDone === true || (window.__errors && window.__errors.length > 0), null, { timeout: 180000 });
  const errs = await page.evaluate(() => window.__errors);
  const hdr = await page.evaluate(() => (window.__hdrCheck ? window.__hdrCheck() : null));
  const file = join(SHOTS, `${String(report.shots.length).padStart(2, '0')}_${label.replace(/[^a-z0-9]+/gi, '-')}_t${t}.png`);
  await page.screenshot({ path: file });
  const gl = logs.filter(glErr);
  const row = { t, label, file: file.slice(ROOT.length + 1), ms: Date.now() - t0, pageErrors: errs, glMessages: gl, otherConsole: logs.filter((l) => !glErr(l)).slice(0, 5), hdr };
  report.shots.push(row);
  console.log(`  t=${String(t).padEnd(7)} ${label.padEnd(28)} errors=${errs.length} gl=${gl.length} NaN/Inf=${hdr?.nonFinite ?? '?'} max=${hdr ? hdr.maxValue.toFixed(1) : '?'}`);
  if (errs.length) fail(`page errors at t=${t}: ${errs.join(' | ')}`);
  if (gl.length) fail(`WebGL/shader messages at t=${t}: ${gl[0]}`);
  if (hdr && hdr.nonFinite) fail(`${hdr.nonFinite} non-finite HDR samples at t=${t}`);
  await page.close();
}

save();
// ── 2 · determinism ──
if (run('determinism')) {
  const shot = async () => { const { page } = await openLogged(`${BASE}?still=1&t=300.4&tier=high`); await page.waitForFunction(() => window.__stillDone === true); const b = await page.screenshot(); await page.close(); return b; };
  const a = await shot(), b = await shot();
  report.determinism.stillAcrossLoads = { a: sha(a), b: sha(b), identical: a.equals(b) };
  if (!a.equals(b)) fail('still frame differs between two page loads');
  const frames = async () => {
    const { page } = await openLogged(`${BASE}?render=1&w=640&h=360&fps=30&sub=2&tier=high`);
    await page.evaluate(() => window.__ready);
    const r = [];
    for (const f of [120, 9012, 18510]) { const x = await page.evaluate((f) => window.__renderFrame(f), f); const y = await page.evaluate((f) => window.__renderFrame(f), f); r.push([sha(x), sha(y)]); }
    await page.close();
    return r;
  };
  const s1 = await frames(), s2 = await frames();
  const sameWithin = s1.every(([x, y]) => x === y), sameAcross = s1.every(([x], i) => x === s2[i][0]);
  report.determinism.renderMode = { frames: [120, 9012, 18510], session1: s1, session2: s2, sameWithinSession: sameWithin, sameAcrossSessions: sameAcross };
  if (!sameWithin || !sameAcross) fail('render-mode frames are not reproducible');
  console.log(`determinism: still across loads ${a.equals(b)}, render within ${sameWithin}, across sessions ${sameAcross}`);
}

save();
// ── 3 · file:// with networking disabled; log every request ──
if (run('offline')) {
  const off = await browser.newContext({ offline: true });
  const url = pathToFileURL(join(DIST, PAGE)).href + '?still=1&t=460&tier=high';
  const reqs = [];
  const page = await off.newPage();
  page.on('request', (r) => reqs.push(r.url().slice(0, 80)));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url);
  await page.waitForFunction(() => window.__stillDone === true || (window.__errors && window.__errors.length > 0), null, { timeout: 180000 });
  await page.screenshot({ path: join(SHOTS, 'zz_file-offline_t460.png') });
  const nonLocal = reqs.filter((u) => !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:'));
  report.offline = { url: 'file://…/dist/reality.html', size: statSync(join(DIST, PAGE)).size, requests: reqs.length, nonLocalRequests: nonLocal, pageErrors: errors, windowErrors: await page.evaluate(() => window.__errors) };
  console.log(`file:// offline: ${reqs.length} requests, ${nonLocal.length} non-local, errors ${errors.length}`);
  if (nonLocal.length) fail('network requests from file:// build: ' + nonLocal.join(', '));
  if (errors.length || report.offline.windowErrors.length) fail('errors in file:// build');
  await off.close();
}

save();
// ── 4 · Low tier, live mode: frame times, the audio clock, free camera ──
if (run('live')) {
  const { page, logs } = await openLogged(`${BASE}?tier=low&t=300`);
  await page.waitForFunction(() => { const b = document.querySelector('button.begin'); return b && !b.disabled; }, null, { timeout: 240000 });
  await page.click('button.begin');
  await page.waitForFunction(() => window.__live && window.__live.playing(), null, { timeout: 60000 });
  const a0 = await page.evaluate(() => ({ t: window.__live.t(), audio: window.__live.audio(), at: window.__live.audioT() }));
  await page.waitForTimeout(12000);
  const a1 = await page.evaluate(() => ({ t: window.__live.t(), audio: window.__live.audio(), at: window.__live.audioT(), ms: window.__live.frameMs.slice(-240), tier: window.__live.tier(), scale: window.__live.scale() }));
  const ms = [...a1.ms].sort((x, y) => x - y);
  const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
  report.lowTier = { tier: a1.tier, renderScale: a1.scale, frames: ms.length, medianMs: q(0.5), p95Ms: q(0.95), note: 'software rasteriser (SwiftShader) — no GPU in this environment' };
  report.audio.live = { stateBefore: a0.audio, stateAfter: a1.audio, clockAdvancedS: +(a1.t - a0.t).toFixed(3), audioClock: [a0.at, a1.at] };
  console.log(`low tier live: median ${q(0.5)?.toFixed(0)} ms, p95 ${q(0.95)?.toFixed(0)} ms; audio ${a1.audio}; clock advanced ${(a1.t - a0.t).toFixed(2)} s in 12 s`);
  if (logs.filter(glErr).length) fail('WebGL messages in live mode');
  // free camera: pause, capture, toggle C, drag, capture — the view must change; C again returns
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const cv = await page.$('canvas');
  const shotA = await cv.screenshot();
  await page.keyboard.press('c');
  const box = await cv.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(4000);
  const shotB = await cv.screenshot();
  writeFileSync(join(SHOTS, 'zz_freecam_before.png'), shotA); writeFileSync(join(SHOTS, 'zz_freecam_after.png'), shotB);
  report.freeCamera = { viewChanged: !shotA.equals(shotB), before: 'shots/zz_freecam_before.png', after: 'shots/zz_freecam_after.png' };
  console.log(`free camera: view changed ${!shotA.equals(shotB)}`);
  if (shotA.equals(shotB)) fail('free camera did not change the view');
  // controls: resume, seek (the audio clock must follow), mute, real-time recording
  await page.keyboard.press('c'); await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  const s1 = await page.evaluate(() => window.__live.t());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(3000);
  const s2 = await page.evaluate(() => ({ t: window.__live.t(), at: window.__live.audioT() }));
  await page.keyboard.press('m');
  const muted = await page.evaluate(() => window.__live.audio());
  await page.keyboard.press('m');
  const unmuted = await page.evaluate(() => window.__live.audio());
  const dl = page.waitForEvent('download', { timeout: 90000 }).catch(() => null);
  const recSel = 'button[aria-label="Record a real-time video of the canvas"]';
  await page.evaluate((q) => document.querySelector(q).click(), recSel);
  await page.waitForTimeout(5000);
  await page.evaluate((q) => document.querySelector(q).click(), recSel);
  const d = await dl;
  let rec = null;
  if (d) { const pth = await d.path(); rec = { file: d.suggestedFilename(), bytes: pth ? statSync(pth).size : 0 }; }
  report.controls = { seek: { before: s1, after: s2.t, audioClock: s2.at, jumped: +(s2.t - s1).toFixed(2), audioFollows: s2.at != null && Math.abs(s2.t - s2.at) < 0.25 }, mute: { muted, unmuted }, recording: rec };
  console.log(`controls: seek jumped ${(s2.t - s1).toFixed(2)} s (audio ${s2.at?.toFixed(2)}), mute "${muted}" → "${unmuted}", recording ${rec ? rec.file + ' ' + rec.bytes + ' bytes' : 'none'}`);
  if (!(s2.t - s1 > 9.5) || !report.controls.seek.audioFollows) fail('seek did not move picture and audio together');
  if (!/muted/.test(muted) || /muted/.test(unmuted)) fail('mute toggle not reflected in audio state');
  if (!rec || rec.bytes < 10000) fail('real-time recording produced no file');
  await page.close();
}

save();
// ── 5 · audio: the page's offline samples equal the Node render of the same range ──
if (run('audio')) {
  const { page } = await openLogged(`${BASE}?render=1&w=320&h=180&fps=30&sub=1&tier=low`);
  await page.evaluate(() => window.__ready);
  const from = 300 * 48000, count = 24000;
  const b64 = await page.evaluate(([f, c]) => window.__renderAudio(f, c, 48000), [from, count]);
  await page.close();
  const node = spawnSync('node', [join(ROOT, 'scripts/run-ts.mjs'), join(ROOT, 'scripts/audio-block.ts'), String(from), String(count)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const nb = node.stdout.trim();
  const A = Buffer.from(b64, 'base64'), B = Buffer.from(nb, 'base64');
  let maxd = 0;
  for (let i = 0; i + 2 < Math.min(A.length, B.length); i += 3) maxd = Math.max(maxd, Math.abs(A.readIntLE(i, 3) - B.readIntLE(i, 3)));
  report.audio.pageVsNode = { samples: count, bytes: [A.length, B.length], maxLsbDifference: maxd, identical: A.equals(B) };
  console.log(`audio page vs node: identical ${A.equals(B)}, max difference ${maxd} LSB (24-bit)`);
  if (A.length !== B.length || maxd > 2) fail('page and Node audio renders disagree');
}

save();
await browser.close();
server.close();

// contact sheet
const sheet = join(OUT, 'contact-sheet.jpg');
if (run('shots')) spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', join(SHOTS, '[0-9]*.png'), '-vf', 'scale=480:-1,tile=4x7:padding=4:color=black', '-frames:v', '1', '-q:v', '3', sheet]);
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const md = [
  '# Verification report', '', `Generated ${report.when} by \`scripts/verify.mjs\` against \`dist/reality.html\`.`, '',
  `Renderer: ${report.environment.renderer}`, '',
  '## Checkpoints', '', '| t (s) | checkpoint | page errors | WebGL/shader | non-finite HDR | screenshot |', '|---|---|---|---|---|---|',
  ...report.shots.map((s) => `| ${s.t} | ${s.label} | ${s.pageErrors.length} | ${s.glMessages.length} | ${s.hdr?.nonFinite ?? 'n/a'} | [png](${s.file.replace(/^verification\//, '')}) |`),
  '', '## Determinism', '', '```json', JSON.stringify(report.determinism, null, 2), '```',
  '', '## file:// with networking disabled', '', '```json', JSON.stringify(report.offline, null, 2), '```',
  '', '## Low tier, live mode', '', '```json', JSON.stringify(report.lowTier, null, 2), '```',
  '', '## Free camera', '', '```json', JSON.stringify(report.freeCamera, null, 2), '```',
  '', '## Live controls', '', '```json', JSON.stringify(report.controls ?? {}, null, 2), '```',
  '', '## Audio', '', '```json', JSON.stringify(report.audio, null, 2), '```',
  '', `## Result: ${report.failures.length ? 'FAILURES' : 'all checks passed'}`, '', ...report.failures.map((f) => `- ${f}`), '',
];
writeFileSync(join(OUT, 'report.md'), md.join('\n'));
console.log(`\n${report.failures.length ? report.failures.length + ' failure(s)' : 'all checks passed'} — verification/report.md`);
process.exit(report.failures.length ? 1 : 0);
