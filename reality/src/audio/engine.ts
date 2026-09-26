// Live and offline audio. The score (score.ts) is rendered in fixed 4 s blocks — by a worker for
// live playback, on the main thread for the offline render — so both paths produce the same
// samples. Live: blocks are scheduled on the AudioContext timeline and the AudioContext clock is
// the master clock for the pictures (clock.ts), keeping picture and sound locked after seeks.
import AudioWorker from './audio.worker.ts?worker&inline';
import type { Shared } from '../engine/shared';
import { buildScore, BLOCK_SEC, WARM_SEC, MASTER_DB, type Score, type ScoreInputs } from './score';
import { scoreInputs } from './inputs';
import { renderPcm24, base64 } from './offline';
import { DURATION } from '../content/chapters';

export class AudioEngine {
  private inputs: ScoreInputs;
  private score: Score | null = null; // main-thread copy (offline renders)
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private worker: Worker | null = null;
  private blocks = new Map<number, Float32Array>();
  private requested = new Set<number>();
  private sources = new Map<number, AudioBufferSourceNode>();
  private playing = false;
  private waiting = false;
  private startT = 0;
  private startCtx = 0;
  private muted = false;
  private timer: number | null = null;
  private offline = new Map<string, Float32Array>();

  constructor(public seed: number, shared: Shared) {
    this.inputs = scoreInputs(shared);
  }

  async start() {
    if (this.ctx) return;
    const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'playback' });
    await ctx.resume();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.dest = ctx.createMediaStreamDestination();
    this.master.connect(this.dest);
    this.worker = new AudioWorker();
    this.worker.onmessage = (e: MessageEvent<{ k: number; buf: Float32Array }>) => {
      this.blocks.set(e.data.k, e.data.buf);
      this.requested.delete(e.data.k);
      // keep the cache small: drop blocks far behind the playhead
      for (const k of this.blocks.keys()) if (k < this.blockAt(this.posNow()) - 2) this.blocks.delete(k);
      this.pump();
    };
    this.worker.postMessage({ type: 'init', inputs: this.inputs, sr: ctx.sampleRate });
  }

  private blockAt(t: number) { return Math.floor(Math.max(0, t) / BLOCK_SEC); }
  private posNow() {
    if (!this.ctx || !this.playing || this.waiting) return this.startT;
    return this.startT + Math.max(0, this.ctx.currentTime - this.startCtx);
  }

  play(t: number) {
    if (!this.ctx) return;
    this.stopSources();
    this.playing = true;
    this.startT = t;
    this.waiting = true; // hold the picture until the first block is ready, then start both together
    if (this.timer == null) this.timer = window.setInterval(() => this.pump(), 250);
    this.pump();
  }
  pause() {
    if (this.ctx && this.playing) this.startT = this.posNow();
    this.playing = false;
    this.waiting = false;
    this.stopSources();
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
  }
  seek(t: number, playing: boolean) {
    if (playing) this.play(t); else { this.startT = t; this.stopSources(); }
  }

  /** timeline seconds of the sound being heard now, or null when audio is not driving the clock */
  timelineTime(): number | null {
    if (!this.ctx || !this.playing) return null;
    if (this.waiting) return this.startT;
    const lat = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return this.startT + Math.max(0, this.ctx.currentTime - lat - this.startCtx);
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const pos = this.posNow();
    const k0 = this.blockAt(pos), k1 = this.blockAt(Math.min(DURATION, pos + 3 * BLOCK_SEC));
    for (let k = k0; k <= k1; k++) if (!this.blocks.has(k) && !this.requested.has(k)) { this.requested.add(k); this.worker!.postMessage({ type: 'block', k }); }
    if (this.waiting) {
      if (!this.blocks.has(k0)) return;
      this.waiting = false;
      this.startCtx = ctx.currentTime + 0.05;
    }
    for (let k = k0; k <= k1; k++) if (!this.sources.has(k) && this.blocks.has(k)) this.schedule(k);
    for (const [k, s] of this.sources) if (k < k0 - 1) { this.sources.delete(k); s.disconnect(); }
  }

  private schedule(k: number) {
    const ctx = this.ctx!, data = this.blocks.get(k)!;
    const n = data.length / 2;
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < n; i++) { L[i] = data[i * 2]; R[i] = data[i * 2 + 1]; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master!);
    const when = this.startCtx + (k * BLOCK_SEC - this.startT);
    const now = ctx.currentTime + 0.01;
    if (when >= now) src.start(when);
    else { const off = now - when; if (off >= n / ctx.sampleRate) return; src.start(now, off); }
    this.sources.set(k, src);
  }

  private stopSources() {
    for (const s of this.sources.values()) { try { s.stop(); } catch { /* not started */ } s.disconnect(); }
    this.sources.clear();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  /** offline: `count` samples from sample `from` at `sr`, as base64 interleaved stereo 24-bit LE PCM */
  renderOfflineBase64(from: number, count: number, sr: number) {
    this.score ??= buildScore(this.inputs);
    return base64(renderPcm24(this.score, sr, from, count, this.offline));
  }

  info() {
    return { sampleRate: this.ctx?.sampleRate ?? 48000, blockSec: BLOCK_SEC, warmSec: WARM_SEC, masterDb: MASTER_DB, targetLufs: -14, voices: (this.score ??= buildScore(this.inputs)).voices.length };
  }
  state() { return this.ctx ? `${this.ctx.state}${this.muted ? ' (muted)' : ''}${this.waiting ? ' buffering' : ''}` : 'off'; }
  stream(): MediaStream | null { return this.dest?.stream ?? null; }
}
