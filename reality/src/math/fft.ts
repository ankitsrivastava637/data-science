// In-place iterative radix-2 complex FFT (Float64 for accuracy; used by the double-slit
// solver, the Fourier chapter and the Zel'dovich field).

const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

function plan(n: number) {
  let p = twiddleCache.get(n);
  if (p) return p;
  if (n & (n - 1)) throw new Error('FFT size must be a power of two: ' + n);
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  p = { cos, sin, rev };
  twiddleCache.set(n, p);
  return p;
}

/** FFT of n complex values stored at re[off + k*stride], im[...]. inverse=true computes the unnormalised inverse. */
export function fft(re: Float64Array, im: Float64Array, n: number, inverse = false, off = 0, stride = 1) {
  const { cos, sin, rev } = plan(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i * stride, b = off + j * stride;
      let t = re[a]; re[a] = re[b]; re[b] = t;
      t = im[a]; im[a] = im[b]; im[b] = t;
    }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step], wi = sgn * sin[k * step];
        const a = off + (i + k) * stride, b = off + (i + k + half) * stride;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

/** 2D FFT on an nx × ny row-major grid (x fastest). */
export function fft2(re: Float64Array, im: Float64Array, nx: number, ny: number, inverse = false) {
  for (let y = 0; y < ny; y++) fft(re, im, nx, inverse, y * nx, 1);
  for (let x = 0; x < nx; x++) fft(re, im, ny, inverse, x, nx);
  if (inverse) {
    const s = 1 / (nx * ny);
    for (let i = 0; i < nx * ny; i++) { re[i] *= s; im[i] *= s; }
  }
}

/** 3D FFT on n³ grid (x fastest). */
export function fft3(re: Float64Array, im: Float64Array, n: number, inverse = false) {
  const n2 = n * n;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) fft(re, im, n, inverse, z * n2 + y * n, 1);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) fft(re, im, n, inverse, z * n2 + x, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) fft(re, im, n, inverse, y * n + x, n2);
  if (inverse) {
    const s = 1 / (n * n2);
    for (let i = 0; i < n * n2; i++) { re[i] *= s; im[i] *= s; }
  }
}

/** Real signal → magnitude spectrum (first n/2+1 bins), with optional Hann window. */
export function magnitudeSpectrum(signal: ArrayLike<number>, hann = true): Float64Array {
  const n = signal.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = signal[i] * (hann ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) : 1);
  fft(re, im, n);
  const out = new Float64Array(n / 2 + 1);
  for (let i = 0; i <= n / 2; i++) out[i] = Math.hypot(re[i], im[i]) / n;
  return out;
}
