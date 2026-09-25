// Placeholder audio engine (replaced by the deterministic score in Task 6).
import type { Shared } from '../engine/shared';

export class AudioEngine {
  constructor(public seed: number, public shared: Shared) {}
  async start() {}
  play(_t: number) {}
  pause() {}
  seek(_t: number, _playing: boolean) {}
  timelineTime(): number | null { return null; }
  toggleMute() { return false; }
  renderOfflineBase64(_from: number, _count: number, _sr: number) { return ''; }
  info() { return {}; }
  state() { return 'off'; }
  stream(): MediaStream | null { return null; }
}
