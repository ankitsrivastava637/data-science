// Offline renderer: headless Chromium drives the page's deterministic render mode; frames are
// POSTed as raw RGBA to a local sink and piped into ffmpeg in resumable 20 s segments.
//
//   node scripts/render.mjs                         full film, 3840×2160 @ 60 fps, Ultra, 8 sub-frames
//   node scripts/render.mjs --w 1920 --h 1080 --fps 30 --sub 1 --tier high    (CPU-only machines)
//   node scripts/render.mjs --chapter 8             one chapter          --start 600 --end 620   a range
//   node scripts/render.mjs --share-only            re-encode reality.mp4 → reality_share.mp4
//   node scripts/render.mjs --test-clips            three 10 s clips + automatic checks
//
// Requires: `npm run build` (renders dist/reality.html, the same file that ships) and ffmpeg on PATH.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, renameSync, statSync, createReadStream, rmSync, readdirSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };

const W = +opt('w', 3840), H = +opt('h', 2160), FPS = +opt('fps', 60), SUB = +opt('sub', 8);
const TIER = opt('tier', 'ultra'), MSAA = opt('msaa', null), SEED = opt('seed', '1');
const CRF = opt('crf', '16'), PRESET = opt('preset', 'medium');
const OUT = resolve(opt('out', join(ROOT, 'reality.mp4')));
const SHARE = resolve(opt('share-out', join(ROOT, 'reality_share.mp4')));
const WORK = resolve(opt('work', join(ROOT, 'render-work', `${W}x${H}@${FPS}_s${SUB}_${TIER}`)));
const SEG_FRAMES = +opt('seg', 20) * FPS;
const DIST = resolve(opt('dist', join(ROOT, 'dist')));
const PAGE = opt('page', 'reality.html');

function ff(args, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'], input });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffprobe failed on ' + file);
  return JSON.parse(r.stdout);
}
const fmtT = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}h${String(m).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}s`; };

// ── local server: serves dist/ and receives frames ─────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
let sink = null; // (buffer) => Promise<void>
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/frame')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try { await sink(Buffer.concat(chunks)); res.writeHead(204); res.end(); } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  const p = join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || PAGE);
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
});

let port = 0;
async function openPage() {
  if (!existsSync(join(DIST, PAGE))) throw new Error(`${join(DIST, PAGE)} not found — run \`npm run build\` first`);
  if (!port) { await new Promise((r) => server.listen(0, '127.0.0.1', r)); port = server.address().port; }
  const { browser, context } = await launch({ software: process.env.REALITY_SWIFTSHADER === '1' || flag('software') });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const q = new URLSearchParams({ render: '1', fps: String(FPS), w: String(W), h: String(H), sub: String(SUB), tier: TIER, seed: SEED });
  if (MSAA != null) q.set('msaa', MSAA);
  await page.goto(`http://127.0.0.1:${port}/${PAGE}?${q}`);
  const info = await page.evaluate(() => window.__ready);
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  return { browser, page, info, port, errors };
}

// ── video ───────────────────────────────────────────────────────────────────
const X264 = (crf) => ['-c:v', 'libx264', '-profile:v', 'high', '-preset', PRESET, '-crf', String(crf), '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-g', String(FPS * 2), '-bf', '2'];
const RGB2YUV = 'vflip,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p';

async function renderRange(f0, f1) {
  mkdirSync(join(WORK, 'segments'), { recursive: true });
  // locks left by an interrupted run (pass --clear-locks when no other render process is running)
  if (flag('clear-locks')) for (const f of readdirSync(join(WORK, 'segments'))) if (f.endsWith('.lock')) rmSync(join(WORK, 'segments', f));
  const { browser, page, info, port, errors } = await openPage();
  console.log(`render ${W}×${H} @ ${FPS} fps, ${SUB} sub-frame(s), tier ${info.tier}, frames ${f0}–${f1 - 1} of ${info.frames}`);
  const segs = [];
  for (let s = Math.floor(f0 / SEG_FRAMES) * SEG_FRAMES; s < f1; s += SEG_FRAMES) segs.push([Math.max(s, f0), Math.min(s + SEG_FRAMES, f1)]);
  const segName = ([a, b]) => join(WORK, 'segments', `seg_${String(a).padStart(6, '0')}_${b}.mp4`);
  const todo = segs.filter((sg) => !existsSync(segName(sg)));
  const total = todo.reduce((n, [a, b]) => n + b - a, 0);
  console.log(`${segs.length} segment(s), ${segs.length - todo.length} already done, ${total} frames to render`);
  let done = 0; const t0 = Date.now(); let last = 0; let tRender = 0, tPost = 0;
  for (const [a, b] of todo) {
    const name = segName([a, b]);
    // several render processes may share one work dir: claim a segment with an exclusive lock file
    const lock = name + '.lock';
    if (existsSync(name)) { done += b - a; continue; }
    try { writeFileSync(lock, String(process.pid), { flag: 'wx' }); } catch { done += b - a; continue; }
    const tmp = name + '.part.mp4';
    const enc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-vf', RGB2YUV, ...X264(CRF), '-threads', '2', '-an', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const encDone = new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg exited ' + c)))));
    sink = (buf) => {
      if (buf.length !== W * H * 4) return Promise.reject(new Error(`frame size ${buf.length}`));
      return new Promise((r) => { if (enc.stdin.write(buf)) r(); else enc.stdin.once('drain', r); });
    };
    for (let i = a; i < b; i++) {
      // the page renders, reads back and base64-encodes; CDP carries the string (faster here than an HTTP upload)
      const a0 = Date.now();
      const b64 = await page.evaluate((i) => window.__renderFrame(i), i);
      const a1 = Date.now();
      const buf = Buffer.from(b64.slice(b64.indexOf(',') + 1), 'base64');
      await sink(buf);
      tRender += a1 - a0; tPost += Date.now() - a1;
      done++;
      const now = Date.now();
      if (now - last > 5000 || done === total) {
        last = now;
        const el = (now - t0) / 1000, rate = done / el;
        process.stdout.write(`\r  frame ${i + 1}/${f1}  ${(100 * done / total).toFixed(1)}%  ${rate.toFixed(2)} fps  elapsed ${fmtT(el)}  ETA ${fmtT((total - done) / rate)}  (page ${(tRender / done).toFixed(0)} ms, decode+pipe ${(tPost / done).toFixed(0)} ms)   `);
      }
    }
    enc.stdin.end();
    await encDone;
    renameSync(tmp, name);
    rmSync(lock, { force: true });
  }
  process.stdout.write('\n');
  await browser.close();
  if (errors.length) throw new Error('page errors during render: ' + errors.join(' | '));
  return segs.map(([a, b]) => join(WORK, 'segments', `seg_${String(a).padStart(6, '0')}_${b}.mp4`));
}

function concat(files, out) {
  const list = join(WORK, 'concat.txt');
  writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
}

// ── audio: rendered offline by the page's own engine (same code as live playback) ──
async function renderAudio(t0, t1, out) {
  const { browser, page } = await openPage();
  const SR = 48000;
  const total = Math.round((t1 - t0) * SR);
  const CH = 10 * SR;
  const parts = [];
  for (let s = 0; s < total; s += CH) {
    const n = Math.min(CH, total - s);
    const b64 = await page.evaluate(([from, count, sr]) => window.__renderAudio(from, count, sr), [Math.round(t0 * SR) + s, n, SR]);
    parts.push(Buffer.from(b64, 'base64'));
    process.stdout.write(`\r  audio ${(100 * (s + n) / total).toFixed(0)}%   `);
  }
  process.stdout.write('\n');
  const info = await page.evaluate(() => window.__audioInfo());
  await browser.close();
  // parts are interleaved stereo 24-bit little-endian PCM
  const pcm = Buffer.concat(parts);
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 6, 28); hdr.writeUInt16LE(6, 32); hdr.writeUInt16LE(24, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  writeFileSync(out, Buffer.concat([hdr, pcm]));
  return info;
}

function mux(video, wav, out) {
  ff(['-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
}

/** 1080p30 share encode sized for messaging (~20–40 MB): H.264 two-pass at the bitrate that fits */
function shareEncode(src, out, targetMB = +opt('share-mb', 34)) {
  const dur = +probe(src).format.duration;
  const audioK = 96;
  const vk = Math.floor((targetMB * 8 * 1024) / dur - audioK);
  const vf = 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p';
  const common = ['-i', src, '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-b:v', `${vk}k`, '-maxrate', `${Math.round(vk * 2.2)}k`, '-bufsize', `${vk * 4}k`,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-g', '120'];
  const log = join(WORK, 'x264pass');
  mkdirSync(WORK, { recursive: true });
  ff([...common, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', '/dev/null']);
  ff([...common, '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', `${audioK}k`, '-movflags', '+faststart', out]);
  if (flag('hevc')) {
    const hv = out.replace(/\.mp4$/, '_hevc.mp4');
    ff(['-i', src, '-vf', vf, '-c:v', 'libx265', '-preset', 'slow', '-b:v', `${vk}k`, '-tag:v', 'hvc1', '-x265-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-c:a', 'aac', '-b:a', `${audioK}k`, '-movflags', '+faststart', hv]);
  }
  console.log(`share: ${out}  ${(statSync(out).size / 1048576).toFixed(1)} MB  (video ${vk} kb/s)`);
}

// ── checks ─────────────────────────────────────────────────────────────────
function checkFile(file, expectFrames, expectDur) {
  const p = probe(file);
  const v = p.streams.find((s) => s.codec_type === 'video'), a = p.streams.find((s) => s.codec_type === 'audio');
  const cnt = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
  const frameDur = 1 / FPS;
  const vDur = +v.duration, aDur = a ? +a.duration : NaN, aStart = a ? +a.start_time : NaN, vStart = +v.start_time;
  const rows = {
    frames: [+cnt, expectFrames, +cnt === expectFrames],
    duration: [+vDur.toFixed(4), expectDur, Math.abs(vDur - expectDur) <= frameDur + 1e-6],
    'A/V start offset (s)': [a ? +(aStart - vStart).toFixed(4) : 'no audio', `±${frameDur.toFixed(4)}`, a ? Math.abs(aStart - vStart) <= frameDur : false],
    'A/V duration diff (s)': [a ? +(aDur - vDur).toFixed(4) : 'no audio', `±${frameDur.toFixed(4)}`, a ? Math.abs(aDur - vDur) <= frameDur + 0.025 : false],
    'colour tags': [`${v.color_space}/${v.color_primaries}/${v.color_transfer}/${v.color_range}`, 'bt709/bt709/bt709/tv', v.color_space === 'bt709' && v.color_primaries === 'bt709' && v.color_transfer === 'bt709' && v.color_range === 'tv'],
    'codec / profile / pix_fmt': [`${v.codec_name}/${v.profile}/${v.pix_fmt}`, 'h264/High/yuv420p', v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p'],
    audio: [a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch ${Math.round(a.bit_rate / 1000)} kb/s` : 'none', 'aac 48000 Hz 2 ch', !!a && a.codec_name === 'aac' && +a.sample_rate === 48000],
  };
  return rows;
}
async function playsInVideoElement(file) {
  const { browser, context } = await launch({ software: true });
  const page = await context.newPage();
  const srv = createServer((req, res) => { res.writeHead(200, { 'content-type': req.url.endsWith('.mp4') ? 'video/mp4' : 'text/html' }); if (req.url.endsWith('.mp4')) createReadStream(file).pipe(res); else res.end('<video id=v muted playsinline src="/clip.mp4"></video>'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  const r = await page.evaluate(async () => {
    const v = document.getElementById('v');
    const can = v.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"');
    const ok = await new Promise((res) => { v.onloadeddata = () => res(true); v.onerror = () => res(false); setTimeout(() => res(false), 15000); });
    let advanced = false;
    if (ok) { try { await v.play(); await new Promise((r) => setTimeout(r, 1500)); advanced = v.currentTime > 0.2; } catch { advanced = false; } }
    return { canPlayType: can, loaded: ok, advanced, w: v.videoWidth, h: v.videoHeight, err: v.error ? v.error.code : null };
  });
  await browser.close(); srv.close();
  return r;
}

async function testClips() {
  const clips = [[+opt('clip1', 150), 'quantum'], [+opt('clip2', 600), 'gravity'], [+opt('clip3', 830), 'synthesis']];
  const dir = join(WORK, 'clips'); mkdirSync(dir, { recursive: true });
  const report = [];
  for (const [t0, name] of clips) {
    const f0 = Math.round(t0 * FPS), f1 = f0 + 10 * FPS;
    const files = await renderRange(f0, f1);
    const v = join(dir, `${name}_video.mp4`); concat(files, v);
    const wav = join(dir, `${name}.wav`);
    await renderAudio(f0 / FPS, f1 / FPS, wav);
    const out = join(dir, `${name}.mp4`); mux(v, wav, out);
    // stills from the encoded file (first, middle, last frame)
    for (const [k, ts] of [['a', 0], ['b', 5], ['c', 9.9]]) ff(['-ss', String(ts), '-i', out, '-frames:v', '1', join(dir, `${name}_${k}.png`)]);
    const checks = checkFile(out, 10 * FPS, 10);
    const play = await playsInVideoElement(out);
    report.push({ clip: name, from: t0, file: out, checks, play });
  }
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  for (const r of report) {
    console.log(`\n${r.clip} (t = ${r.from} s): ${r.file}`);
    for (const [k, [got, want, ok]] of Object.entries(r.checks)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${k}: ${got}  (expected ${want})`);
    console.log(`  ${r.play.loaded && r.play.advanced ? 'PASS' : 'FAIL'}  <video> playback: ${JSON.stringify(r.play)}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
if (flag('share-only')) {
  shareEncode(OUT, SHARE);
} else if (flag('test-clips')) {
  await testClips();
} else {
  let t0 = 0, t1 = null;
  const probeRun = await openPage(); const { duration, chapters } = probeRun.info; await probeRun.browser.close();
  if (opt('chapter')) {
    const c = chapters.find((c) => c.n === +opt('chapter'));
    if (!c) throw new Error('no chapter ' + opt('chapter'));
    t0 = c.start; t1 = c.end;
  }
  if (opt('start')) t0 = +opt('start');
  if (opt('end')) t1 = +opt('end');
  t1 ??= duration;
  const f0 = Math.round(t0 * FPS), f1 = Math.min(Math.round(t1 * FPS), Math.ceil(duration * FPS));
  const files = await renderRange(f0, f1);
  if (flag('frames-only')) process.exit(0);
  const whole = f0 === 0 && f1 === Math.ceil(duration * FPS);
  const video = join(WORK, whole ? 'video.mp4' : `video_${f0}_${f1}.mp4`);
  concat(files, video);
  const wav = join(WORK, whole ? 'audio.wav' : `audio_${f0}_${f1}.wav`);
  const ainfo = await renderAudio(f0 / FPS, f1 / FPS, wav);
  const out = whole ? OUT : OUT.replace(/\.mp4$/, `_${f0}_${f1}.mp4`);
  mux(video, wav, out);
  console.log(`\n${out}  ${(statSync(out).size / 1048576).toFixed(1)} MB`, JSON.stringify(ainfo));
  const rows = checkFile(out, f1 - f0, (f1 - f0) / FPS);
  for (const [k, [got, want, ok]] of Object.entries(rows)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${k}: ${got}  (expected ${want})`);
  if (whole && !flag('no-share')) shareEncode(out, SHARE);
}
process.exit(0);
