// Master clock. Live: derived from the AudioContext clock when audio runs (sample-accurate A/V
// sync), otherwise from frame deltas. Render mode: set explicitly per frame.
import { DURATION } from '../content/chapters';

export interface AudioClockSource {
  /** timeline seconds according to the audio clock, or null if audio is not running */
  timelineTime(): number | null;
}

export class Clock {
  t = 0;
  playing = false;
  rate = 1;
  audio: AudioClockSource | null = null;
  private lastWall = 0;
  private listeners: ((ev: 'seek' | 'play' | 'pause', t: number) => void)[] = [];

  on(f: (ev: 'seek' | 'play' | 'pause', t: number) => void) { this.listeners.push(f); }
  private emit(ev: 'seek' | 'play' | 'pause') { for (const f of this.listeners) f(ev, this.t); }

  play() { if (!this.playing) { this.playing = true; this.lastWall = 0; this.emit('play'); } }
  pause() { if (this.playing) { this.playing = false; this.emit('pause'); } }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t: number) { this.t = Math.max(0, Math.min(DURATION, t)); this.lastWall = 0; this.emit('seek'); }

  /** advance using wall time (ms) — only for live mode */
  tick(wallMs: number) {
    if (!this.playing) { this.lastWall = wallMs; return; }
    const at = this.audio?.timelineTime();
    if (at != null) {
      this.t = Math.min(DURATION, at);
    } else {
      const dt = this.lastWall ? Math.min(0.1, (wallMs - this.lastWall) / 1000) : 0;
      this.t = Math.min(DURATION, this.t + dt * this.rate);
    }
    this.lastWall = wallMs;
    if (this.t >= DURATION) this.pause();
  }
}
