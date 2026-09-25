// Real-time fallback recorder: canvas.captureStream + the audio graph's MediaStream → MediaRecorder.
import type { AudioEngine } from '../audio/engine';

export class Recorder {
  active = false;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  constructor(private canvas: HTMLCanvasElement, private audio: AudioEngine) {}
  async start() {
    const vs = this.canvas.captureStream(60);
    const as = this.audio.stream();
    const tracks = [...vs.getVideoTracks(), ...(as ? as.getAudioTracks() : [])];
    const stream = new MediaStream(tracks);
    const types = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    this.rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 24_000_000, audioBitsPerSecond: 256_000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    this.active = true;
  }
  async stop() {
    if (!this.rec) return;
    const rec = this.rec;
    await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop(); });
    this.active = false;
    const type = rec.mimeType || 'video/webm';
    const blob = new Blob(this.chunks, { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reality-realtime.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    this.rec = null;
  }
}
