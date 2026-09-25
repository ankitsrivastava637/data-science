// Small 2D drawing kit for diagram layers drawn into the overlay canvas. All sizes are in
// "reference pixels" (1080p) and scaled by u = H/1080, so layouts are resolution independent.
export const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';

export class D2 {
  u: number;
  constructor(public g: CanvasRenderingContext2D, public W: number, public H: number, public a: number) {
    this.u = H / 1080;
    g.globalAlpha = a;
  }
  alpha(k: number) { this.g.globalAlpha = Math.max(0, Math.min(1, this.a * k)); return this; }
  font(px: number, weight = 380) { this.g.font = `${weight} ${Math.round(px * this.u)}px ${FONT}`; return this; }
  text(s: string, x: number, y: number, opts: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; alpha?: number; shadow?: boolean } = {}) {
    const g = this.g;
    if (opts.alpha != null) this.alpha(opts.alpha);
    this.font(opts.size ?? 17, opts.weight ?? 380);
    g.textAlign = opts.align ?? 'left';
    g.fillStyle = opts.color ?? '#e4ddcf';
    if (opts.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 6 * this.u; }
    g.fillText(s, x * this.W, y * this.H);
    g.shadowBlur = 0;
    if (opts.alpha != null) this.alpha(1);
    return this;
  }
  line(pts: [number, number][], color = '#cfc8b9', width = 1.2, dash?: number[]) {
    const g = this.g;
    g.strokeStyle = color; g.lineWidth = width * this.u; g.lineJoin = 'round'; g.lineCap = 'round';
    g.setLineDash(dash ? dash.map((d) => d * this.u) : []);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * this.W, y * this.H) : g.moveTo(x * this.W, y * this.H)));
    g.stroke();
    g.setLineDash([]);
    return this;
  }
  circle(x: number, y: number, rPx: number, fill?: string, stroke?: string, width = 1.2) {
    const g = this.g;
    g.beginPath(); g.arc(x * this.W, y * this.H, rPx * this.u, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width * this.u; g.stroke(); }
    return this;
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, width = 1.2) {
    const g = this.g;
    if (fill) { g.fillStyle = fill; g.fillRect(x * this.W, y * this.H, w * this.W, h * this.H); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width * this.u; g.strokeRect(x * this.W, y * this.H, w * this.W, h * this.H); }
    return this;
  }
  arrow(x0: number, y0: number, x1: number, y1: number, color = '#d8d1c3', width = 1.4, head = 9) {
    this.line([[x0, y0], [x1, y1]], color, width);
    const g = this.g;
    const ax = x1 * this.W, ay = y1 * this.H;
    const ang = Math.atan2(y1 * this.H - y0 * this.H, x1 * this.W - x0 * this.W);
    const h = head * this.u;
    g.fillStyle = color;
    g.beginPath(); g.moveTo(ax, ay);
    g.lineTo(ax - h * Math.cos(ang - 0.4), ay - h * Math.sin(ang - 0.4));
    g.lineTo(ax - h * Math.cos(ang + 0.4), ay - h * Math.sin(ang + 0.4));
    g.closePath(); g.fill();
    return this;
  }
  /** plot y(x) inside a box (fractions of the screen) with data ranges */
  plot(box: { x: number; y: number; w: number; h: number }, xr: [number, number], yr: [number, number], f: (x: number) => number, color: string, width = 1.6, n = 240, dash?: number[]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const xv = xr[0] + ((xr[1] - xr[0]) * i) / n;
      const yv = f(xv);
      if (!isFinite(yv)) continue;
      pts.push([box.x + (box.w * i) / n, box.y + box.h - (box.h * (yv - yr[0])) / (yr[1] - yr[0])]);
    }
    return this.line(pts, color, width, dash);
  }
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
