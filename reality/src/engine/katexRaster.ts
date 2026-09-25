// KaTeX → bitmap. Equations are typeset once, drawn through an SVG foreignObject whose
// <style> carries the KaTeX woff2 fonts as data URIs (no network), then cropped to their ink.
import katex from 'katex';
import katexCss from 'virtual:katex-css';

export interface LatexBitmap {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  px: number;
}

export async function rasterizeLatex(latex: string, px: number, color = '#ece6da'): Promise<LatexBitmap> {
  const html = katex.renderToString('\\displaystyle ' + latex, { output: 'html', throwOnError: true, displayMode: false });
  const W = Math.ceil(px * 34), H = Math.ceil(px * 6);
  const pad = Math.ceil(px * 1.2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject x="0" y="0" width="${W}" height="${H}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:${pad}px;color:${color};font-size:${px}px;line-height:1.2;white-space:nowrap;">` +
    `<style>${katexCss}</style>${html}</div></foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'sync';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fx = full.getContext('2d', { willReadFrequently: true })!;
  fx.drawImage(img, 0, 0);
  const data = fx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (data[row + x * 4 + 3] > 4) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('KaTeX raster produced no ink for: ' + latex);
  const m = Math.ceil(px * 0.15);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(full, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, width: out.width, height: out.height, px };
}
