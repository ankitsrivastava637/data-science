// Minimal DOM UI: begin gate, auto-hiding transport, scrubber with chapter ticks, toggles,
// keyboard control, screen-reader caption mirror, debug overlay. Never drawn into the video.
import { CHAPTERS, DURATION } from '../content/chapters';
import { CAPTIONS } from '../content/script';

export interface UIHandlers {
  begin(): void;
  togglePlay(): void;
  replay(): void;
  seek(t: number): void;
  toggleFreeCam(): boolean;
  toggleCaptions(): boolean;
  toggleMute(): boolean;
  toggleRecord(): Promise<boolean>;
  setTier(t: 'auto' | 'low' | 'high' | 'ultra'): void;
  fullscreen(): void;
}

const CSS = `
#ui { position: fixed; inset: 0; pointer-events: none; font: 400 13px/1.4 Inter, "Helvetica Neue", Arial, sans-serif; color: #e8e2d6; letter-spacing: .01em; }
#ui button, #ui select, #ui input { pointer-events: auto; font: inherit; color: inherit; }
.r-gate { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; pointer-events: auto; transition: opacity 1.2s; }
.r-gate h1 { font-weight: 300; font-size: clamp(34px, 6vw, 76px); letter-spacing: .42em; margin: 0 0 .3em .42em; color: #efe9dd; }
.r-gate p { margin: .25em 0; color: #a59e90; max-width: 36em; text-align: center; }
.r-gate .begin { margin-top: 2.2em; padding: .75em 2.6em; background: transparent; border: 1px solid #8a8376; border-radius: 999px; letter-spacing: .3em; font-size: 13px; cursor: pointer; transition: border-color .3s, background .3s; }
.r-gate .begin:disabled { opacity: .45; cursor: progress; }
.r-gate .begin:not(:disabled):hover, .r-gate .begin:focus-visible { border-color: #efe9dd; background: rgba(255,255,255,.05); outline: none; }
.r-gate .progress { height: 1px; width: 220px; background: #2a2824; margin-top: 1.4em; overflow: hidden; }
.r-gate .progress > div { height: 100%; width: 0; background: #b9b2a4; transition: width .3s; }
.r-gate .small { font-size: 12px; color: #7d776c; margin-top: 1.6em; }
.r-gate label { color: #8d877b; font-size: 12px; margin-top: 1em; }
.r-gate select { background: #111; border: 1px solid #3a3731; border-radius: 4px; padding: 2px 6px; }
.r-bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 24px 16px; background: linear-gradient(transparent, rgba(0,0,0,.72)); display: flex; flex-direction: column; gap: 8px; opacity: 0; transition: opacity .5s; pointer-events: none; }
.r-bar.show { opacity: 1; pointer-events: auto; }
.r-row { display: flex; align-items: center; gap: 6px; }
.r-bar button { background: none; border: 1px solid transparent; border-radius: 6px; padding: 5px 9px; cursor: pointer; color: #d9d2c4; }
.r-bar button:hover, .r-bar button:focus-visible { border-color: #5d584f; outline: none; }
.r-bar button[aria-pressed="true"] { border-color: #8a8376; color: #fff; }
.r-time { font-variant-numeric: tabular-nums; color: #a8a194; margin: 0 8px; min-width: 96px; }
.r-scrub { position: relative; height: 18px; }
.r-scrub input { width: 100%; margin: 0; appearance: none; background: transparent; height: 18px; cursor: pointer; }
.r-scrub input::-webkit-slider-runnable-track { height: 2px; background: #4a4640; }
.r-scrub input::-webkit-slider-thumb { appearance: none; width: 11px; height: 11px; border-radius: 50%; background: #efe9dd; margin-top: -4.5px; }
.r-scrub input:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(239,233,221,.35); }
.r-tick { position: absolute; top: 3px; width: 1px; height: 12px; background: #6f695f; pointer-events: none; }
.r-tick span { position: absolute; top: -16px; left: 3px; font-size: 10px; color: #8d877b; white-space: nowrap; }
.r-spacer { flex: 1; }
.r-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.r-toast { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); background: rgba(20,19,17,.92); border: 1px solid #3f3b35; border-radius: 8px; padding: 10px 16px; max-width: 520px; color: #d7d0c2; opacity: 0; transition: opacity .4s; pointer-events: none; }
.r-toast.show { opacity: 1; }
.r-debug { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,.6); padding: 6px 9px; font: 11px/1.45 ui-monospace, Menlo, monospace; color: #9fe0c0; white-space: pre; pointer-events: none; }
.r-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2em; color: #d8d1c3; background: #000; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) { .r-bar, .r-gate, .r-toast { transition: none; } }
`;

export function fmtTime(t: number) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class UI {
  root = document.getElementById('ui')!;
  gate!: HTMLDivElement;
  beginBtn!: HTMLButtonElement;
  progress!: HTMLDivElement;
  bar!: HTMLDivElement;
  scrub!: HTMLInputElement;
  time!: HTMLSpanElement;
  playBtn!: HTMLButtonElement;
  sr!: HTMLDivElement;
  toastEl!: HTMLDivElement;
  debugEl: HTMLDivElement | null = null;
  private hideTimer = 0;
  private scrubbing = false;
  private lastCaption = '';

  constructor(private h: UIHandlers, opts: { debug: boolean; tierLabel: string }) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.buildGate(opts.tierLabel);
    this.buildBar();
    this.sr = el('div', 'r-sr');
    this.sr.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.sr);
    this.toastEl = el('div', 'r-toast');
    this.toastEl.setAttribute('role', 'status');
    this.root.appendChild(this.toastEl);
    if (opts.debug) { this.debugEl = el('div', 'r-debug'); this.root.appendChild(this.debugEl); }
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('pointermove', () => this.poke());
  }

  private buildGate(tierLabel: string) {
    const g = (this.gate = el('div', 'r-gate'));
    g.innerHTML = `<h1>REALITY</h1>
      <p>From the human eye to the structure of the universe.</p>
      <p>One continuous journey, about fourteen minutes. Sound on.</p>
      <div class="progress" aria-hidden="true"><div></div></div>
      <button class="begin" disabled aria-label="Begin">PREPARING…</button>
      <label>Quality <select aria-label="Quality tier">
        <option value="auto">Auto (${tierLabel})</option><option value="low">Low</option><option value="high">High</option><option value="ultra">Ultra</option>
      </select></label>
      <p class="small">Space play/pause · ←/→ seek 10 s · Home replay · C free camera · A annotations · M mute · F fullscreen</p>`;
    this.progress = g.querySelector('.progress > div')!;
    this.beginBtn = g.querySelector('.begin')!;
    this.beginBtn.addEventListener('click', () => this.h.begin());
    g.querySelector('select')!.addEventListener('change', (e) => this.h.setTier((e.target as HTMLSelectElement).value as 'auto'));
    this.root.appendChild(g);
  }

  setProgress(done: number, total: number, label: string) {
    this.progress.style.width = `${Math.round((done / total) * 100)}%`;
    this.beginBtn.textContent = done >= total ? 'BEGIN' : `PREPARING · ${label}`;
  }
  ready() { this.beginBtn.disabled = false; this.beginBtn.textContent = 'BEGIN'; this.beginBtn.focus(); }
  hideGate() {
    this.gate.style.opacity = '0';
    setTimeout(() => this.gate.remove(), 1300);
    this.poke();
  }

  private buildBar() {
    const b = (this.bar = el('div', 'r-bar'));
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Playback controls');
    const scrubWrap = el('div', 'r-scrub');
    const s = (this.scrub = document.createElement('input'));
    s.type = 'range'; s.min = '0'; s.max = String(DURATION); s.step = '0.1'; s.value = '0';
    s.setAttribute('aria-label', 'Seek');
    s.addEventListener('input', () => { this.scrubbing = true; this.h.seek(+s.value); });
    s.addEventListener('change', () => { this.scrubbing = false; });
    scrubWrap.appendChild(s);
    for (const c of CHAPTERS) {
      const tk = el('div', 'r-tick');
      tk.style.left = `${(c.start / DURATION) * 100}%`;
      const sp = document.createElement('span');
      sp.textContent = String(c.n).padStart(2, '0');
      sp.title = c.title;
      tk.appendChild(sp);
      scrubWrap.appendChild(tk);
    }
    const row = el('div', 'r-row');
    this.playBtn = btn('Pause', 'Play / pause (Space)', () => this.h.togglePlay());
    row.appendChild(this.playBtn);
    row.appendChild(btn('Replay', 'Replay from the start (Home)', () => this.h.replay()));
    this.time = el('span', 'r-time') as HTMLSpanElement;
    row.appendChild(this.time);
    row.appendChild(el('div', 'r-spacer'));
    const fc = btn('Free camera', 'Free camera (C)', () => fc.setAttribute('aria-pressed', String(this.h.toggleFreeCam())));
    fc.setAttribute('aria-pressed', 'false');
    const an = btn('Annotations', 'Annotations on/off (A)', () => an.setAttribute('aria-pressed', String(this.h.toggleCaptions())));
    an.setAttribute('aria-pressed', 'true');
    const mu = btn('Mute', 'Mute (M)', () => mu.setAttribute('aria-pressed', String(this.h.toggleMute())));
    mu.setAttribute('aria-pressed', 'false');
    const rec = btn('Record video', 'Record a real-time video of the canvas', async () => rec.setAttribute('aria-pressed', String(await this.h.toggleRecord())));
    rec.setAttribute('aria-pressed', 'false');
    const fs = btn('Fullscreen', 'Fullscreen (F)', () => this.h.fullscreen());
    for (const x of [fc, an, mu, rec, fs]) row.appendChild(x);
    b.appendChild(scrubWrap);
    b.appendChild(row);
    b.addEventListener('pointerenter', () => this.poke(true));
    b.addEventListener('focusin', () => this.poke(true));
    this.root.appendChild(b);
    (this as any)._buttons = { fc, an, mu, rec };
  }

  press(name: 'fc' | 'an' | 'mu' | 'rec', v: boolean) { (this as any)._buttons[name].setAttribute('aria-pressed', String(v)); }

  poke(stay = false) {
    this.bar.classList.add('show');
    clearTimeout(this.hideTimer);
    if (!stay) this.hideTimer = window.setTimeout(() => { if (!this.bar.matches(':hover') && !this.bar.contains(document.activeElement)) this.bar.classList.remove('show'); }, 2600);
  }

  toast(msg: string, ms = 6000) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  update(t: number, playing: boolean) {
    if (!this.scrubbing) this.scrub.value = t.toFixed(1);
    this.time.textContent = `${fmtTime(t)} / ${fmtTime(DURATION)}`;
    this.playBtn.textContent = playing ? 'Pause' : 'Play';
    const c = CAPTIONS.find((c) => t >= c.t0 && t < c.t1);
    const txt = c ? c.text : '';
    if (txt !== this.lastCaption) { this.lastCaption = txt; if (txt) this.sr.textContent = txt; }
  }

  debug(text: string) { if (this.debugEl) this.debugEl.textContent = text; }

  private key(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.target instanceof HTMLSelectElement) return;
    const k = e.key;
    let handled = true;
    if (k === ' ' || k === 'k') { if (this.gate.isConnected && !this.beginBtn.disabled && this.gate.style.opacity !== '0') this.h.begin(); else this.h.togglePlay(); }
    else if (k === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) this.h.seek(+this.scrub.value + 10);
    else if (k === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) this.h.seek(+this.scrub.value - 10);
    else if (k === 'Home') this.h.replay();
    else if (k === 'c' || k === 'C') this.press('fc', this.h.toggleFreeCam());
    else if (k === 'a' || k === 'A') this.press('an', this.h.toggleCaptions());
    else if (k === 'm' || k === 'M') this.press('mu', this.h.toggleMute());
    else if (k === 'f' || k === 'F') this.h.fullscreen();
    else handled = false;
    if (handled) { e.preventDefault(); this.poke(); }
  }

  fallback(msg: string) {
    const f = el('div', 'r-fallback');
    f.setAttribute('role', 'alert');
    f.textContent = msg;
    this.root.appendChild(f);
  }
}

function el(tag: string, cls: string) { const e = document.createElement(tag) as HTMLDivElement; e.className = cls; return e; }
function btn(label: string, aria: string, on: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-label', aria);
  b.addEventListener('click', on);
  return b;
}
